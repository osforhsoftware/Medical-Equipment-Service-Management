import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Eye, FilePenLine, MoreHorizontal, Plus } from "lucide-react";
import { EstimateNewSheet } from "@/components/estimates/EstimateNewSheet";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { CUSTOMER_READ_ROLES, ESTIMATE_READ_ROLES, ESTIMATE_WRITE_ROLES } from "@/config/roles";
import { useAuth } from "@/context/AuthContext";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useListingUrlState } from "@/hooks/useListingUrlState";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { api, type BackendEstimate, type BackendServiceRequest } from "@/lib/api";
import { ESTIMATE_STATUS_OPTIONS, canEditEstimate, estimateStatusLabel } from "@/lib/estimates";
import { formatDate, formatCurrency, formatServiceStatus } from "@/lib/format";
import { EMPTY_PAGINATION_META } from "@/lib/listing";
import { cn } from "@/lib/utils";

function useEstimateCount(status?: string) {
  return useQuery({
    queryKey: ["estimates", "kpi", "service", status ?? "all"],
    queryFn: () => api.listEstimates({ page: 1, limit: 10, status, kind: "service" }),
    select: (result) => result.meta.total,
    staleTime: 30_000,
  });
}

function ticketEquipment(ticket: BackendServiceRequest) {
  if (ticket.equipmentItems?.length) {
    return ticket.equipmentItems.map((item) => item.equipmentName).join(", ");
  }
  return ticket.equipmentName ?? "—";
}

