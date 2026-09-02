import { useMemo } from "react";
import { FolderKanban } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Progress } from "@/components/ui/progress";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useListingUrlState } from "@/hooks/useListingUrlState";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { api, type BackendServiceJob } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { EMPTY_PAGINATION_META } from "@/lib/listing";

const JOB_STATUS_FILTERS = [
  { label: "Scheduled", value: "scheduled" },
  { label: "In Progress", value: "inProgress" },
  { label: "Parts Pending", value: "partsPending" },
  { label: "Review", value: "review" },
  { label: "Completed", value: "completed" },
];

export default function Projects() {
  const navigate = useNavigate();
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

  const jobsQuery = usePaginatedQuery({
    queryKey: "jobs",
    params: queryParams,
    queryFn: (params) => api.listJobs(params),
  });

  const jobs = jobsQuery.data?.data ?? [];
  const pagination = jobsQuery.data?.meta ?? EMPTY_PAGINATION_META;

  const columns: Column<BackendServiceJob>[] = [
    { key: "reference", header: "Project", render: (job) => <div className="flex items-center gap-2"><FolderKanban className="h-4 w-4 text-primary" /><div><p className="font-mono text-sm font-medium">{job.reference}</p><p className="text-xs text-muted-foreground">{job.requestRef}</p></div></div> },
    { key: "customerName", header: "Customer", render: (job) => <div><p>{job.customerName}</p><p className="text-xs text-muted-foreground">{job.equipmentName}</p></div> },
    { key: "engineer", header: "Lead", render: (job) => <span>{job.engineer}</span> },
    { key: "scheduledFor", header: "Scheduled", render: (job) => <span>{formatDate(job.scheduledFor)}</span> },
    { key: "progress", header: "Progress", render: (job) => <div className="w-28 space-y-1"><Progress value={job.progress} className="h-1.5" /><span className="text-xs text-muted-foreground">{job.progress}%</span></div> },
    { key: "status", header: "Status", render: (job) => <StatusBadge status={job.status} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Projects" description="Assign staff to service jobs. Use Service Jobs for work logs, parts, and billing." />
      <DataTable
        mode="server"
        data={jobs}
        columns={columns}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search projects…"
        emptyMessage="No service projects found."
        emptyHint="Try changing your search or filters."
        filterValues={filters}
        onFilterChange={setFilter}
        filters={[{ key: "status", label: "Status", options: JOB_STATUS_FILTERS }]}
        pagination={pagination}
        onPageChange={setPage}
        onLimitChange={setLimit}
        loading={jobsQuery.isLoading}
        isFetching={jobsQuery.isFetching}
        error={jobsQuery.error as Error | null}
        onRetry={() => void jobsQuery.refetch()}
        onRowClick={(job) => navigate(`/app/projects/${job.id}`)}
      />
    </div>
  );
}
