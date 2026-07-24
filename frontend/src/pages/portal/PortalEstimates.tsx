import { useEffect, useState } from "react";
import { Check, X, FileText, Loader2, MessageSquare } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { ApiError, api, type BackendEstimate } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { toast } from "@/hooks/use-toast";

export default function PortalEstimates() {
  const { user } = useAuth();
  const [items, setItems] = useState<BackendEstimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    void api.listEstimates()
      .then((rows) => setItems(rows.filter((estimate) => !user?.customerId || estimate.customerId === user.customerId)))
      .catch((error) => toast({ title: "Unable to load estimates", description: error instanceof ApiError ? error.message : "Request failed", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [user?.customerId]);

  const act = async (id: string, decision: "approved" | "rejected" | "revision") => {
    setSaving(id);
    try {
      const updated = await api.decideEstimate(id, decision, note || undefined);
      setItems((current) => current.map((estimate) => estimate.id === id ? updated : estimate));
      setNote("");
      toast({ title: `Estimate ${decision}` });
    } catch (error) {
      toast({ title: "Decision failed", description: error instanceof ApiError ? error.message : "Request failed", variant: "destructive" });
    } finally { setSaving(""); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Estimates" description="Review, approve, reject or request a revision for service estimates." />
      {loading ? <div className="flex justify-center gap-2 py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading estimates…</div> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((e) => {
          const actionable = e.status === "sent" || e.status === "revision";
          return (
            <Card key={e.id} className="overflow-hidden shadow-card hover:border-primary/20 hover:shadow-elevated">
              <div className="h-1 bg-gradient-to-r from-accent via-primary to-info" />
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-accent" />
                    <CardTitle className="text-base">{e.equipmentName}</CardTitle>
                  </div>
                  <StatusBadge status={e.status} />
                </div>
                <p className="text-xs text-muted-foreground">{e.reference} · rev {e.revision} · valid until {e.validUntil}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 rounded-xl bg-secondary/35 p-4 text-sm">
                  <Row label="Labor" value={e.laborCost} />
                  <Row label="Parts" value={e.partsCost} />
                  <Separator />
                  <div className="flex items-center justify-between text-base font-semibold">
                    <span>Total</span>
                    <span>{formatCurrency(e.total)}</span>
                  </div>
                </div>
                {actionable ? (
                  <div className="space-y-2 pt-1">
                    <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional decision or revision note" rows={2} />
                    <div className="flex flex-wrap gap-2">
                    <Button size="sm" disabled={saving === e.id} className="flex-1 bg-success text-success-foreground hover:bg-success/90" onClick={() => void act(e.id, "approved")}>
                      <Check className="mr-1 h-4 w-4" /> Approve
                    </Button>
                    <Button size="sm" disabled={saving === e.id} variant="outline" className="flex-1" onClick={() => void act(e.id, "revision")}>
                      <MessageSquare className="mr-1 h-4 w-4" /> Request Revision
                    </Button>
                    <Button size="sm" disabled={saving === e.id} variant="outline" className="flex-1 text-destructive hover:text-destructive" onClick={() => void act(e.id, "rejected")}>
                      <X className="mr-1 h-4 w-4" /> Reject
                    </Button>
                    </div>
                  </div>
                ) : (
                  <p className="rounded-lg bg-muted/50 p-2.5 text-center text-xs text-muted-foreground">
                    {e.status === "approved" && "You approved this estimate. Work is scheduled."}
                    {e.status === "rejected" && "You rejected this estimate."}
                    {e.status === "draft" && "Awaiting submission from the service team."}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
        {items.length === 0 && <p className="text-sm text-muted-foreground">No estimates yet.</p>}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{formatCurrency(value)}</span>
    </div>
  );
}
