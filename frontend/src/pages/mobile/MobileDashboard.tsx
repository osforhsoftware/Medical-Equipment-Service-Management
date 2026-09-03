import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CalendarClock, ChevronRight, Loader2 } from "lucide-react";
import { MobileHeader } from "@/components/mobile/MobileHeader";
import { MobileSearchBar } from "@/components/mobile/MobileSearchBar";
import { FilterPills } from "@/components/mobile/FilterPills";
import { StaffWorkCard } from "@/components/mobile/StaffWorkCard";
import { WorkflowTimeline } from "@/components/mobile/WorkflowTimeline";
import { MobileQuickActions, MobileStatGrid } from "@/components/mobile/MobileStaffWidgets";
import { MobileImportantAlerts } from "@/components/mobile/MobileImportantAlerts";
import { useMobilePullRefresh, useMobileUnreadCount } from "@/hooks/useMobilePullRefresh";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { roleLabels } from "@/data/mock";
import type { Role } from "@/data/types";
import { getUserRoles } from "@/lib/userRoles";
import {
  filterQuickActionsByAccess,
  nextJobAction,
  queueTitle,
  resolveItemPath,
  roleFilterOptions,
  rolePipelineStages,
  roleOverduePath,
  rolePrimaryListPath,
  roleQuickActions,
  roleStats,
  showTodaySchedule,
} from "@/lib/mobileStaffDashboard";
import { ApiError, api, type BackendNotification, type DashboardData, type DashboardQueueItem } from "@/lib/api";
import { getImportantNotifications } from "@/lib/notificationPriority";
import { emitNotificationsUpdated } from "@/lib/notifications-events";
import { formatDate, formatJobStatus } from "@/lib/format";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

function matchesFilter(status: string, filter: string): boolean {
  const s = formatJobStatus(status);
  if (filter === "all") return true;
  if (filter === "assigned") {
    return ["new", "scheduled", "assigned_engineer", "assigned-engineer"].includes(s);
  }
  if (filter === "inspection") return s === "inspection";
  if (filter === "estimate") return ["estimate", "approval", "pending_approval", "review"].includes(s);
  if (filter === "in-progress") {
    return ["in-progress", "parts-pending", "assigned_engineer", "change_pending_approval"].includes(s);
  }
  if (filter === "completed") return s === "completed";
  if (filter === "billing") return ["invoiced", "sent"].includes(s);
  return true;
}

function progressForStatus(status: string): number {
  if (status === "completed") return 100;
  if (status === "review") return 85;
  if (status === "partsPending") return 55;
  if (status === "inProgress") return 40;
  return 10;
}

