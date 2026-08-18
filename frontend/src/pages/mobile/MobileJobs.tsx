import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { MobileHeader } from "@/components/mobile/MobileHeader";
import { MobileSearchBar } from "@/components/mobile/MobileSearchBar";
import { FilterPills } from "@/components/mobile/FilterPills";
import { ServiceJobCard, type ServiceJobCardData } from "@/components/mobile/ServiceJobCard";
import { WorkflowTimeline } from "@/components/mobile/WorkflowTimeline";
import { useMobilePullRefresh, useMobileUnreadCount } from "@/components/mobile/MobileLayout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { api, type BackendServiceJob } from "@/lib/api";
import { formatJobStatus, toApiJobStatus } from "@/lib/format";

const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "overdue", label: "Overdue" },
  { value: "scheduled", label: "Assigned" },
  { value: "in-progress", label: "In Progress" },
  { value: "parts-pending", label: "Parts" },
  { value: "review", label: "Review" },
  { value: "completed", label: "Completed" },
];

function jobToCard(job: BackendServiceJob, featured = false): ServiceJobCardData {
  const overdue = job.scheduledFor ? new Date(job.scheduledFor) < new Date() && job.status !== "completed" : false;
  return {
    id: job.id,
    reference: job.reference,
    equipmentName: job.equipmentName,
    customerName: job.customerName,
    hospitalName: job.customerName,
    complaint: job.typeOther ?? job.type,
    status: job.status,
    engineer: job.engineer,
    serviceDate: job.scheduledFor,
    progress: job.progress,
    featured,
    overdue,
  };
}

export default function MobileJobs() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const unread = useMobileUnreadCount();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const initialFilter = searchParams.get("filter");
  const [filter, setFilter] = useState(
    initialFilter && FILTER_OPTIONS.some((o) => o.value === initialFilter) ? initialFilter : "all",
  );

  const statusParam = filter === "all" || filter === "overdue" ? undefined : toApiJobStatus(filter);

  const jobsQuery = useInfiniteQuery({
    queryKey: ["jobs", "mobile", { status: statusParam, search: debouncedSearch || undefined }],
    queryFn: ({ pageParam }) =>
      api.listJobs({
        status: statusParam,
        search: debouncedSearch || undefined,
        page: pageParam,
        limit: 20,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.hasNextPage ? last.meta.page + 1 : undefined),
  });

  const load = () => void jobsQuery.refetch();
  useMobilePullRefresh(load);

  const jobs = jobsQuery.data?.pages.flatMap((page) => page.data) ?? [];

  const filtered = useMemo(() => {
    if (filter !== "overdue") return jobs;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return jobs.filter((j) => {
      const status = formatJobStatus(j.status);
      return Boolean(j.scheduledFor) && status !== "completed" && new Date(j.scheduledFor) < start;
    });
  }, [jobs, filter]);

  const filterCounts = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const counts: Record<string, number> = { all: jobsQuery.data?.pages[0]?.meta.total ?? jobs.length };
    if (filter !== "all" && filter !== "overdue") {
      counts[filter] = jobsQuery.data?.pages[0]?.meta.total ?? filtered.length;
    }
    counts.overdue = jobs.filter(
      (j) => j.scheduledFor && new Date(j.scheduledFor) < start && formatJobStatus(j.status) !== "completed",
    ).length;
    return counts;
  }, [filter, filtered.length, jobs, jobsQuery.data?.pages]);

  const activeStatus = filtered[0] ? formatJobStatus(filtered[0].status) : "scheduled";

  return (
    <div className="mobile-page">
      <MobileHeader
        title="Service Jobs"
        subtitle={user?.role === "engineer" ? "Your assigned field work" : "Track repair & calibration"}
        badge={`${filtered.length} job${filtered.length !== 1 ? "s" : ""}`}
        unreadCount={unread}
        onNotifications={() => navigate("/app/notifications")}
        onQuickAction={() => navigate("/app/service-tickets")}
      />

      <div className="mobile-glass-card mt-4 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Workflow Progress
        </p>
        <WorkflowTimeline status={activeStatus} kind="job" />
      </div>

      <div className="mt-4">
        <MobileSearchBar
          value={search}
          onChange={setSearch}
          onScan={() => navigate("/app/qr-tracking")}
        />
      </div>

      <div className="mt-4">
        <FilterPills
          options={FILTER_OPTIONS.map((o) => ({ ...o, count: filterCounts[o.value] }))}
          value={filter}
          onChange={setFilter}
        />
      </div>

      <section className="mt-5 space-y-4">
        {jobsQuery.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="mobile-card py-12 text-center text-sm text-muted-foreground">
            No service jobs found.
          </div>
        ) : (
          <>
            {filtered.map((job, i) => (
              <ServiceJobCard
                key={job.id}
                job={jobToCard(job, i === 0)}
                onClick={() => navigate(`/app/jobs/${job.id}`)}
              />
            ))}
            {filter !== "overdue" && jobsQuery.hasNextPage ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => void jobsQuery.fetchNextPage()}
                disabled={jobsQuery.isFetchingNextPage}
              >
                {jobsQuery.isFetchingNextPage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Load more
              </Button>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
