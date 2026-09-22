import { useMemo, useState } from "react";
import { FileSpreadsheet, FolderKanban, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useListingUrlState } from "@/hooks/useListingUrlState";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { api, type BackendServiceJob } from "@/lib/api";
import { downloadSpreadsheet } from "@/lib/exportSpreadsheet";
import { formatDate } from "@/lib/format";
import { EMPTY_PAGINATION_META } from "@/lib/listing";
import { toast } from "@/lib/toast";

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
    () => ({
      ...listParams,
      search: debouncedSearch || undefined,
      completedScope: "all" as const,
    }),
    [listParams, debouncedSearch],
  );

  const jobsQuery = usePaginatedQuery({
    queryKey: "jobs",
    params: queryParams,
    queryFn: (params) => api.listJobs(params),
  });

  const jobs = jobsQuery.data?.data ?? [];
  const pagination = jobsQuery.data?.meta ?? EMPTY_PAGINATION_META;
  const [exporting, setExporting] = useState(false);

  const exportProjects = async () => {
    setExporting(true);
    try {
      const rows: BackendServiceJob[] = [];
      let page = 1;
      let hasNext = true;
      while (hasNext && page <= 50) {
        const result = await api.listJobs({
          ...queryParams,
          page,
          limit: 100,
        });
        rows.push(...result.data);
        hasNext = result.meta.hasNextPage;
        page += 1;
      }
      downloadSpreadsheet(
        "projects",
        [
          { header: "Project", value: (j) => j.reference },
          { header: "Ticket Ref", value: (j) => j.requestRef },
          { header: "Customer", value: (j) => j.customerName },
          { header: "Equipment", value: (j) => j.equipmentName },
          { header: "Lead", value: (j) => j.engineer },
          { header: "Scheduled", value: (j) => formatDate(j.scheduledFor) },
          { header: "Progress %", value: (j) => j.progress },
          { header: "Status", value: (j) => j.status },
        ],
        rows,
      );
      toast.success("Export ready", { description: `${rows.length} project(s) exported for Excel.` });
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to export projects" });
    } finally {
      setExporting(false);
    }
  };

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
      <PageHeader
        title="Projects"
        description="Full service projects: workflow, team, work reports, parts, and activity. Open a row for details and edits."
        actions={
          <Button type="button" variant="outline" disabled={exporting} onClick={() => void exportProjects()}>
            {exporting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-1 h-4 w-4" />}
            Export Excel
          </Button>
        }
      />
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
