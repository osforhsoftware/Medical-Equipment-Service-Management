import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileCheck,
  FileText,
  IndianRupee,
  Loader2,
  MapPin,
  Package,
  QrCode,
  Receipt,
  Search,
  Settings as Cog,
  ShieldCheck,
  ShoppingCart,
  Timer,
  UserCheck,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { ImportantNotificationBanner } from "@/components/shared/ImportantNotificationBanner";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DateRangeFilter, type DateRangeValue } from "@/components/shared/DateRangeFilter";
import {
  GroupedActivityChart,
  HorizontalJobsBar,
  JobsByStatusDoughnut,
  StackedRevenueChart,
} from "@/components/charts/DashboardCharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import {
  api,
  type BackendNotification,
  type DashboardData,
  type DashboardQueueItem,
} from "@/lib/api";
import { defaultDateRange } from "@/lib/charts";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatJobStatus,
  formatRelativeTime,
} from "@/lib/format";
import { getImportantNotifications } from "@/lib/notificationPriority";
import { emitNotificationsUpdated, NOTIFICATIONS_UPDATED } from "@/lib/notifications-events";
import { roleLabels } from "@/data/mock";
import type { Role } from "@/data/types";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { TICKET_CREATE_ROLES } from "@/config/roles";
import { userCanAccessPath } from "@/lib/userRoles";

const DISMISSED_IMPORTANT_KEY = "mesms:dashboard-dismissed-important";

const notificationIconMap = {
  amc: ShieldCheck,
  stock: AlertTriangle,
  approval: FileCheck,
  job: Wrench,
  system: Cog,
} as const;

function readDismissedImportantIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(DISMISSED_IMPORTANT_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? new Set(parsed.filter((id): id is string => typeof id === "string")) : new Set();
  } catch {
    return new Set();
  }
}