export default function Estimates() {
  const navigate = useNavigate();
  const { hasRole, user } = useAuth();
  const canBuild = hasRole(ESTIMATE_WRITE_ROLES);
  const canReadCustomers = hasRole(CUSTOMER_READ_ROLES);
  const [newOpen, setNewOpen] = useState(false);
  const [moreFilters, setMoreFilters] = useState(false);
  const {
    search,
    setSearch,
    filters,
    setFilter,
    listParams,
    setPage,
    setLimit,
    updateParams,
  } = useListingUrlState({ filterKeys: ["status", "customerId", "createdFrom", "createdTo"] });

  const debouncedSearch = useDebouncedValue(search);
  const queryParams = useMemo(
    () => ({ ...listParams, search: debouncedSearch || undefined, kind: "service" as const }),
    [listParams, debouncedSearch],
  );

  const estimatesQuery = usePaginatedQuery({
    queryKey: "estimates",
    params: queryParams,
    queryFn: (params) => api.listEstimates(params),
  });

  const customersQuery = useQuery({
    queryKey: ["customers", "estimate-filter"],
    queryFn: () => api.listCustomersOptions(),
    staleTime: 60_000,
    enabled: canReadCustomers,
  });

  /** Tickets at Estimate stage assigned to this staff (or all for coordinators). */
  const assignedQueueQuery = useQuery({
    queryKey: ["service-requests", "estimate-work-queue", user?.id],
    queryFn: () =>
      api.listServiceRequests({
        statuses: "estimate",
        limit: 50,
        page: 1,
      }),
    enabled: canBuild,
    staleTime: 15_000,
  });

  const openEstimatesQuery = useQuery({
    queryKey: ["estimates", "open-for-queue", user?.id],
    queryFn: async () => {
      const [drafts, revisions] = await Promise.all([
        api.listEstimates({ page: 1, limit: 100, status: "draft", kind: "service" }),
        api.listEstimates({ page: 1, limit: 100, status: "revision", kind: "service" }),
      ]);
      return [...drafts.data, ...revisions.data];
    },
    enabled: canBuild,
    staleTime: 15_000,
  });

  const totalCount = useEstimateCount();
  const draftCount = useEstimateCount("draft");
  const pendingCount = useEstimateCount("pendingAdminApproval");
  const approvedCount = useEstimateCount("approved");
  const revisionCount = useEstimateCount("revision");

  const estimates = estimatesQuery.data?.data ?? [];
  const pagination = estimatesQuery.data?.meta ?? EMPTY_PAGINATION_META;
  const customers = customersQuery.data ?? [];
  const activeStatus = filters.status ?? "all";
  const queueTickets = assignedQueueQuery.data?.data ?? [];

  const ticketsWithOpenEstimate = useMemo(() => {
    const ids = new Set<string>();
    for (const estimate of openEstimatesQuery.data ?? []) {
      if (estimate.serviceRequestId) ids.add(estimate.serviceRequestId);
    }
    return ids;
  }, [openEstimatesQuery.data]);
  const kpis = [
    { label: "Total Estimates", value: totalCount.data ?? 0, status: "all" },
    { label: "Draft", value: draftCount.data ?? 0, status: "draft" },
    { label: "Pending Approval", value: pendingCount.data ?? 0, status: "pendingAdminApproval" },
    { label: "Approved", value: approvedCount.data ?? 0, status: "approved" },
    { label: "Revision Required", value: revisionCount.data ?? 0, status: "revision" },
  ];

  const resetFilters = () => {
    updateParams({
      status: null,
      customerId: null,
      createdFrom: null,
      createdTo: null,
      search: null,
      page: 1,
    });
  };

  const columns: Column<BackendEstimate>[] = [
    {
      key: "reference",
      header: "Estimate",
      render: (e) => (
        <div>
          <p className="font-mono text-sm font-medium">{e.reference}</p>
          <p className="text-xs text-muted-foreground">Rev {e.revision}</p>
        </div>
      ),
    },
    {
      key: "customerName",
      header: "Customer",
      render: (e) => <span className="text-sm">{e.customerName}</span>,
    },
    {
      key: "equipmentName",
      header: "Equipment",
      render: (e) => <span className="text-sm text-muted-foreground">{e.equipmentName}</span>,
    },
    {
      key: "requestRef",
      header: "Ticket",
      render: (e) => <span className="font-mono text-xs">{e.requestRef}</span>,
    },
    {
      key: "total",
      header: "Amount",
      render: (e) => <span className="font-semibold">{formatCurrency(e.total)}</span>,
    },
    {
      key: "validUntil",
      header: "Valid Until",
      render: (e) => <span className="text-sm text-muted-foreground">{formatDate(e.validUntil)}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (e) => <StatusBadge status={e.status} label={estimateStatusLabel(e.status)} />,
    },
    {
      key: "updatedAt",
      header: "Updated",
      render: (e) => <span className="text-sm text-muted-foreground">{formatDate(e.updatedAt)}</span>,
    },
    {
      key: "actions",
      header: "",
      className: "w-[1%] whitespace-nowrap text-right",
      render: (estimate) => (
        <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
          <Button size="sm" variant="ghost" asChild>
            <Link to={`/app/estimates/${estimate.id}`}>View</Link>
          </Button>
          {canBuild && estimate.serviceRequestId && canEditEstimate(estimate.status) ? (
            <Button size="sm" variant="outline" asChild>
              <Link to={`/app/estimates/${estimate.serviceRequestId}/build`}>Edit</Link>
            </Button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" aria-label="More estimate actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to={`/app/estimates/${estimate.id}/preview`}>
                  <Eye className="mr-2 h-4 w-4" /> Preview
                </Link>
              </DropdownMenuItem>
              {canBuild && estimate.serviceRequestId ? (
                <DropdownMenuItem asChild>
                  <Link to={`/app/estimates/${estimate.serviceRequestId}/build`}>
                    <FilePenLine className="mr-2 h-4 w-4" /> Open builder
                  </Link>
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <RoleGuard roles={ESTIMATE_READ_ROLES}>
      <div className="space-y-5">
        <PageHeader
          title="Service estimates"
          description="Quotations for service tickets. Create from an assigned ticket, then send for approval."
          actions={
            canBuild ? (
              <Button onClick={() => setNewOpen(true)}>
                <Plus className="h-4 w-4" /> New Estimate
              </Button>
            ) : undefined
          }
        />

        {canBuild ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-base">Tickets awaiting estimate</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Assigned Estimate-stage tickets. Open the builder, save the quotation, then Send for Approval.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setNewOpen(true)}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add estimate
              </Button>
            </CardHeader>
            <CardContent>
              {assignedQueueQuery.isLoading ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Loading assigned tickets…</p>
              ) : queueTickets.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No tickets waiting. When a coordinator assigns you work at Estimate stage, it shows up here.
                </p>
              ) : (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {queueTickets.map((ticket) => {
                    const hasEstimate = ticketsWithOpenEstimate.has(ticket.id);
                    return (
                      <li
                        key={ticket.id}
                        className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-mono text-sm font-medium">{ticket.reference}</p>
                            <StatusBadge status={ticket.status} label={formatServiceStatus(ticket.status)} />
                          </div>
                          <p className="truncate text-sm">{ticket.customerName}</p>
                          <p className="truncate text-xs text-muted-foreground">{ticketEquipment(ticket)}</p>
                        </div>
                        <Button size="sm" asChild>
                          <Link to={`/app/estimates/${ticket.id}/build`}>
                            <FilePenLine className="mr-1.5 h-3.5 w-3.5" />
                            {hasEstimate ? "Continue estimate" : "Create estimate"}
                          </Link>
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        ) : null}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {kpis.map((card) => {
            const active = activeStatus === card.status || (card.status === "all" && !filters.status);
            return (
              <button
                key={card.label}
                type="button"
                onClick={() => setFilter("status", card.status)}
                className={cn(
                  "rounded-lg border bg-card px-4 py-3 text-left transition-colors",
                  active ? "border-primary/40 bg-primary/[0.04]" : "border-border hover:bg-muted/40",
                )}
              >
                <p className="text-[12px] text-muted-foreground">{card.label}</p>
                <p className="mt-1 text-xl font-semibold tracking-tight">{card.value}</p>
              </button>
            );
          })}
        </div>

        <DataTable
          mode="server"
          compact
          data={estimates}
          columns={columns}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search estimates, customers, tickets, equipment…"
          emptyMessage="No estimates yet"
          emptyHint="Use Add estimate or open a ticket from the queue above to create one."
          filterValues={filters}
          onFilterChange={setFilter}
          filters={[{ key: "status", label: "Status", options: [...ESTIMATE_STATUS_OPTIONS] }]}
          pagination={pagination}
          onPageChange={setPage}
          onLimitChange={setLimit}
          loading={estimatesQuery.isLoading}
          isFetching={estimatesQuery.isFetching}
          error={estimatesQuery.error as Error | null}
          onRetry={() => void estimatesQuery.refetch()}
          onRowClick={(e) => navigate(`/app/estimates/${e.id}`)}
          toolbarExtra={
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setMoreFilters((open) => !open)}>
                More Filters
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={resetFilters}>
                Reset
              </Button>
            </div>
          }
        />

        {moreFilters ? (
          <div className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-3">
            <div className="grid gap-1.5">
              {canReadCustomers ? (
                <>
                  <Label>Customer</Label>
                  <Select value={filters.customerId ?? "all"} onValueChange={(value) => setFilter("customerId", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All customers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All customers</SelectItem>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="created-from">From</Label>
              <Input
                id="created-from"
                type="date"
                value={filters.createdFrom ?? ""}
                onChange={(e) => setFilter("createdFrom", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="created-to">To</Label>
              <Input
                id="created-to"
                type="date"
                value={filters.createdTo ?? ""}
                onChange={(e) => setFilter("createdTo", e.target.value)}
              />
            </div>
          </div>
        ) : null}

        {canBuild ? <EstimateNewSheet open={newOpen} onOpenChange={setNewOpen} /> : null}
      </div>
    </RoleGuard>
  );
}
