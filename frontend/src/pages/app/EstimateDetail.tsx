import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Eye, Loader2, Plus } from "lucide-react";
import {
  ActivityTimeline,
  DetailInfoGrid,
  DetailSection,
  RecordDetailLayout,
} from "@/components/shared/RecordDetailLayout";
import { ProfessionalDocument } from "@/components/shared/ProfessionalDocument";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { ApiError, api, type BackendEstimate, type BackendUser } from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { toast } from "@/lib/toast";

export default function EstimateDetail() {
  const { id = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [estimate, setEstimate] = useState<BackendEstimate | null>(null);
  const [engineers, setEngineers] = useState<BackendUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [decisionNote, setDecisionNote] = useState("");
  const [engineerId, setEngineerId] = useState("");
  const [saving, setSaving] = useState(false);
  const tab = searchParams.get("tab") ?? "overview";

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [record, users] = await Promise.all([
        api.getEstimate(id),
        api.listUsers({ role: "engineer", isActive: true }).catch(() => [] as BackendUser[]),
      ]);
      setEstimate(record);
      setEngineers(users);
    } catch (err) {
      setEstimate(null);
      setError(err instanceof ApiError && err.status === 404 ? null : "Please try again.");
      if (!(err instanceof ApiError && err.status === 404)) {
        toast.apiError(err, { fallback: "Failed to load estimate" });
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (action: "approved" | "rejected" | "revision") => {
    if (!estimate) return;
    if (action === "approved" && ["admin", "coordinator"].includes(user?.role ?? "") && !engineerId) {
      toast({ title: "Engineer required", description: "Select a service engineer to auto-assign the job.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await api.decideEstimate(estimate.id, action, decisionNote || undefined, {
        engineerId: action === "approved" ? engineerId : undefined,
      });
      setDecisionNote("");
      setEngineerId("");
      toast({ title: `Estimate ${action}` });
      await load();
    } catch (err) {
      toast.apiError(err, { fallback: "Workflow update failed" });
    } finally {
      setSaving(false);
    }
  };

  const previewLines = (row: BackendEstimate) =>
    row.lineItems?.length
      ? row.lineItems.map((line) => ({
          id: line.id,
          description: `${line.type}: ${line.description}`,
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
          discount: Number(line.discount),
          taxRate: Number(line.taxRate),
        }))
      : [
          ...(Number(row.laborCost)
            ? [{ id: "labor", description: "Services and labor", quantity: 1, unitPrice: Number(row.laborCost), taxRate: 0 }]
            : []),
          ...(Number(row.partsCost)
            ? [{ id: "parts", description: "Products and parts", quantity: 1, unitPrice: Number(row.partsCost), taxRate: 0 }]
            : []),
        ];

  const canDecide = estimate && ["pendingAdminApproval", "sent", "revision"].includes(estimate.status);

  return (
    <RoleGuard roles={["admin", "coordinator", "estimator", "billing"]}>
      <RecordDetailLayout
        backTo="/app/estimates"
        backLabel="Back to Estimates"
        title={estimate?.reference ?? "Estimate"}
        subtitle={estimate ? `${estimate.customerName} · ${estimate.equipmentName}` : undefined}
        status={estimate?.status}
        meta={estimate ? [
          { label: "Ticket", value: estimate.requestRef },
          { label: "Revision", value: String(estimate.revision) },
          { label: "Total", value: formatCurrency(estimate.total) },
        ] : undefined}
        loading={loading}
        error={error}
        notFound={!loading && !error && !estimate}
        notFoundTitle="Estimate not found"
        notFoundDescription="The requested estimate could not be found."
        onRetry={() => void load()}
        actions={estimate ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setPreviewOpen(true)}>
              <Eye className="mr-1 h-4 w-4" /> Preview
            </Button>
            {estimate.serviceRequestId ? (
              <Button variant="outline" asChild>
                <Link to={`/app/estimates/${estimate.serviceRequestId}/build`}>
                  <Plus className="mr-1 h-4 w-4" /> Open Builder
                </Link>
              </Button>
            ) : null}
          </div>
        ) : undefined}
        activeTab={tab}
        onTabChange={(value) => setSearchParams(value === "overview" ? {} : { tab: value })}
        tabs={estimate ? [
          {
            id: "overview",
            label: "Overview",
            content: (
              <div className="space-y-4">
                <DetailSection title="Estimate details">
                  <DetailInfoGrid
                    items={[
                      { label: "Ticket", value: estimate.serviceRequestId ? (
                        <Link className="text-primary hover:underline normal-case" to={`/app/service-tickets/${estimate.serviceRequestId}`}>{estimate.requestRef}</Link>
                      ) : estimate.requestRef },
                      { label: "Customer", value: estimate.customerName },
                      { label: "Equipment", value: estimate.equipmentName },
                      { label: "Revision", value: String(estimate.revision) },
                      { label: "Labor", value: formatCurrency(estimate.laborCost) },
                      { label: "Parts", value: formatCurrency(estimate.partsCost) },
                      { label: "Subtotal", value: formatCurrency(estimate.subtotal ?? 0) },
                      { label: "Tax", value: formatCurrency(estimate.tax ?? 0) },
                      { label: "Total", value: formatCurrency(estimate.total) },
                      { label: "Valid until", value: formatDate(estimate.validUntil) },
                    ]}
                  />
                </DetailSection>
                {estimate.notes ? (
                  <DetailSection title="Notes">
                    <p className="text-sm text-muted-foreground">{estimate.notes}</p>
                  </DetailSection>
                ) : null}
                {estimate.terms ? (
                  <DetailSection title="Terms">
                    <p className="text-sm text-muted-foreground">{estimate.terms}</p>
                  </DetailSection>
                ) : null}
              </div>
            ),
          },
          {
            id: "lines",
            label: "Line items",
            content: (
              <DetailSection title="Line items">
                {!estimate.lineItems?.length ? (
                  <p className="text-sm text-muted-foreground">No detailed line items. Summary costs are shown on Overview.</p>
                ) : (
                  <div className="space-y-2">
                    {estimate.lineItems.map((line) => (
                      <div key={line.id} className="grid grid-cols-[1fr_auto] gap-3 rounded-lg border p-3 text-sm">
                        <div>
                          <p className="font-medium">{line.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {line.type} · qty {Number(line.quantity)} · {formatCurrency(line.unitPrice)}
                          </p>
                        </div>
                        <span className="font-semibold">{formatCurrency(Number(line.quantity) * Number(line.unitPrice))}</span>
                      </div>
                    ))}
                  </div>
                )}
              </DetailSection>
            ),
          },
          {
            id: "activity",
            label: "Activity",
            content: (
              <div className="space-y-4">
                <DetailSection title="Decisions">
                  <ActivityTimeline
                    items={(estimate.decisions ?? []).map((d) => ({
                      id: d.id,
                      title: d.decision,
                      detail: d.note,
                      meta: formatDateTime(d.createdAt),
                    }))}
                    emptyMessage="No decisions recorded yet."
                  />
                </DetailSection>
                <DetailSection title="Revisions">
                  <ActivityTimeline
                    items={(estimate.revisions ?? []).map((r) => ({
                      id: r.id,
                      title: `Revision ${r.revision}`,
                      detail: r.note,
                      meta: formatDateTime(r.createdAt),
                    }))}
                    emptyMessage="No revisions recorded."
                  />
                </DetailSection>
              </div>
            ),
          },
        ] : undefined}
        sidebar={estimate ? (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Decision</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <StatusBadge status={estimate.status} />
              </div>
              {canDecide && ["admin", "coordinator"].includes(user?.role ?? "") ? (
                <>
                  <div className="grid gap-2">
                    <Label>Assign engineer (required to approve)</Label>
                    <Select value={engineerId} onValueChange={setEngineerId}>
                      <SelectTrigger><SelectValue placeholder="Select engineer" /></SelectTrigger>
                      <SelectContent>
                        {engineers.map((eng) => (
                          <SelectItem key={eng.id} value={eng.id}>{eng.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Decision note</Label>
                    <Textarea value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button className="bg-success text-success-foreground" onClick={() => void act("approved")} disabled={saving}>
                      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Approve
                    </Button>
                    <Button variant="outline" onClick={() => void act("revision")} disabled={saving}>Request revision</Button>
                    <Button variant="destructive" onClick={() => void act("rejected")} disabled={saving}>Reject</Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {canDecide ? "Only admin/coordinator can decide this estimate." : "No pending decisions for this estimate."}
                </p>
              )}
            </CardContent>
          </Card>
        ) : undefined}
      />

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>{estimate?.reference} preview</DialogTitle></DialogHeader>
          {estimate ? (
            <ProfessionalDocument
              kind="Estimate"
              reference={estimate.reference}
              customerName={estimate.customerName}
              issueDate={estimate.createdAt}
              validOrDueLabel="Valid until"
              validOrDueDate={estimate.validUntil}
              lines={previewLines(estimate)}
              notes={[estimate.terms, estimate.notes].filter(Boolean).join("\n\n")}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </RoleGuard>
  );
}
