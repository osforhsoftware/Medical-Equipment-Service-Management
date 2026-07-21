import { useState } from "react";
import { Check, X, FileText, MessageSquare } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/context/AuthContext";
import { estimates as seed } from "@/data/mock";
import type { Estimate } from "@/data/types";
import { formatCurrency } from "@/lib/format";
import { toast } from "@/hooks/use-toast";

export default function PortalEstimates() {
  const { user } = useAuth();
  const [items, setItems] = useState<Estimate[]>(seed.filter((e) => e.customerName === user?.name));

  const act = (id: string, status: Estimate["status"], msg: string) => {
    setItems((p) => p.map((e) => (e.id === id ? { ...e, status } : e)));
    toast({ title: msg });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Estimates</h1>
        <p className="mt-1 text-sm text-muted-foreground">Review, approve, reject or request a revision for service estimates.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((e) => {
          const actionable = e.status === "sent" || e.status === "revision";
          return (
            <Card key={e.id} className="shadow-card">
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
                <div className="space-y-2 text-sm">
                  <Row label="Labor" value={e.laborCost} />
                  <Row label="Parts" value={e.partsCost} />
                  <Separator />
                  <div className="flex items-center justify-between text-base font-semibold">
                    <span>Total</span>
                    <span>{formatCurrency(e.total)}</span>
                  </div>
                </div>
                {actionable ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" className="flex-1 bg-success text-success-foreground hover:bg-success/90" onClick={() => act(e.id, "approved", "Estimate approved — work can be scheduled.")}>
                      <Check className="mr-1 h-4 w-4" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => act(e.id, "revision", "Revision requested.")}>
                      <MessageSquare className="mr-1 h-4 w-4" /> Request Revision
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 text-destructive hover:text-destructive" onClick={() => act(e.id, "rejected", "Estimate rejected.")}>
                      <X className="mr-1 h-4 w-4" /> Reject
                    </Button>
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

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{formatCurrency(value)}</span>
    </div>
  );
}
