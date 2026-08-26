import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, Eye, Loader2, MessageSquare, X } from "lucide-react";
import { ProfessionalDocument } from "@/components/shared/ProfessionalDocument";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ApiError, api, type BackendEstimate } from "@/lib/api";
import { estimateStatusLabel, estimateToDocumentLines, isEstimatePendingDecision } from "@/lib/estimates";
import { formatCurrency } from "@/lib/format";
import { toast } from "@/lib/toast";

export default function PortalEstimateDetail() {
  const { id = "" } = useParams();
  const [estimate, setEstimate] = useState<BackendEstimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const portal = await api.getCustomerPortal();
      const match = portal.estimates.find((item) => item.id === id);
      if (!match) {
        setEstimate(null);
        return;
      }
      setEstimate(await api.getEstimate(id).catch(() => match));
    } catch (error) {
      toast.apiError(error, { fallback: "Unable to load estimate" });
      setEstimate(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (decision: "approved" | "rejected" | "revision") => {
    if (!estimate) return;
    setSaving(true);
    try {
      const updated = await api.decideEstimate(estimate.id, decision, note || undefined);
      setEstimate(updated);
      setNote("");
      toast({ title: decision === "approved" ? "Estimate acknowledged" : decision === "revision" ? "Revision requested" : "Estimate rejected" });
    } catch (error) {
      if (!(error instanceof ApiError)) toast.apiError(error, { fallback: "Request failed" });
      else toast.apiError(error, { fallback: "Request failed" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center gap-2 py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading estimate…
      </div>
    );
  }

  if (!estimate) {
    return (
      <div className="space-y-4 py-10 text-center">
        <p className="font-medium">Estimate not found</p>
        <Button variant="outline" asChild>
          <Link to="/portal/estimates">Back to estimates</Link>
        </Button>
      </div>
    );
  }

  const actionable = isEstimatePendingDecision(estimate.status);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" asChild>
            <Link to="/portal/estimates">
              <ArrowLeft className="mr-1 h-4 w-4" /> Estimates
            </Link>
          </Button>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="page-title">{estimate.reference}</h1>
            <StatusBadge status={estimate.status} label={estimateStatusLabel(estimate.status)} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {estimate.equipmentName} · {formatCurrency(estimate.total)}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to={`/portal/estimates/${estimate.id}/preview`}>
            <Eye className="mr-1 h-4 w-4" /> View document
          </Link>
        </Button>
      </div>

      <div className="print-area overflow-visible rounded-lg border border-border bg-card">
          <ProfessionalDocument
            kind="Estimate"
            reference={estimate.reference}
            customerName={estimate.customerName}
            equipmentName={estimate.equipmentName}
            issueDate={estimate.createdAt}
            validOrDueLabel="Valid until"
            validOrDueDate={estimate.validUntil}
            ticketRef={estimate.requestRef}
            lines={estimateToDocumentLines(estimate)}
            discount={Number(estimate.discount ?? 0)}
            notes={estimate.notes ?? undefined}
            terms={estimate.terms ?? undefined}
            hideToolbar
            showSignature
          />
      </div>

      {actionable ? (
        <section className="space-y-3 rounded-lg border border-border bg-card p-4">
          <h2 className="section-title">Your response</h2>
          <div className="grid gap-2">
            <Label htmlFor="portal-note">Note</Label>
            <Textarea id="portal-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Optional comment" />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button disabled={saving} className="bg-success text-success-foreground hover:bg-success/90" onClick={() => void act("approved")}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Approve Estimate
            </Button>
            <Button disabled={saving} variant="outline" onClick={() => void act("revision")}>
              <MessageSquare className="h-4 w-4" /> Request Revision
            </Button>
            <Button disabled={saving} variant="destructive" onClick={() => void act("rejected")}>
              <X className="h-4 w-4" /> Reject
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