function writeDismissedImportantIds(ids: Set<string>) {
  try {
    sessionStorage.setItem(DISMISSED_IMPORTANT_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore storage errors
  }
}

const JOB_STATUS_ACTIONS = [
  { value: "scheduled", label: "Assigned" },
  { value: "inProgress", label: "In Progress" },
  { value: "partsPending", label: "Waiting for Spare Parts" },
  { value: "review", label: "Submit for QA" },
  { value: "delivery", label: "QA Pass → Delivery" },
  { value: "completed", label: "Confirm Delivery" },
] as const;

type QuickAction = { label: string; to: string; icon: LucideIcon };

function roleQuickActions(role: Role): QuickAction[] {
  switch (role) {
    case "inspector":
      return [
        { label: "Assigned Inspections", to: "/app/inspections", icon: Search },
        { label: "Service Tickets", to: "/app/service-tickets", icon: ClipboardList },
        { label: "QR Scanner", to: "/app/qr-tracking", icon: QrCode },
        { label: "Notifications", to: "/app/notifications", icon: Bell },
      ];
    case "estimator":
      return [
        { label: "Pending Estimates", to: "/app/estimates", icon: FileText },
        { label: "Service Tickets", to: "/app/service-tickets", icon: ClipboardList },
        { label: "Customers", to: "/app/customers", icon: FileText },
        { label: "Notifications", to: "/app/notifications", icon: Bell },
      ];
    case "sales":
      return [
        { label: "Sales Desk", to: "/app/sales", icon: ShoppingCart },
        { label: "New Sale", to: "/app/sales/new", icon: ShoppingCart },
        { label: "Customers", to: "/app/customers", icon: FileText },
        { label: "Service Tickets", to: "/app/service-tickets", icon: ClipboardList },
        { label: "Notifications", to: "/app/notifications", icon: Bell },
      ];
    case "engineer":
      return [
        { label: "Assigned Jobs", to: "/app/jobs", icon: Wrench },
        { label: "Request Parts", to: "/app/jobs", icon: Package },
        { label: "Inventory", to: "/app/inventory", icon: Package },
        { label: "QR Scanner", to: "/app/qr-tracking", icon: QrCode },
        { label: "Service Tickets", to: "/app/service-tickets", icon: ClipboardList },
      ];
    case "inventory":
      return [
        { label: "Low Stock", to: "/app/stock-purchase-requests", icon: AlertTriangle },
        { label: "Purchase", to: "/app/rfqs", icon: ShoppingCart },
        { label: "Purchase Returns", to: "/app/purchase-returns", icon: Package },

        { label: "Notifications", to: "/app/notifications", icon: Bell },
      ];
    case "billing":
      return [
        { label: "Pending Bills", to: "/app/billing", icon: Receipt },
        { label: "Sales Desk", to: "/app/sales", icon: ShoppingCart },
        { label: "Estimates", to: "/app/estimates", icon: FileText },
        { label: "Reports", to: "/app/reports", icon: IndianRupee },
      ];
    case "coordinator":
      return [
        { label: "New Request", to: "/app/service-requests", icon: ClipboardList },
        { label: "Schedule Job", to: "/app/jobs", icon: CalendarClock },
        { label: "Inspections", to: "/app/inspections", icon: Search },
        { label: "Estimates", to: "/app/estimates", icon: FileText },
        { label: "QR Tracking", to: "/app/qr-tracking", icon: QrCode },
      ];
    case "qa":
      return [
        { label: "QA Pending", to: "/app/jobs?saved=approval&status=review", icon: FileCheck },
        { label: "QA History", to: "/app/jobs?saved=history&qaScope=history", icon: CheckCircle2 },
        { label: "Service Jobs", to: "/app/jobs", icon: Wrench },
        { label: "Service Tickets", to: "/app/service-tickets", icon: ClipboardList },
        { label: "Notifications", to: "/app/notifications", icon: Bell },
      ];
    case "admin":
    default:
      return [
        { label: "Service Tickets", to: "/app/service-tickets", icon: ClipboardList },
        { label: "Jobs", to: "/app/jobs", icon: Wrench },
        { label: "Sales", to: "/app/sales", icon: ShoppingCart },
        { label: "Inventory", to: "/app/inventory", icon: Package },
        { label: "Billing", to: "/app/billing", icon: Receipt },
        { label: "Users", to: "/app/users", icon: UserCheck },
        { label: "Reports", to: "/app/reports", icon: IndianRupee },
      ];
  }
}

function overviewCards(role: Role, data: DashboardData) {
  const { stats, personal } = data;

  switch (role) {
    case "inspector":
      return [
        { label: "Assigned Inspections", value: String(personal.assignedOpen), icon: Search, accent: "primary" as const },
        { label: "Due Today", value: String(personal.dueToday), icon: Timer, accent: "warning" as const },
        { label: "Overdue", value: String(personal.overdue), icon: AlertTriangle, accent: "destructive" as const },
        { label: "In Progress", value: String(personal.inProgress), icon: Clock, accent: "accent" as const },
      ];
    case "estimator":
      return [
        { label: "Pending Estimates", value: String(stats.pendingEstimates), icon: FileText, accent: "primary" as const },
        { label: "Awaiting Approval", value: String(personal.pendingApprovals), icon: Clock, accent: "warning" as const },
        { label: "Approved", value: String(personal.completedThisMonth), icon: CheckCircle2, accent: "success" as const },
        { label: "Unread Alerts", value: String(stats.unreadNotifications), icon: Bell, accent: "accent" as const },
      ];
    case "sales":
      return [
        { label: "Pending Bills", value: String(stats.pendingInvoices), icon: Receipt, accent: "primary" as const },
        { label: "Overdue Payments", value: String(stats.overdueInvoices), icon: AlertTriangle, accent: "destructive" as const },
        { label: "Revenue (MTD)", value: stats.revenueMtdLabel, icon: IndianRupee, accent: "success" as const, trend: data.trends.revenue },
        { label: "Unread Alerts", value: String(stats.unreadNotifications), icon: Bell, accent: "accent" as const },
      ];
    case "engineer":
      return [
        { label: "Assigned Jobs", value: String(personal.assignedOpen || stats.activeJobs), icon: Wrench, accent: "primary" as const },
        { label: "In Progress", value: String(personal.inProgress), icon: Clock, accent: "accent" as const },
        { label: "Due Today", value: String(personal.dueToday), icon: CalendarClock, accent: "warning" as const },
        { label: "Completed (MTD)", value: String(personal.completedThisMonth), icon: CheckCircle2, accent: "success" as const },
      ];
    case "inventory":
      return [
        { label: "Low Stock Alerts", value: String(stats.lowStockItems), icon: AlertTriangle, accent: "warning" as const },
        { label: "Parts Requests", value: String(stats.pendingPartsRequests), icon: Package, accent: "primary" as const },
        { label: "Open POs", value: String(stats.openPurchaseOrders), icon: ShoppingCart, accent: "accent" as const },
        { label: "Transfers", value: String(stats.pendingTransfers), icon: Package, accent: "destructive" as const },
      ];
    case "billing":
      return [
        { label: "Pending Bills", value: String(stats.pendingInvoices), icon: Receipt, accent: "primary" as const },
        { label: "Overdue Payments", value: String(stats.overdueInvoices), icon: AlertTriangle, accent: "destructive" as const },
        { label: "Revenue (MTD)", value: stats.revenueMtdLabel, icon: IndianRupee, accent: "success" as const, trend: data.trends.revenue },
        { label: "Pending Estimates", value: String(stats.pendingEstimates), icon: FileText, accent: "warning" as const },
      ];
    case "coordinator":
      return [
        { label: "Open Requests", value: String(stats.openRequests), icon: ClipboardList, accent: "primary" as const },
        { label: "Unassigned", value: String(stats.unassignedRequests), icon: UserCheck, accent: "warning" as const },
        { label: "Active Jobs", value: String(stats.activeJobs), icon: Wrench, accent: "accent" as const, trend: data.trends.activeJobs },
        { label: "Due Today", value: String(personal.dueToday), icon: Timer, accent: "destructive" as const },
      ];
    case "qa":
      return [
        { label: "QA Pending", value: String(personal.pendingApprovals || personal.assignedOpen), icon: FileCheck, accent: "warning" as const },
        { label: "Overdue Review", value: String(personal.overdue), icon: AlertTriangle, accent: "destructive" as const },
        { label: "Due Today", value: String(personal.dueToday), icon: Timer, accent: "accent" as const },
        { label: "Reviewed (MTD)", value: String(personal.completedThisMonth), icon: CheckCircle2, accent: "success" as const },
      ];
    case "admin":
    default:
      return [
        { label: "Open Requests", value: String(stats.openRequests), icon: ClipboardList, accent: "primary" as const },
        { label: "Active Jobs", value: String(stats.activeJobs), icon: Wrench, accent: "accent" as const, trend: data.trends.activeJobs },
        { label: "Low Stock", value: String(stats.lowStockItems), icon: AlertTriangle, accent: "warning" as const },
        { label: "Revenue (MTD)", value: stats.revenueMtdLabel, icon: IndianRupee, accent: "success" as const, trend: data.trends.revenue },
      ];
  }
}

function queueTitle(role: Role) {
  switch (role) {
    case "inspector":
      return "Assigned Inspections";
    case "estimator":
      return "Estimate Workload";
    case "sales":
      return "Sales Workload";
    case "engineer":
      return "My Assigned Jobs";
    case "inventory":
      return "Supply Chain Queue";
    case "billing":
      return "Billing Queue";
    case "coordinator":
      return "Operations Queue";
    case "qa":
      return "QA Pending Work";
    default:
      return "Company Workload";
  }
}

function QueueRow({
  item,
  onOpen,
  actions,
}: {
  item: DashboardQueueItem;
  onOpen: () => void;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-border p-3 transition-colors hover:bg-muted/40">
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{item.reference}</span>
          <StatusBadge status={item.status} className="text-[10px]" />
          {item.priority ? <StatusBadge status={item.priority} /> : null}
        </div>
        <p className="mt-0.5 truncate text-sm font-medium">{item.title}</p>
        <p className="text-xs text-muted-foreground">{item.subtitle}</p>
        {item.dueAt ? (
          <p className="mt-1 text-[11px] text-muted-foreground">Due {formatDate(item.dueAt)}</p>
        ) : null}
        {typeof item.progress === "number" ? (
          <Progress value={item.progress} className="mt-2 h-1.5" />
        ) : null}
      </button>
      {actions}
    </div>
  );
}

export default function Dashboard() {
  const { user, hasRole } = useAuth();
  const { rbacMatrix } = useSettings();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [notifications, setNotifications] = useState<BackendNotification[]>([]);
  const [dismissedImportantIds, setDismissedImportantIds] = useState<Set<string>>(() => readDismissedImportantIds());
  const [loading, setLoading] = useState(true);
  const [updatingJobId, setUpdatingJobId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => defaultDateRange(29));

  const role = (user?.role ?? "admin") as Role;

  const loadDashboard = useCallback(async (range: DateRangeValue) => {
    setLoading(true);
    try {
      const [overview, notifs] = await Promise.all([
        api.getDashboard({ from: range.from, to: range.to }),
        api.listNotifications(),
      ]);
      setData(overview);
      setNotifications(notifs);
    } catch (err) {
      toast.apiError(err, { fallback: "Failed to load dashboard" });
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    try {
      const notifs = await api.listNotifications();
      setNotifications(notifs);
    } catch {
      // keep existing list if refresh fails
    }
  }, []);

  useEffect(() => {
    void loadDashboard(dateRange);
  }, [loadDashboard, dateRange]);

  useEffect(() => {
    const onUpdated = () => {
      void refreshNotifications();
    };
    window.addEventListener(NOTIFICATIONS_UPDATED, onUpdated);
    return () => window.removeEventListener(NOTIFICATIONS_UPDATED, onUpdated);
  }, [refreshNotifications]);

  const cards = useMemo(() => (data ? overviewCards(role, data) : []), [data, role]);
  const actions = useMemo(() => {
    if (!user) return [];
    return roleQuickActions(role).filter((action) => userCanAccessPath(user, action.to, rbacMatrix));
  }, [role, user, rbacMatrix]);
  const canCreateTicket = hasRole(TICKET_CREATE_ROLES);

  const importantBanner = useMemo(() => {
    const important = getImportantNotifications(notifications, 5);
    return important.find((n) => !dismissedImportantIds.has(n.id)) ?? null;
  }, [notifications, dismissedImportantIds]);

  const recentNotifications = useMemo(
    () =>
      [...notifications]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5),
    [notifications],
  );

  const unreadNotificationCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const dismissImportant = (id: string) => {
    setDismissedImportantIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      writeDismissedImportantIds(next);
      return next;
    });
  };

  const openNotification = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await api.markNotificationRead(id);
      emitNotificationsUpdated();
    } catch {
      void refreshNotifications();
    }
    navigate("/app/notifications");
  };

  const activity = data?.activityTrend ?? data?.revenueTrend.map((row) => ({
    label: row.month,
    key: row.month,
    jobs: row.jobs,
    tickets: 0,
    revenue: row.revenue,
    saleRevenue: row.saleRevenue ?? 0,
    serviceRevenue: row.serviceRevenue ?? 0,
  })) ?? [];

  const updateJobStatus = async (jobId: string, status: string) => {
    setUpdatingJobId(jobId);
    try {
      const progress =
        status === "completed"
          ? 100
          : status === "delivery"
            ? 95
            : status === "inProgress"
              ? 40
              : status === "partsPending"
                ? 55
                : status === "review"
                  ? 85
                  : 10;
      await api.updateJob(jobId, { status, progress });
      toast({
        title: "Work status updated",
        description: `Moved to ${JOB_STATUS_ACTIONS.find((s) => s.value === status)?.label ?? status}.`,
      });
      await loadDashboard(dateRange);
    } catch (err) {
      toast.apiError(err, { fallback: "Could not update job status" });
    } finally {
      setUpdatingJobId(null);
    }
  };

  if (!user) return null;

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-52" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[108px] rounded-lg" />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          <Skeleton className="h-72 rounded-lg xl:col-span-2" />
          <Skeleton className="h-72 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <PageHeader title="Dashboard" description="Unable to load overview" />
        <Button onClick={() => void loadDashboard(dateRange)}>Retry</Button>
      </div>
    );
  }

  const showFinance = data.visibility.showFinance;
  const showCharts = data.visibility.showCharts;
  const showSchedule = data.visibility.showSchedule;
  const canUpdateJobStatus = data.visibility.canUpdateJobStatus && role === "engineer";
  const periodLabel = data.period
    ? `${formatDate(data.period.from)} – ${formatDate(data.period.to)}`
    : `${formatDate(dateRange.from)} – ${formatDate(dateRange.to)}`;
  const periodMode = data.period?.mode === "monthly" ? "Monthly" : "Daily";

  return (
    <div className="space-y-6">
      {importantBanner ? (
        <ImportantNotificationBanner
          notification={importantBanner}
          onDismiss={dismissImportant}
          onOpen={(id) => void openNotification(id)}
        />
      ) : null}

      <PageHeader
        title={`Welcome back, ${user.name.split(" ")[0]}`}
        description={`${roleLabels[role]} · role-based work overview`}
        actions={
          canCreateTicket ? (
            <Button onClick={() => navigate("/app/service-tickets")} variant="brand">
              New Service Ticket
            </Button>
          ) : (
            <Button onClick={() => navigate(actions[0]?.to ?? "/app/notifications")} variant="brand">
              Open {actions[0]?.label ?? "Workspace"}
            </Button>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={card.value}
            icon={card.icon}
            accent={card.accent}
            trend={"trend" in card ? card.trend : undefined}
          />
        ))}
      </div>

      {(role === "admin" || role === "coordinator" || role === "inspector" || role === "estimator" || role === "engineer") && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Work Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {[
                { label: "New Assigned", value: data.roleQueues.newAssigned, to: "/app/service-tickets?status=new&view=table" },
                { label: "Inspection", value: data.roleQueues.inspection, to: "/app/service-tickets?status=inspection&view=table" },
                { label: "Estimate Pending", value: data.roleQueues.estimatePending, to: "/app/service-tickets?status=estimate&view=table" },
                { label: "Waiting Approval", value: data.roleQueues.waitingApproval, to: "/app/service-tickets?status=approval&view=table" },
                { label: "Service Pending", value: data.roleQueues.servicePending, to: "/app/service-tickets?status=in-progress&view=table" },
                { label: "Completed (MTD)", value: data.roleQueues.completed, to: "/app/service-tickets?status=completed&view=table" },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => navigate(item.to)}
                  className="rounded-md border border-border bg-muted/30 px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">{item.value}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {role === "qa" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>QA Work Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  label: "QA Pending",
                  value: data.roleQueues.waitingApproval,
                  to: "/app/jobs?saved=approval&status=review",
                  hint: "Jobs awaiting review",
                },
                {
                  label: "Completed History",
                  value: data.roleQueues.completed,
                  to: "/app/jobs?saved=history&qaScope=history",
                  hint: "Pass / fail reviews (MTD)",
                },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => navigate(item.to)}
                  className="rounded-md border border-border bg-muted/30 px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">{item.value}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{item.hint}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className={cn("shadow-card", role !== "qa" && "xl:col-span-2")}>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">{queueTitle(role)}</CardTitle>
              <Badge variant="secondary">{data.myQueue.length}</Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                navigate(
                  role === "qa"
                    ? "/app/jobs?saved=approval&status=review"
                    : (actions[0]?.to ?? data.myQueue[0]?.href ?? "/app"),
                )
              }
            >
              View all <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.myQueue.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {role === "qa"
                  ? "No jobs waiting for QA review."
                  : "No assigned work in your queue right now."}
              </p>
            ) : (
              data.myQueue.slice(0, 8).map((item) => (
                <QueueRow
                  key={`${item.kind}-${item.id}`}
                  item={item}
                  onOpen={() => navigate(item.href)}
                  actions={
                    canUpdateJobStatus && item.kind === "job" ? (
                      <div className="flex max-w-[11rem] flex-col gap-1">
                        {JOB_STATUS_ACTIONS.filter(
                          (s) =>
                            s.value !== "completed" &&
                            formatJobStatus(s.value) !== item.status,
                        )
                          .slice(0, 3)
                          .map((s) => (
                          <Button
                            key={s.value}
                            size="sm"
                            variant="outline"
                            className="h-7 justify-start px-2 text-[11px]"
                            disabled={updatingJobId === item.id}
                            onClick={() => void updateJobStatus(item.id, s.value)}
                          >
                            {updatingJobId === item.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                            {s.label}
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" />
                    )
                  }
                />
              ))
            )}
          </CardContent>
        </Card>

        {role === "qa" ? (
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">Completed History</CardTitle>
                <Badge variant="secondary">{(data.historyQueue ?? []).length}</Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/app/jobs?saved=history&qaScope=history")}
              >
                View all <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {(data.historyQueue ?? []).length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No completed QA reviews yet.
                </p>
              ) : (
                (data.historyQueue ?? []).slice(0, 8).map((item) => (
                  <QueueRow
                    key={`history-${item.kind}-${item.id}`}
                    item={item}
                    onOpen={() => navigate(item.href)}
                    actions={<ArrowRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" />}
                  />
                ))
              )}
            </CardContent>
          </Card>
        ) : null}

        <div className="space-y-6">
          {actions.length > 0 ? (
          <Card className="shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {actions.map((action) => (
                <Button
                  key={action.label}
                  variant="outline"
                  className="justify-start gap-2"
                  onClick={() => navigate(action.to)}
                >
                  <action.icon className="h-4 w-4 text-primary" />
                  {action.label}
                </Button>
              ))}
            </CardContent>
          </Card>
          ) : null}

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">Notifications</CardTitle>
              </div>
              {unreadNotificationCount > 0 ? (
                <Badge variant="secondary">{unreadNotificationCount} new</Badge>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-2">
              {recentNotifications.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">
                  No notifications yet. Assignments, approvals, and stock alerts will appear here.
                </p>
              ) : (
                <div className="space-y-2">
                  {recentNotifications.map((n) => {
                    const Icon = notificationIconMap[n.type] ?? Bell;
                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => void openNotification(n.id)}
                        className={cn(
                          "flex w-full items-start gap-2.5 rounded-md border border-border px-2.5 py-2 text-left transition-colors hover:bg-muted/40",
                          !n.read && "border-primary/25 bg-primary/[0.03]",
                        )}
                      >
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-sm font-medium">{n.title}</p>
                            {!n.read ? (
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                            ) : null}
                          </div>
                          <p className="line-clamp-1 text-xs text-muted-foreground">{n.body}</p>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            {formatRelativeTime(n.createdAt)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              <Button variant="ghost" size="sm" className="px-0" onClick={() => navigate("/app/notifications")}>
                Open notification center <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {showSchedule && (role === "engineer" || data.todaySchedule.length > 0 || data.upcomingJobs.length > 0) && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center gap-2 pb-3">
              <CalendarClock className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Today&apos;s Schedule</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.todaySchedule.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No jobs scheduled for today.</p>
              ) : (
                data.todaySchedule.map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => navigate(job.href)}
                    className="flex w-full items-center justify-between rounded-lg border border-border p-3 text-left hover:bg-muted/30"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{job.reference}</span>
                        <StatusBadge status={job.status} className="text-[10px]" />
                      </div>
                      <p className="truncate text-sm font-medium">{job.title}</p>
                      <p className="text-xs text-muted-foreground">{job.subtitle}</p>
                    </div>
                    <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center gap-2 pb-3">
              <Clock className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Upcoming Jobs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.upcomingJobs.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No upcoming scheduled jobs.</p>
              ) : (
                data.upcomingJobs.map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => navigate(job.href)}
                    className="w-full rounded-lg border border-border p-3 text-left hover:bg-muted/30"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{job.reference}</span>
                      <StatusBadge status={job.status} className="text-[10px]" />
                    </div>
                    <p className="mt-0.5 text-sm font-medium">{job.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {job.subtitle} · {formatDate(job.scheduledFor)}
                    </p>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {showCharts && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold">Visual reports</h2>
            <p className="text-xs text-muted-foreground">
              {periodMode} recorded data · {periodLabel}
              {loading ? " · refreshing…" : ""}
            </p>
          </div>

          <DateRangeFilter value={dateRange} onChange={setDateRange} />

          {data.period?.totals ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
                <p className="text-xs text-muted-foreground">Jobs in range</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{data.period.totals.jobs}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
                <p className="text-xs text-muted-foreground">Tickets opened</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{data.period.totals.tickets}</p>
              </div>
              {showFinance ? (
                <>
                  <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
                    <p className="text-xs text-muted-foreground">Sale billing</p>
                    <p className="mt-1 text-xl font-semibold tabular-nums">{formatCurrency(data.period.totals.saleRevenue)}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
                    <p className="text-xs text-muted-foreground">Service billing</p>
                    <p className="mt-1 text-xl font-semibold tabular-nums">{formatCurrency(data.period.totals.serviceRevenue)}</p>
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5 sm:col-span-2">
                  <p className="text-xs text-muted-foreground">Total activity</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">
                    {data.period.totals.jobs + data.period.totals.tickets}
                  </p>
                </div>
              )}
            </div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="shadow-card lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {showFinance ? "Stacked billing · sale vs service" : "Jobs created over time"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {showFinance ? (
                  <StackedRevenueChart
                    labels={activity.map((r) => r.label)}
                    saleRevenue={activity.map((r) => r.saleRevenue)}
                    serviceRevenue={activity.map((r) => r.serviceRevenue)}
                  />
                ) : (
                  <GroupedActivityChart
                    labels={activity.map((r) => r.label)}
                    jobs={activity.map((r) => r.jobs)}
                    tickets={activity.map((r) => r.tickets)}
                  />
                )}
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Jobs by status</CardTitle>
              </CardHeader>
              <CardContent>
                <JobsByStatusDoughnut rows={data.jobsByStatus ?? []} />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Daily activity · jobs & tickets</CardTitle>
              </CardHeader>
              <CardContent>
                <GroupedActivityChart
                  labels={activity.map((r) => r.label)}
                  jobs={activity.map((r) => r.jobs)}
                  tickets={activity.map((r) => r.tickets)}
                />
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Jobs by type</CardTitle>
              </CardHeader>
              <CardContent>
                <HorizontalJobsBar rows={data.jobsByType} />
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="shadow-card lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              {role === "engineer" ? "My Active Jobs" : data.visibility.showCompanyOps ? "Active Service Jobs" : "Recent Queue"}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate(role === "billing" ? "/app/billing" : "/app/jobs")}>
              View all <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.activeJobs.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No active jobs right now</p>
            ) : (
              data.activeJobs.map((j) => (
                <div
                  key={j.id}
                  className="flex cursor-pointer items-center gap-4 rounded-lg border border-border p-3 hover:bg-muted/30"
                  onClick={() => navigate("/app/jobs")}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{j.equipmentName}</p>
                      <StatusBadge status={j.status} />
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {j.reference} · {j.customerName} · {j.engineer}
                    </p>
                    <Progress value={j.progress} className="mt-2 h-1.5" />
                  </div>
                  <span className="text-sm font-semibold text-muted-foreground">{j.progress}%</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Recent Activities</CardTitle>
            </CardHeader>
            <CardContent>
              {data.recentActivity.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No recent activity</p>
              ) : (
                <ol className="relative space-y-4 border-l border-border pl-4">
                  {data.recentActivity.map((t) => (
                    <li key={t.id} className="relative">
                      <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
                      <p className="text-sm font-medium">{t.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.actor} · {formatDateTime(t.at)}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          {data.visibility.showInventoryAlerts && data.lowStock.length > 0 && (
            <Card className={cn("shadow-card", "border-warning/30 bg-warning/5")}>
              <CardHeader className="flex flex-row items-center gap-2 pb-2">
                <AlertTriangle className="h-4 w-4 text-warning-foreground" />
                <CardTitle className="text-base">Inventory Alerts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.lowStock.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    className="flex w-full items-center justify-between text-sm hover:underline"
                    onClick={() => navigate("/app/inventory")}
                  >
                    <span className="truncate">{i.name}</span>
                    <span className="font-medium text-warning-foreground">
                      {i.inStock}/{i.reorderLevel}
                    </span>
                  </button>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
