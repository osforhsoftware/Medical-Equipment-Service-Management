import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, IndianRupee, Loader2, Receipt, ShoppingBag, Wrench } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DateRangeFilter, type DateRangeValue } from "@/components/shared/DateRangeFilter";
import {
  BillingMixDoughnut,
  GroupedActivityChart,
  HorizontalJobsBar,
  JobsByStatusDoughnut,
  JobsByTypeDoughnut,
  StackedRevenueChart,
} from "@/components/charts/DashboardCharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/shared/StatCard";
import { RoleGuard } from "@/components/auth/RoleGuard";
import {
  ReportCategoryDetailDialog,
  type ReportCategoryItem,
} from "@/components/sales/ReportCategoryDetailDialog";
import { useAuth } from "@/context/AuthContext";
import { ApiError, api } from "@/lib/api";
import { defaultDateRange } from "@/lib/charts";
import { formatCurrency, formatCurrencyShort, formatDate } from "@/lib/format";

function ReportList({
  title,
  rows,
  onSeeAll,
}: {
  title: string;
  rows?: { name: string; quantity: number; amount: number }[];
  onSeeAll?: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
        {rows && rows.length > 0 && onSeeAll && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-primary gap-1"
            onClick={onSeeAll}
          >
            See all ({rows.length}) <ChevronRight className="h-3 w-3" />
          </Button>
        )}
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
  const canLoadSalesReports = hasRole(["admin", "sales", "billing", "inventory"]);
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => defaultDateRange(29));
  const [categoryModal, setCategoryModal] = useState<{
    open: boolean;
    title: string;
    subtitle?: string;
    rows?: ReportCategoryItem[];
  }>({
    open: false,
    title: "",
    rows: [],
  });

  const dashboardQuery = useQuery({
    queryKey: ["dashboard", dateRange.from, dateRange.to],
    queryFn: () => api.getDashboard({ from: dateRange.from, to: dateRange.to }),
  });
  const salesQuery = useQuery({
    queryKey: ["sales", "reports", dateRange.from, dateRange.to],
    queryFn: () =>
      api.getSalesReports({
        from: dateRange.from,
        to: dateRange.to,
      }),
    enabled: canLoadSalesReports,
  });

  const dashboard = dashboardQuery.data;
  const sales = salesQuery.data;
  const loading = dashboardQuery.isLoading || (canLoadSalesReports && salesQuery.isLoading);
  const error = dashboardQuery.error || (canLoadSalesReports ? salesQuery.error : null);

  const activity = dashboard?.activityTrend ?? dashboard?.revenueTrend.map((row) => ({
    label: row.month,
    key: row.month,
    jobs: row.jobs,
    tickets: 0,
    revenue: row.revenue,
    saleRevenue: row.saleRevenue ?? 0,
    serviceRevenue: row.serviceRevenue ?? 0,
  })) ?? [];

  const channelChart = useMemo(() => {
    const sale = dashboard?.period?.totals.saleRevenue
      ?? dashboard?.stats.saleRevenueMtd
      ?? sales?.monthlySales
      ?? 0;
    const service = dashboard?.period?.totals.serviceRevenue ?? dashboard?.stats.serviceRevenueMtd ?? 0;
    const other = dashboard?.stats.otherRevenueMtd ?? 0;
    return [
      { type: "Product sales", count: sale },
      { type: "Service billing", count: service },
      { type: "Other", count: other },
    ].filter((row) => row.count > 0);
  }, [dashboard, sales]);

  const periodLabel = dashboard?.period
    ? `${formatDate(dashboard.period.from)} – ${formatDate(dashboard.period.to)}`
    : `${formatDate(dateRange.from)} – ${formatDate(dateRange.to)}`;
  const periodMode = dashboard?.period?.mode === "monthly" ? "Monthly" : "Daily";

  const openCategorySeeAll = (title: string, rows?: ReportCategoryItem[]) => {
    setCategoryModal({
      open: true,
      title,
      subtitle: `Complete data for ${periodLabel}`,
      rows: rows ?? [],
    });
  };

  return (
    <RoleGuard roles={["admin", "billing", "coordinator"]}>
      <div className="space-y-6">
        <PageHeader
          title="Reports & Analytics"
          description="Live sale billing and service billing stay on separate tracks. Charts follow the selected date range."
        />

        <DateRangeFilter value={dateRange} onChange={setDateRange} />

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
              label="Sale billing (range)"
              value={formatCurrencyShort(dashboard?.period?.totals.saleRevenue ?? dashboard?.stats.saleRevenueMtd ?? 0)}
              icon={ShoppingBag}
            />
            <StatCard
              label="Service billing (range)"
              value={formatCurrencyShort(dashboard?.period?.totals.serviceRevenue ?? dashboard?.stats.serviceRevenueMtd ?? 0)}
              icon={Wrench}
            />
            <StatCard
              label="Jobs in range"
              value={String(dashboard?.period?.totals.jobs ?? 0)}
              icon={Wrench}
            />
            <StatCard
              label="All collected (range)"
              value={formatCurrencyShort(dashboard?.period?.totals.revenue ?? dashboard?.stats.revenueMtd ?? 0)}
              icon={IndianRupee}
              accent="success"
            />
          </div>
        ) : null}

        <div>
          <h2 className="text-base font-semibold">Visual reports</h2>
          <p className="text-xs text-muted-foreground">
            {periodMode} recorded data · {periodLabel}
            {dashboardQuery.isFetching ? " · refreshing…" : ""}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="shadow-card lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Stacked billing · sale vs service</CardTitle>
            </CardHeader>
            <CardContent>
              <StackedRevenueChart
                labels={activity.map((r) => r.label)}
                saleRevenue={activity.map((r) => r.saleRevenue)}
                serviceRevenue={activity.map((r) => r.serviceRevenue)}
              />
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{showServiceSplit ? "Sale vs service mix" : "Sales mix"}</CardTitle>
            </CardHeader>
            <CardContent>
              {showServiceSplit ? (
                <BillingMixDoughnut rows={channelChart} />
              ) : (
                <JobsByTypeDoughnut rows={dashboard?.jobsByType ?? []} />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="shadow-card lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Grouped activity · jobs & tickets</CardTitle>
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
              <CardTitle className="text-base">Jobs by status</CardTitle>
            </CardHeader>
            <CardContent>
              <JobsByStatusDoughnut rows={dashboard?.jobsByStatus ?? []} />
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Jobs by type</CardTitle>
          </CardHeader>
          <CardContent>
            <HorizontalJobsBar rows={dashboard?.jobsByType ?? []} height={220} />
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <ReportList
            title="Product-wise sales"
            rows={sales?.productWise}
            onSeeAll={() => openCategorySeeAll("Product-wise Sales", sales?.productWise)}
          />
          <ReportList
            title="Spare parts"
            rows={sales?.sparePartsSales}
            onSeeAll={() => openCategorySeeAll("Spare Parts Sales", sales?.sparePartsSales)}
          />
          <ReportList
            title="Consumables"
            rows={sales?.consumablesSales}
            onSeeAll={() => openCategorySeeAll("Consumables Sales", sales?.consumablesSales)}
          />
          <ReportList
            title="Services / packages"
            rows={sales?.equipmentSales}
            onSeeAll={() => openCategorySeeAll("Services & Packages", sales?.equipmentSales)}
          />
          <ReportList
            title="Salesperson"
            rows={sales?.salespersonWise}
            onSeeAll={() => openCategorySeeAll("Salesperson Performance", sales?.salespersonWise)}
          />
          <ReportList
            title="Customer"
            rows={sales?.customerWise}
            onSeeAll={() => openCategorySeeAll("Customer Sales Breakdown", sales?.customerWise)}
          />
          <ReportList
            title="Top selling"
            rows={sales?.topSelling}
            onSeeAll={() => openCategorySeeAll("Top Selling Products", sales?.topSelling)}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Product sale invoices are recorded by Sales Staff. Service-ticket estimates and job invoices stay on Estimates and Billing.
          Charts above use Chart.js and refresh for the selected from/to dates.
        </p>

        <ReportCategoryDetailDialog
          open={categoryModal.open}
          onOpenChange={(open) => setCategoryModal((prev) => ({ ...prev, open }))}
          title={categoryModal.title}
          subtitle={categoryModal.subtitle}
          rows={categoryModal.rows}
          dateRangeLabel={periodLabel}
        />
      </div>
    </RoleGuard>
  );
}
