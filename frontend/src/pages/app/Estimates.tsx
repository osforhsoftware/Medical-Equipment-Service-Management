import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, Eye, FileText, Loader2, MessageSquare, Plus, Send, X } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { ProfessionalDocument } from "@/components/shared/ProfessionalDocument";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { ApiError, api, type BackendEstimate, type BackendServiceRequest, type BackendUser } from "@/lib/api";
import { useBranch } from "@/context/BranchContext";
import { useAuth } from "@/context/AuthContext";
import { formatDate, formatCurrency } from "@/lib/format";
import { toast } from "@/hooks/use-toast";

export default function Estimates() {
  const navigate = useNavigate();
  const { branchId } = useBranch();
  const { user } = useAuth();
  const [estimates, setEstimates] = useState<BackendEstimate[]>([]);
  const [requests, setRequests] = useState<BackendServiceRequest[]>([]);
  const [engineers, setEngineers] = useState<BackendUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<BackendEstimate | null>(null);
  const [preview, setPreview] = useState<BackendEstimate | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [engineerId, setEngineerId] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [est, sr, users] = await Promise.all([
        api.listEstimates(),
        api.listServiceRequests({ branchId }),
        api.listUsers({ role: "engineer", isActive: true }).catch(() => []),
      ]);
      setEstimates(est);
      setRequests(sr.filter((r) => ["inspection", "estimate", "approval", "new"].includes(r.status)));
      setEngineers(users);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof ApiError ? err.message : "Failed to load estimates",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const eligibleRequests = useMemo(
    () => requests.filter((r) => ["inspection", "estimate", "approval", "new"].includes(r.status)),
    [requests],
  );

  const act = async (estimate: BackendEstimate, action: "approved" | "rejected" | "revision") => {
    if (action === "approved" && ["admin", "coordinator"].includes(user?.role ?? "") && !engineerId) {
      toast({ title: "Engineer required", description: "Select a service engineer to auto-assign the job.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await api.decideEstimate(estimate.id, action, decisionNote || undefined, {
        engineerId: action === "approved" ? engineerId : undefined,
      });
      setSelected(null);
      setDecisionNote("");
      setEngineerId("");
      await loadData();
      toast({ title: `Estimate ${action}` });
    } catch (error) {
      toast({
        title: "Workflow update failed",
        description: error instanceof ApiError ? error.message : "Request failed",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const openPreview = async (estimate: BackendEstimate) => {
    try {
      setPreview(await api.getEstimate(estimate.id));
    } catch {
      setPreview(estimate);
    }
  };

  const previewLines = (estimate: BackendEstimate) =>
    estimate.lineItems?.length
      ? estimate.lineItems.map((line) => ({
          id: line.id,
          description: `${line.type}: ${line.description}`,
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
          discount: Number(line.discount),
          taxRate: Number(line.taxRate),
        }))
      : [
          ...(Number(estimate.laborCost)
            ? [{ id: "labor", description: "Services and labor", quantity: 1, unitPrice: Number(estimate.laborCost), taxRate: 0 }]
            : []),
          ...(Number(estimate.partsCost)
            ? [{ id: "parts", description: "Products and parts", quantity: 1, unitPrice: Number(estimate.partsCost), taxRate: 0 }]
            : []),
        ];

  const columns: Column<BackendEstimate>[] = [
    {
      key: "reference",
      header: "Estimate",
      render: (e) => (
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-accent" />
          <div>
            <p className="font-mono text-sm font-medium">{e.reference}</p>
            <p className="text-xs text-muted-foreground">
              {e.requestRef} · rev {e.revision}
            </p>
          </div>
        </div>
      ),
    },
    { key: "customerName", header: "Customer", render: (e) => <span className="text-sm">{e.customerName}</span> },
    { key: "equipmentName", header: "Equipment", render: (e) => <span className="text-sm text-muted-foreground">{e.equipmentName}</span> },
    { key: "total", header: "Total", render: (e) => <span className="font-semibold">{formatCurrency(e.total)}</span> },
    { key: "validUntil", header: "Valid Until", render: (e) => <span className="text-sm text-muted-foreground">{formatDate(e.validUntil)}</span> },
    { key: "status", header: "Status", render: (e) => <StatusBadge status={e.status} /> },
    {
      key: "actions" as keyof BackendEstimate,
      header: "",
      render: (estimate) => (
        <div className="flex gap-1">
          {estimate.serviceRequestId ? (
            <Button size="sm" variant="outline" asChild onClick={(e) => e.stopPropagation()}>
              <Link to={`/app/estimates/${estimate.serviceRequestId}/build`}>Build</Link>
            </Button>
          ) : null}
          <Button
            size="icon"
            variant="ghost"
            onClick={(event) => {
              event.stopPropagation();
              void openPreview(estimate);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <RoleGuard roles={["admin", "coordinator", "estimator", "billing"]}>
      <div className="space-y-6">
        <PageHeader
          title="Estimates & Approvals"
          description="Itemized estimates with admin approval and automatic engineer assignment."
          actions={
            <Select
              onValueChange={(ticketId) => navigate(`/app/estimates/${ticketId}/build`)}
              disabled={eligibleRequests.length === 0}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Build for ticket…" />
              </SelectTrigger>
              <SelectContent>
                {eligibleRequests.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.reference}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading estimates…
          </div>
        ) : (
          <DataTable
            data={estimates}
            columns={columns}
            searchKeys={["reference", "customerName", "equipmentName", "requestRef"]}
            searchPlaceholder="Search estimates…"
            emptyMessage="No estimates yet. Open the Estimate Builder from a service ticket."
            filters={[
              {
                label: "Status",
                options: [
                  { label: "Draft", value: "draft" },
                  { label: "Pending Admin", value: "pendingAdminApproval" },
                  { label: "Sent", value: "sent" },
                  { label: "Approved", value: "approved" },
                  { label: "Rejected", value: "rejected" },
                  { label: "Revision", value: "revision" },
                ],
                predicate: (e, v) => e.status === v,
              },
            ]}
            onRowClick={setSelected}
          />
        )}

        <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
          <DialogContent className="sm:max-w-lg">
            {selected && (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-2">
                    <DialogTitle>{selected.reference}</DialogTitle>
                    <StatusBadge status={selected.status} />
                  </div>
                </DialogHeader>
                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <Info label="Ticket" value={selected.requestRef} />
                  <Info label="Revision" value={String(selected.revision)} />
                  <Info label="Labor" value={formatCurrency(selected.laborCost)} />
                  <Info label="Parts" value={formatCurrency(selected.partsCost)} />
                  <Info label="Total" value={formatCurrency(selected.total)} />
                  <Info label="Valid until" value={formatDate(selected.validUntil)} />
                </div>
                {["pendingAdminApproval", "sent", "revision"].includes(selected.status) &&
                ["admin", "coordinator"].includes(user?.role ?? "") ? (
                  <div className="grid gap-2">
                    <Label>Assign service engineer (required to approve)</Label>
                    <Select value={engineerId} onValueChange={setEngineerId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select engineer" />
                      </SelectTrigger>
                      <SelectContent>
                        {engineers.map((eng) => (
                          <SelectItem key={eng.id} value={eng.id}>
                            {eng.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
                <div className="grid gap-2">
                  <Label>Decision note</Label>
                  <Textarea value={decisionNote} onChange={(event) => setDecisionNote(event.target.value)} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => void openPreview(selected)}>
                    <Eye className="mr-1 h-4 w-4" /> Preview
                  </Button>
                  {selected.serviceRequestId ? (
                    <Button variant="outline" asChild>
                      <Link to={`/app/estimates/${selected.serviceRequestId}/build`}>
                        <Plus className="mr-1 h-4 w-4" /> Open Builder
                      </Link>
                    </Button>
                  ) : null}
                  {["pendingAdminApproval", "sent", "revision"].includes(selected.status) ? (
                    <>
                      <Button className="bg-success text-success-foreground" onClick={() => void act(selected, "approved")} disabled={saving}>
                        <Check className="mr-1 h-4 w-4" /> Approve
                      </Button>
                      <Button variant="outline" onClick={() => void act(selected, "revision")} disabled={saving}>
                        <MessageSquare className="mr-1 h-4 w-4" /> Revision
                      </Button>
                      <Button variant="outline" className="text-destructive" onClick={() => void act(selected, "rejected")} disabled={saving}>
                        <X className="mr-1 h-4 w-4" /> Reject
                      </Button>
                    </>
                  ) : null}
                  {selected.status === "draft" && selected.serviceRequestId ? (
                    <Button asChild>
                      <Link to={`/app/estimates/${selected.serviceRequestId}/build`}>
                        <Send className="mr-1 h-4 w-4" /> Continue in Builder
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
          <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto p-0">
            {preview ? (
              <ProfessionalDocument
                kind="Estimate"
                reference={preview.reference}
                customerName={preview.customerName}
                issueDate={preview.createdAt}
                validOrDueLabel="Valid until"
                validOrDueDate={preview.validUntil}
                lines={previewLines(preview)}
                notes={[preview.terms, preview.notes].filter(Boolean).join("\n\n")}
              />
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </RoleGuard>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
