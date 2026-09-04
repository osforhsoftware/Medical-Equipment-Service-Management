import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { IndianRupee, Loader2, Receipt, ShoppingBag, Wrench } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/shared/StatCard";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { useAuth } from "@/context/AuthContext";
import { ApiError, api } from "@/lib/api";
import { formatCurrency, formatCurrencyShort } from "@/lib/format";

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--info))"];

function ReportList({
  title,
  rows,
}: {
  title: string;
  rows?: { name: string; quantity: number; amount: number }[];
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows?.length ? (
          rows.slice(0, 8).map((row) => (
            <div key={row.name} className="flex justify-between gap-3 text-sm">
              <span className="truncate">{row.name}</span>
              <span className="shrink-0 tabular-nums">{formatCurrency(row.amount)}</span>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No data yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function Reports() {
  const { hasRole } = useAuth();
  const showServiceSplit = hasRole(["admin", "billing", "coordinator"]);

  const dashboardQuery = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.getDashboard(),
  });
  const salesQuery = useQuery({
    queryKey: ["sales", "reports"],
    queryFn: () => api.getSalesReports(),
  });

  const dashboard = dashboardQuery.data;
  const sales = salesQuery.data;
  const loading = dashboardQuery.isLoading || salesQuery.isLoading;
  const error = dashboardQuery.error || salesQuery.error;

  const channelChart = useMemo(() => {
    const sale = dashboard?.stats.saleRevenueMtd ?? sales?.monthlySales ?? 0;
    const service = dashboard?.stats.serviceRevenueMtd ?? 0;
    const other = dashboard?.stats.otherRevenueMtd ?? 0;
    return [
      { type: "Product sales", count: sale },
      { type: "Service billing", count: service },
      { type: "Other", count: other },
    ].filter((row) => row.count > 0);
  }, [dashboard, sales]);

  return (
    <RoleGuard roles={["admin", "billing", "coordinator"]}>
      <div className="space-y-6">
        <PageHeader
          title="Reports & Analytics"
          description="Live sale billing and service billing stay on separate tracks. Admin sees both."
        />

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading reports…
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">
            {error instanceof ApiError ? error.message : "Unable to load reports"}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Today's sales" value={formatCurrencyShort(sales?.dailySales ?? 0)} icon={IndianRupee} accent="success" />
          <StatCard label="Monthly sales" value={formatCurrencyShort(sales?.monthlySales ?? 0)} icon={ShoppingBag} />
          <StatCard label="Sale collected" value={formatCurrencyShort(sales?.collected ?? 0)} icon={Receipt} accent="success" />
          <StatCard
            label="Sale outstanding"
            value={formatCurrencyShort(sales?.outstandingTotal ?? 0)}
            icon={IndianRupee}
            accent="warning"
          />
        </div>

        {showServiceSplit ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Sale billing (MTD)"
              value={formatCurrencyShort(dashboard?.stats.saleRevenueMtd ?? 0)}
              icon={ShoppingBag}
            />
            <StatCard
              label="Service billing (MTD)"
              value={formatCurrencyShort(dashboard?.stats.serviceRevenueMtd ?? 0)}
              icon={Wrench}
            />
            <StatCard
              label="Other billing (MTD)"
              value={formatCurrencyShort(dashboard?.stats.otherRevenueMtd ?? 0)}
              icon={Receipt}
            />
            <StatCard
              label="All collected (MTD)"
              value={dashboard?.stats.revenueMtdLabel ?? "—"}
              icon={IndianRupee}
              accent="success"
            />
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="shadow-card">
            <CardHeader><CardTitle className="text-base">Revenue Trend</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={dashboard?.revenueTrend ?? []} margin={{ left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }} formatter={(v: number) => [formatCurrency(v), "Revenue"]} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">{showServiceSplit ? "Sale vs service billing" : "Sales mix"}</CardTitle>
            </CardHeader>
            <CardContent>
              {(showServiceSplit ? channelChart : dashboard?.jobsByType ?? []).length ? (
                <>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={showServiceSplit ? channelChart : dashboard?.jobsByType ?? []}
                        dataKey="count"
                        nameKey="type"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={3}
                      >
                        {(showServiceSplit ? channelChart : dashboard?.jobsByType ?? []).map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }}
                        formatter={(v: number) => (showServiceSplit ? [formatCurrency(v), "Collected"] : [v, "Jobs"])}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-2 flex flex-wrap justify-center gap-3">
                    {(showServiceSplit ? channelChart : dashboard?.jobsByType ?? []).map((row, i) => (
                      <span key={row.type} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        {row.type}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="py-16 text-center text-sm text-muted-foreground">No billing recorded this month.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <ReportList title="Product-wise sales" rows={sales?.productWise} />
          <ReportList title="Spare parts" rows={sales?.sparePartsSales} />
          <ReportList title="Services / packages" rows={sales?.equipmentSales} />
          <ReportList title="Salesperson" rows={sales?.salespersonWise} />
          <ReportList title="Customer" rows={sales?.customerWise} />
          <ReportList title="Top selling" rows={sales?.topSelling} />
        </div>

        <p className="text-xs text-muted-foreground">
          Product sale invoices are recorded by Sales Staff. Service-ticket estimates and job invoices stay on Estimates and Billing.
        </p>
      </div>
    </RoleGuard>
  );
}
