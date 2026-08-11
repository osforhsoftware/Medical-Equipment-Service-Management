import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { MobileHeader } from "@/components/mobile/MobileHeader";
import { MobileSearchBar } from "@/components/mobile/MobileSearchBar";
import { FilterPills } from "@/components/mobile/FilterPills";
import { ServiceJobCard, type ServiceJobCardData } from "@/components/mobile/ServiceJobCard";
import { WorkflowTimeline } from "@/components/mobile/WorkflowTimeline";
import { useMobilePullRefresh, useMobileUnreadCount } from "@/components/mobile/MobileLayout";
import { useAuth } from "@/context/AuthContext";
import { api, type BackendServiceJob } from "@/lib/api";
import { formatJobStatus } from "@/lib/format";
import { toast } from "@/lib/toast";

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
  const [jobs, setJobs] = useState<BackendServiceJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const initialFilter = searchParams.get("filter");
  const [filter, setFilter] = useState(
    initialFilter && FILTER_OPTIONS.some((o) => o.value === initialFilter) ? initialFilter : "all",
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listJobs();
      setJobs(data);
    } catch (err) {
      toast.apiError(err, { fallback: "Failed to load jobs" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useMobilePullRefresh(load);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return jobs.filter((j) => {
      const status = formatJobStatus(j.status);
      if (filter === "overdue") {
        if (!j.scheduledFor || status === "completed") return false;
        if (new Date(j.scheduledFor) >= start) return false;
      } else if (filter !== "all" && status !== filter) {
        return false;
      }
      if (!q) return true;
      return (
        j.equipmentName.toLowerCase().includes(q) ||
        j.customerName.toLowerCase().includes(q) ||
        j.reference.toLowerCase().includes(q) ||
        j.engineer.toLowerCase().includes(q)
      );
    });
  }, [jobs, filter, search]);

  const filterCounts = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const counts: Record<string, number> = { all: jobs.length };
    for (const opt of FILTER_OPTIONS) {
      if (opt.value === "all") continue;
      if (opt.value === "overdue") {
        counts.overdue = jobs.filter(
          (j) => j.scheduledFor && new Date(j.scheduledFor) < start && formatJobStatus(j.status) !== "completed",
        ).length;
      } else {
        counts[opt.value] = jobs.filter((j) => formatJobStatus(j.status) === opt.value).length;
      }
    }
    return counts;
  }, [jobs]);

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
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="mobile-card py-12 text-center text-sm text-muted-foreground">
            No service jobs found.
          </div>
        ) : (
          filtered.map((job, i) => (
            <ServiceJobCard
              key={job.id}
              job={jobToCard(job, i === 0)}
              onClick={() => navigate(`/app/jobs/${job.id}`)}
            />
          ))
        )}
      </section>
    </div>
  );
}
