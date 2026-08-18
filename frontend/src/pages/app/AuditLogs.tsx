import { useMemo } from "react";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useListingUrlState } from "@/hooks/useListingUrlState";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { api, type BackendAuditLog } from "@/lib/api";
import { roleLabels } from "@/data/mock";
import type { Role } from "@/data/types";
import { EMPTY_PAGINATION_META } from "@/lib/listing";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const ROLE_FILTER_OPTIONS = (Object.keys(roleLabels) as Role[]).map((role) => ({
  label: roleLabels[role],
  value: role,
}));

const QUICK_ROLE_FILTERS: { label: string; value: string }[] = [
  { label: "All roles", value: "all" },
  { label: "Administrators", value: "admin" },
  { label: "Coordinators", value: "coordinator" },
  { label: "Engineers", value: "engineer" },
  { label: "Billing", value: "billing" },
];

function formatNote(log: BackendAuditLog): string {
  const note = log.entityLabel ?? log.entity;
  if (!note || note === "—" || note === "unknown") return "—";
  return note;
}

export default function AuditLogs() {
  const {
    search,
    setSearch,
    filters,
    setFilter,
    listParams,
    setPage,
    setLimit,
  } = useListingUrlState({ filterKeys: ["role"], defaultLimit: 25 });

  const debouncedSearch = useDebouncedValue(search);
  const queryParams = useMemo(
    () => ({ ...listParams, search: debouncedSearch || undefined }),
    [listParams, debouncedSearch],
  );

  const logsQuery = usePaginatedQuery({
    queryKey: "audit-logs",
    params: queryParams,
    queryFn: (params) => api.listAuditLogs(params),
  });

  const logs = logsQuery.data?.data ?? [];
  const pagination = logsQuery.data?.meta ?? EMPTY_PAGINATION_META;
  const activeRole = filters.role ?? "all";

  const columns: Column<BackendAuditLog>[] = [
    {
      key: "createdAt",
      header: "Time",
      className: "whitespace-nowrap w-[9.5rem]",
      render: (l) => (
        <span className="font-mono text-[11px] leading-tight text-muted-foreground">
          {new Date(l.createdAt).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      ),
    },
    {
      key: "actor",
      header: "User",
      className: "min-w-[7rem] max-w-[10rem]",
      render: (l) => (
        <span className="block truncate text-[11px] font-medium leading-tight">
          {l.actorName ?? l.actor}
        </span>
      ),
    },
    {
      key: "role",
      header: "Role",
      className: "whitespace-nowrap w-[8.5rem]",
      render: (l) => (
        <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
          {l.roleName ?? roleLabels[l.role as Role] ?? l.role}
        </Badge>
      ),
    },
    {
      key: "action",
      header: "Action",
      className: "min-w-[9rem]",
      render: (l) => (
        <span className="text-[11px] font-medium leading-tight">
          {l.actionLabel ?? l.action}
        </span>
      ),
    },
    {
      key: "entity",
      header: "Note",
      className: "min-w-[8rem] max-w-[14rem]",
      render: (l) => (
        <span className="block truncate text-[11px] leading-tight text-muted-foreground">
          {formatNote(l)}
        </span>
      ),
    },
    {
      key: "ip",
      header: "IP",
      className: "whitespace-nowrap w-[6.5rem]",
      render: (l) => (
        <span className="font-mono text-[10px] leading-tight text-muted-foreground">
          {l.ip}
        </span>
      ),
    },
  ];

  return (
    <RoleGuard roles={["admin"]}>
      <div className="space-y-4">
        <PageHeader
          title="Audit Logs"
          description="Compact activity log — who did what, when."
          actions={
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => toast({ title: "Export", description: "Audit log exported." })}
            >
              <Download className="mr-1 h-3.5 w-3.5" /> Export
            </Button>
          }
        />

        <div className="flex flex-wrap gap-1.5">
          {QUICK_ROLE_FILTERS.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={activeRole === option.value ? "default" : "outline"}
              className={cn("h-7 px-2.5 text-[11px]", activeRole === option.value && "shadow-sm")}
              onClick={() => setFilter("role", option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>

        <DataTable
          mode="server"
          compact
          data={logs}
          columns={columns}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search user, action, note…"
          emptyMessage="No audit logs found."
          emptyHint="Try changing your search or filters."
          filterValues={filters}
          onFilterChange={setFilter}
          filters={[{ key: "role", label: "Role", options: ROLE_FILTER_OPTIONS }]}
          pagination={pagination}
          onPageChange={setPage}
          onLimitChange={setLimit}
          loading={logsQuery.isLoading}
          isFetching={logsQuery.isFetching}
          error={logsQuery.error as Error | null}
          onRetry={() => void logsQuery.refetch()}
        />
      </div>
    </RoleGuard>
  );
}
