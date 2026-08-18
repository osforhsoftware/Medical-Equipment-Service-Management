import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Eye, FileText } from "lucide-react";
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
import { useAuth } from "@/context/AuthContext";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useListingUrlState } from "@/hooks/useListingUrlState";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { api, type BackendEstimate } from "@/lib/api";
import { formatDate, formatCurrency } from "@/lib/format";
import { EMPTY_PAGINATION_META } from "@/lib/listing";

const ESTIMATE_STATUS_FILTERS = [
  { label: "Draft", value: "draft" },
  { label: "Pending Admin", value: "pendingAdminApproval" },
  { label: "Sent", value: "sent" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "Revision", value: "revision" },
];

export default function Estimates() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const canBuild = hasRole(["admin", "coordinator", "estimator"]);
  const {
    search,
    setSearch,
    filters,
    setFilter,
    listParams,
    setPage,
    setLimit,
  } = useListingUrlState({ filterKeys: ["status"] });

  const debouncedSearch = useDebouncedValue(search);
  const queryParams = useMemo(
    () => ({ ...listParams, search: debouncedSearch || undefined }),
    [listParams, debouncedSearch],
  );

  const estimatesQuery = usePaginatedQuery({
    queryKey: "estimates",
    params: queryParams,
    queryFn: (params) => api.listEstimates(params),
  });

  const eligibleQuery = useQuery({
    queryKey: ["service-requests", "estimate-eligible"],
    queryFn: () => api.listServiceRequests({
      statuses: "inspection,estimate,approval,new",
      limit: 100,
      page: 1,
    }),
    staleTime: 30_000,
    enabled: canBuild,
  });

  const estimates = estimatesQuery.data?.data ?? [];
  const pagination = estimatesQuery.data?.meta ?? EMPTY_PAGINATION_META;
  const eligibleRequests = eligibleQuery.data?.data ?? [];
  const [preview, setPreview] = useState<BackendEstimate | null>(null);

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
          {canBuild && estimate.serviceRequestId ? (
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
    <RoleGuard roles={["admin", "coordinator", "estimator", "billing", "inspector", "engineer"]}>
      <div className="space-y-6">
        <PageHeader
          title="Estimates & Approvals"
          description="Itemized estimates with staff approval and automatic engineer assignment."
          actions={
            canBuild ? (
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
            ) : undefined
          }
        />

        <DataTable
          mode="server"
          data={estimates}
          columns={columns}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search estimates…"
          emptyMessage="No estimates yet. Open the Estimate Builder from a service ticket."
          emptyHint="Try changing your search or filters."
          filterValues={filters}
          onFilterChange={setFilter}
          filters={[{ key: "status", label: "Status", options: ESTIMATE_STATUS_FILTERS }]}
          pagination={pagination}
          onPageChange={setPage}
          onLimitChange={setLimit}
          loading={estimatesQuery.isLoading}
          isFetching={estimatesQuery.isFetching}
          error={estimatesQuery.error as Error | null}
          onRetry={() => void estimatesQuery.refetch()}
          onRowClick={(e) => navigate(`/app/estimates/${e.id}`)}
        />

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
