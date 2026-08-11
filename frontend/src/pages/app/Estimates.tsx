import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, FileText, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { ProfessionalDocument } from "@/components/shared/ProfessionalDocument";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { ApiError, api, type BackendEstimate, type BackendServiceRequest } from "@/lib/api";
import { formatDate, formatCurrency } from "@/lib/format";
import { toast } from "@/lib/toast";

export default function Estimates() {
  const navigate = useNavigate();
  const [estimates, setEstimates] = useState<BackendEstimate[]>([]);
  const [requests, setRequests] = useState<BackendServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<BackendEstimate | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [est, sr] = await Promise.all([
        api.listEstimates(),
        api.listServiceRequests(),
      ]);
      setEstimates(est);
      setRequests(sr.filter((r) => ["inspection", "estimate", "approval", "new"].includes(r.status)));
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof ApiError ? err.message : "Failed to load estimates",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const eligibleRequests = useMemo(
    () => requests.filter((r) => ["inspection", "estimate", "approval", "new"].includes(r.status)),
    [requests],
  );

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
            onRowClick={(e) => navigate(`/app/estimates/${e.id}`)}
          />
        )}

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
