import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ClipboardList,
  Wrench,
  AlertTriangle,
  IndianRupee,
  ShieldAlert,
  ArrowRight,
  Clock,
  Loader2,
  UserCheck,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import { useBranch } from "@/context/BranchContext";
import { api, type DashboardData, type BackendServiceRequest, type BackendServiceJob } from "@/lib/api";
import { formatCurrency, formatDateTime, formatServiceStatus, formatJobStatus } from "@/lib/format";
import { roleLabels } from "@/data/mock";
import { toast } from "@/hooks/use-toast";

const STAFF_ROLES = ["inspector", "estimator", "engineer", "inventory", "billing"];

const JOB_STATUS_COLOR: Record<string, string> = {
  scheduled: "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400",
  "in-progress": "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  "parts-pending": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  review: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

const STATUS_COLOR: Record<string, string> = {
  new: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  inspection: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  estimate: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  approval: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  "in-progress": "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  invoiced: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
};

export default function Dashboard() {
  const { user } = useAuth();
  const { branchId } = useBranch();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [myAssignments, setMyAssignments] = useState<BackendServiceRequest[]>([]);
  const [myJobs, setMyJobs] = useState<BackendServiceJob[]>([]);

  const isStaffRole = user ? STAFF_ROLES.includes(user.role) : false;
  const isEngineer = user?.role === "engineer";

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const overview = await api.getDashboard(branchId);
      setData(overview);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to load dashboard";
      toast({ title: "Error", description: message, variant: "destructive" });
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  const loadAssignments = useCallback(async () => {
    if (!isStaffRole) return;
    try {
      const requests = await api.listServiceRequests({ branchId });
      setMyAssignments(requests.filter((r) => r.status !== "completed" && r.status !== "invoiced"));
    } catch {
      setMyAssignments([]);
    }
  }, [branchId, isStaffRole]);

  const loadMyJobs = useCallback(async () => {
    if (!isEngineer) return;
    try {
      const jobs = await api.listJobs();
      setMyJobs(jobs.filter((j) => j.status !== "completed"));
    } catch {
      setMyJobs([]);
    }
  }, [isEngineer]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    void loadAssignments();
  }, [loadAssignments]);

  useEffect(() => {
    void loadMyJobs();
  }, [loadMyJobs]);

  if (!user) return null;

  const showFinance = user.role === "admin" || user.role === "billing";

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading dashboard…
      </div>
    );
  }

  const stats = data?.stats ?? {
    openRequests: 0,
    activeJobs: 0,
    lowStockItems: 0,
    revenueMtd: 0,
    revenueMtdLabel: "₹0",
    expiringAmc: 0,
  };
  const trends = data?.trends;
  const revenueTrend = data?.revenueTrend ?? [];
  const jobsByType = data?.jobsByType ?? [];
  const activeJobs = data?.activeJobs ?? [];
  const recentActivity = data?.recentActivity ?? [];
  const lowStock = data?.lowStock ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${user.name.split(" ")[0]}`}
        description={`${roleLabels[user.role]} · operations overview for today`}
        actions={
          <Button onClick={() => navigate("/app/service-requests")} className="bg-gradient-primary text-primary-foreground hover:opacity-90">
            New Service Request
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Open Requests"
          value={String(stats.openRequests)}
          icon={ClipboardList}
          trend={trends?.openRequests}
          accent="primary"
        />
        <StatCard
          label="Active Jobs"
          value={String(stats.activeJobs)}
          icon={Wrench}
          trend={trends?.activeJobs}
          accent="accent"
        />
        <StatCard
          label="Low Stock Items"
          value={String(stats.lowStockItems)}
          icon={AlertTriangle}
          accent="warning"
        />
        {showFinance ? (
          <StatCard
            label="Revenue (MTD)"
            value={stats.revenueMtdLabel}
            icon={IndianRupee}
            trend={trends?.revenue}
            accent="success"
          />
        ) : (
          <StatCard
            label="Expiring AMC"
            value={String(stats.expiringAmc)}
            icon={ShieldAlert}
            accent="destructive"
          />
        )}
      </div>

      {/* My Service Jobs — shown for service engineers */}
      {isEngineer && (
        <Card className="shadow-card border-accent/30">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-accent" />
              <CardTitle className="text-base">My Service Jobs</CardTitle>
              <Badge variant="secondary">{myJobs.length}</Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/app/jobs")}>
              View all <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            {myJobs.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No service jobs assigned to you.</p>
            ) : (
              <div className="space-y-2">
                {myJobs.slice(0, 8).map((j) => {
                  const statusKey = formatJobStatus(j.status);
                  const colorClass = JOB_STATUS_COLOR[statusKey] ?? "";
                  return (
                    <div
                      key={j.id}
                      onClick={() => navigate("/app/jobs")}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-muted-foreground">{j.reference}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${colorClass}`}>
                            {statusKey.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-sm font-medium">{j.equipmentName}</p>
                        <p className="text-xs text-muted-foreground">{j.customerName} · {j.type}</p>
                        <Progress value={j.progress} className="mt-2 h-1.5" />
                      </div>
                      <span className="text-sm font-semibold text-muted-foreground shrink-0">{j.progress}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* My Assignments — shown only for staff roles (non-engineer focus) */}
      {isStaffRole && !isEngineer && (
        <Card className="shadow-card border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">My Assignments</CardTitle>
              <Badge variant="secondary">{myAssignments.length}</Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/app/service-requests")}>
              View all <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            {myAssignments.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No work currently assigned to you.</p>
            ) : (
              <div className="space-y-2">
                {myAssignments.slice(0, 6).map((r) => {
                  const statusKey = formatServiceStatus(r.status);
                  const colorClass = STATUS_COLOR[statusKey] ?? "";
                  const allEquip = r.equipmentItems?.length
                    ? r.equipmentItems.map((e) => e.equipmentName).join(", ")
                    : (r.equipmentName ?? "Equipment");
                  return (
                    <div
                      key={r.id}
                      onClick={() => navigate("/app/service-requests")}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-muted-foreground">{r.reference}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${colorClass}`}>
                            {statusKey.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                          </span>
                          <StatusBadge status={r.priority} />
                        </div>
                        <p className="mt-0.5 truncate text-sm font-medium">{allEquip}</p>
                        <p className="text-xs text-muted-foreground">{r.customerName} · {r.type}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="shadow-card lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{showFinance ? "Revenue & Job Volume" : "Job Volume"}</CardTitle>
            <span className="text-xs text-muted-foreground">Last 6 months</span>
          </CardHeader>
          <CardContent>
            {revenueTrend.length === 0 ? (
              <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
                No job or revenue data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={revenueTrend} margin={{ left: -16, right: 8 }}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }}
                    formatter={(v: number, n: string) => (n === "revenue" ? [formatCurrency(v), "Revenue"] : [v, "Jobs"])}
                  />
                  <Area type="monotone" dataKey={showFinance ? "revenue" : "jobs"} stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#rev)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Jobs by Type</CardTitle>
          </CardHeader>
          <CardContent>
            {jobsByType.length === 0 ? (
              <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
                No jobs recorded yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={jobsByType} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="type" width={84} stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }} cursor={{ fill: "hsl(var(--muted))" }} />
                  <Bar dataKey="count" fill="hsl(var(--accent))" radius={[0, 6, 6, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="shadow-card lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{isEngineer ? "My Active Jobs" : "Active Service Jobs"}</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/app/jobs")}>
              View all <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {(isEngineer ? myJobs : activeJobs).length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No active jobs right now</p>
            ) : (
              (isEngineer ? myJobs : activeJobs).map((j) => (
                <div key={j.id} className="flex items-center gap-4 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/30" onClick={() => navigate("/app/jobs")}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{j.equipmentName}</p>
                      <StatusBadge status={isEngineer ? formatJobStatus(j.status) : j.status} />
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
              <CardTitle className="text-base">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {recentActivity.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No recent activity</p>
              ) : (
                <ol className="relative space-y-4 border-l border-border pl-4">
                  {recentActivity.map((t) => (
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

          {lowStock.length > 0 && (
            <Card className="border-warning/30 bg-warning/5 shadow-card">
              <CardHeader className="flex flex-row items-center gap-2 pb-2">
                <AlertTriangle className="h-4 w-4 text-warning-foreground" />
                <CardTitle className="text-base">Low Stock Alerts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {lowStock.map((i) => (
                  <div key={i.id} className="flex items-center justify-between text-sm">
                    <span className="truncate">{i.name}</span>
                    <span className="font-medium text-warning-foreground">
                      {i.inStock}/{i.reorderLevel}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