export default function MobileDashboard() {
  const { user } = useAuth();
  const { rbacMatrix } = useSettings();
  const navigate = useNavigate();
  const unread = useMobileUnreadCount();
  const role = (user?.role ?? "engineer") as Role;
  const userRoles = useMemo(() => (user ? getUserRoles(user) : [role]), [user, role]);

  const [data, setData] = useState<DashboardData | null>(null);
  const [notifications, setNotifications] = useState<BackendNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dashboard, notifs] = await Promise.all([
        api.getDashboard(),
        api.listNotifications(),
      ]);
      setData(dashboard);
      setNotifications(notifs);
    } catch (err) {
      toast({
        title: "Could not load dashboard",
        description: err instanceof ApiError ? err.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useMobilePullRefresh(load);

  const stats = useMemo(() => (data ? roleStats(role, data) : []), [data, role]);
  const actions = useMemo(
    () => filterQuickActionsByAccess(roleQuickActions(role), userRoles, rbacMatrix),
    [role, userRoles, rbacMatrix],
  );
  const filterOptions = useMemo(() => roleFilterOptions(role), [role]);
  const pipelineStages = useMemo(() => rolePipelineStages(role), [role]);
  const primaryListPath = useMemo(() => rolePrimaryListPath(role), [role]);

  const canQuickUpdateJobs = data?.visibility.canUpdateJobStatus && role === "engineer";

  const queueItems = useMemo(() => {
    if (!data) return [] as DashboardQueueItem[];
    const q = search.trim().toLowerCase();
    return data.myQueue.filter((item) => {
      if (!matchesFilter(item.status, filter)) return false;
      if (!q) return true;
      return [item.reference, item.title, item.subtitle].some((v) => v.toLowerCase().includes(q));
    });
  }, [data, filter, search]);

  const filterCounts = useMemo(() => {
    if (!data) return { all: 0 };
    const counts: Record<string, number> = { all: data.myQueue.length };
    for (const opt of filterOptions) {
      if (opt.value === "all") continue;
      counts[opt.value] = data.myQueue.filter((i) => matchesFilter(i.status, opt.value)).length;
    }
    return counts;
  }, [data, filterOptions]);

  const featuredItem = useMemo(() => {
    if (!data) return null;
    const overdue = data.myQueue.find((i) => i.dueAt && new Date(i.dueAt) < new Date());
    if (overdue) return overdue;
    if (showTodaySchedule(role) && data.todaySchedule.length > 0) {
      const first = data.todaySchedule[0];
      return data.myQueue.find((q) => q.id === first.id) ?? {
        id: first.id,
        kind: "job" as const,
        reference: first.reference,
        title: first.title,
        subtitle: first.subtitle,
        status: first.status,
        href: `/app/jobs/${first.id}`,
        progress: first.progress,
        dueAt: first.scheduledFor,
      };
    }
    return data.myQueue[0] ?? null;
  }, [data, role]);

  const updateJobStatus = async (jobId: string, status: string) => {
    setUpdatingId(jobId);
    try {
      await api.updateJob(jobId, { status, progress: progressForStatus(status) });
      toast({ title: "Updated", description: "Job status saved from your phone." });
      await load();
    } catch (err) {
      toast({
        title: "Update failed",
        description: err instanceof ApiError ? err.message : "Could not save",
        variant: "destructive",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const openItem = (item: DashboardQueueItem) => {
    navigate(resolveItemPath(item.kind, item.id, item.href));
  };

  const roleLabel = user ? roleLabels[user.role] : "";
  const todayCount = data?.personal.dueToday ?? data?.todaySchedule.length ?? 0;
  const overdueCount = data?.personal.overdue ?? 0;
  const importantAlerts = useMemo(
    () => getImportantNotifications(notifications, 3),
    [notifications],
  );

  const openAlert = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await api.markNotificationRead(id);
      emitNotificationsUpdated();
    } catch {
      await load();
    }
    navigate("/app/notifications");
  };

  if (loading && !data) {
    return (
      <div className="mobile-page flex min-h-[60vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading your work…
      </div>
    );
  }

  return (
    <div className="mobile-page">
      <MobileHeader
        title={user?.name.split(" ")[0] ?? "Staff"}
        subtitle={roleLabel}
        badge={todayCount > 0 ? `Today · ${todayCount} job${todayCount !== 1 ? "s" : ""}` : "Field service hub"}
        unreadCount={unread}
        onNotifications={() => navigate("/app/notifications")}
        onQuickAction={() => navigate(actions.find((a) => a.primary)?.to ?? primaryListPath)}
        quickActionLabel="Quick action"
      />

      {/* Overdue alert — staff must see this immediately */}
      {overdueCount > 0 && (
        <button
          type="button"
          onClick={() => navigate(roleOverduePath(role))}
          className="mt-4 flex w-full items-center gap-3 rounded-[16px] border border-destructive/30 bg-destructive/8 px-4 py-3 text-left active:scale-[0.99]"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-destructive">{overdueCount} overdue item{overdueCount !== 1 ? "s" : ""}</p>
            <p className="text-xs text-destructive/80">Tap to view assigned work needing attention</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-destructive" />
        </button>
      )}

      {/* Important alerts — shown upfront for every staff role on mobile */}
      <MobileImportantAlerts
        alerts={importantAlerts}
        totalUnread={unread}
        onOpenAlert={(id) => void openAlert(id)}
        onViewAll={() => navigate("/app/notifications")}
      />

      {/* Role stats — tap to filter queue */}
      {data && (
        <div className="mt-4">
          <MobileStatGrid
            stats={stats}
            onStatClick={(stat) => {
              if (stat.label === "Alerts") {
                navigate("/app/notifications");
                return;
              }
              if (stat.filter) setFilter(stat.filter);
            }}
          />
        </div>
      )}

      {/* One-tap shortcuts for common staff tasks */}
      <div className="mt-4">
        <p className="mb-2 px-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Quick Actions
        </p>
        <MobileQuickActions actions={actions} onNavigate={navigate} />
      </div>

      {/* Pipeline — workflow visibility at a glance */}
      {data && pipelineStages.length > 0 && (
        <div className="mobile-glass-card mt-4 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Work Pipeline
          </p>
          <div className={cn(
            "grid gap-2",
            pipelineStages.length <= 4 ? "grid-cols-2" : "grid-cols-3",
          )}>
            {pipelineStages.map((stage) => {
              const count = data.roleQueues[stage.queueKey] ?? 0;
              const active = filter === stage.key;
              return (
                <button
                  key={stage.key}
                  type="button"
                  onClick={() => setFilter(stage.key === filter ? "all" : stage.key)}
                  className={cn(
                    "rounded-[14px] border px-2 py-2.5 text-center transition-all active:scale-95",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border/60 bg-card text-foreground",
                  )}
                >
                  <p className="font-display text-lg font-bold">{count}</p>
                  <p className={cn("text-[10px] font-medium leading-tight", active ? "text-primary-foreground/90" : "text-muted-foreground")}>
                    {stage.label}
                  </p>
                </button>
              );
            })}
          </div>
          <div className="mt-4 border-t border-border/50 pt-4">
            <WorkflowTimeline status={filter === "all" ? "in-progress" : filter} kind="request" compact />
          </div>
        </div>
      )}

      <div className="mt-4">
        <MobileSearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search your assigned work…"
          onScan={() => navigate("/app/qr-tracking")}
        />
      </div>

      <div className="mt-3">
        <FilterPills
          options={filterOptions.map((o) => ({ ...o, count: filterCounts[o.value] }))}
          value={filter}
          onChange={setFilter}
        />
      </div>

      {/* Next up — highest priority item for mobile one-hand action */}
      {featuredItem && filter === "all" && !search.trim() && (
        <section className="mt-5">
          <h2 className="mb-3 font-display text-lg font-semibold text-foreground">Next Up</h2>
          <StaffWorkCard
            item={featuredItem}
            featured
            updating={updatingId === featuredItem.id}
            onOpen={() => openItem(featuredItem)}
            onQuickUpdate={
              canQuickUpdateJobs && featuredItem.kind === "job" && nextJobAction(featuredItem.status)?.next
                ? () => {
                    const next = nextJobAction(featuredItem.status);
                    if (next?.next) void updateJobStatus(featuredItem.id, next.next);
                  }
                : undefined
            }
            quickUpdateLabel={nextJobAction(featuredItem.status)?.nextLabel}
          />
        </section>
      )}

      {/* My work queue — primary staff update surface */}
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-foreground">
            {queueTitle(role)}
          </h2>
          {data && data.myQueue.length > 0 && (
            <button
              type="button"
              className="text-sm font-medium text-primary"
              onClick={() => navigate(primaryListPath)}
            >
              View all
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Syncing…
          </div>
        ) : queueItems.length === 0 ? (
          <div className="mobile-card py-10 text-center">
            <p className="text-sm text-muted-foreground">No work in this view.</p>
            <button
              type="button"
              className="mobile-btn-primary mt-4"
              onClick={() => navigate(actions.find((a) => a.primary)?.to ?? primaryListPath)}
            >
              Go to {actions.find((a) => a.primary)?.label ?? "Work"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {queueItems.slice(0, 12).map((item) => {
              const next = nextJobAction(item.status);
              return (
                <StaffWorkCard
                  key={`${item.kind}-${item.id}`}
                  item={item}
                  updating={updatingId === item.id}
                  onOpen={() => openItem(item)}
                  onQuickUpdate={
                    canQuickUpdateJobs && item.kind === "job" && next?.next
                      ? () => void updateJobStatus(item.id, next.next!)
                      : undefined
                  }
                  quickUpdateLabel={next?.nextLabel}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Today's schedule — field engineers and coordinators only */}
      {data && showTodaySchedule(role) && data.todaySchedule.length > 0 && (
        <section className="mt-6 pb-2">
          <div className="mb-3 flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            <h2 className="font-display text-base font-semibold">Today&apos;s Schedule</h2>
          </div>
          <div className="mobile-card !p-0 divide-y divide-border/60 overflow-hidden">
            {data.todaySchedule.map((job) => (
              <button
                key={job.id}
                type="button"
                onClick={() => navigate(`/app/jobs/${job.id}`)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-muted/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[10px] text-muted-foreground">{job.reference}</p>
                  <p className="truncate text-sm font-medium">{job.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{job.subtitle}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-medium text-primary">{formatDate(job.scheduledFor)}</p>
                  <p className="text-[10px] text-muted-foreground">{job.progress}%</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
