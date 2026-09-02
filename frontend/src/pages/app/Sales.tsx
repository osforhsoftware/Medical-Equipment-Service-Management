import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  IndianRupee,
  Loader2,
  Package,
  Plus,
  Receipt,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { SaleFormDialog } from "@/components/sales/SaleFormDialog";
import { SALES_BILL_ROLES, SALES_DESK_ROLES, SALES_WRITE_ROLES } from "@/config/roles";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError, type BackendSalesOrder } from "@/lib/api";
import { formatCurrency, formatCurrencyShort, formatDate } from "@/lib/format";

function paymentLabel(order: BackendSalesOrder) {
  if (order.paymentStatus === "paid") return "Paid";
  if (order.paymentStatus === "partial") return "Partially paid";
  return "Unpaid";
}

export default function Sales() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasRole } = useAuth();
  const canBuild = hasRole(SALES_WRITE_ROLES);
  const canBill = hasRole(SALES_BILL_ROLES);
  const [saleOpen, setSaleOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("new") !== "1" || !canBuild) return;
    setSaleOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete("new");
    setSearchParams(next, { replace: true });
  }, [canBuild, searchParams, setSearchParams]);

  const deskQuery = useQuery({
    queryKey: ["sales", "desk"],
    queryFn: () => api.getSalesDesk(),
  });
  const ordersQuery = useQuery({
    queryKey: ["sales", "orders"],
    queryFn: () => api.listSalesOrders(),
  });
  const reportsQuery = useQuery({
    queryKey: ["sales", "reports"],
    queryFn: () => api.getSalesReports(),
  });

  const desk = deskQuery.data;
  const kpis = desk?.kpis;
  const reports = reportsQuery.data;
  const orders = ordersQuery.data ?? [];

  return (
    <RoleGuard roles={SALES_DESK_ROLES}>
      <div className="space-y-6">
        <PageHeader
          title="Sales floor"
          description="Product sales, sale reports, and sale billing. Service estimates stay with Estimate Staff."
          actions={
            canBuild ? (
              <Button variant="brand" onClick={() => setSaleOpen(true)}>
                <Plus className="mr-1 h-4 w-4" /> New sale
              </Button>
            ) : undefined
          }
        />

        <div className="overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50 via-card to-teal-50 p-4 dark:border-amber-900/40 dark:from-amber-950/20 dark:to-teal-950/20">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 text-white">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Product sales desk</p>
              <p className="text-sm text-muted-foreground">
                Add sold items, review product sale reports, then create the sale invoice from the order.
              </p>
            </div>
            {canBuild ? (
              <Button variant="outline" onClick={() => setSaleOpen(true)}>
                <ShoppingBag className="mr-1 h-4 w-4" /> New sale
              </Button>
            ) : null}
          </div>
        </div>

        {deskQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading sales desk…
          </div>
        ) : deskQuery.isError ? (
          <p className="text-sm text-destructive">
            {deskQuery.error instanceof ApiError ? deskQuery.error.message : "Unable to load sales desk"}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Today's sales" value={formatCurrencyShort(kpis?.todaySales ?? 0)} icon={IndianRupee} accent="success" />
          <StatCard label="Monthly sales" value={formatCurrencyShort(kpis?.monthlySales ?? 0)} icon={Receipt} />
          <StatCard label="Total orders" value={String(kpis?.totalOrders ?? 0)} icon={ShoppingBag} />
          <StatCard label="Pending orders" value={String(kpis?.pendingOrders ?? 0)} icon={Package} accent="warning" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Pending payments" value={String(kpis?.pendingPayments ?? 0)} icon={IndianRupee} accent="warning" />
          <StatCard label="Outstanding" value={formatCurrencyShort(kpis?.outstanding ?? 0)} icon={IndianRupee} accent="warning" />
          <StatCard label="Collected" value={formatCurrencyShort(kpis?.collected ?? 0)} icon={Receipt} accent="success" />
          <StatCard label="Customers" value={String(kpis?.activeCustomers ?? 0)} icon={Package} />
        </div>

        <Tabs defaultValue="sales">
          <TabsList>
            <TabsTrigger value="sales">Sold items</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="sales" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-base">Recent sales</CardTitle>
                  {canBuild ? (
                    <Button variant="ghost" size="sm" onClick={() => setSaleOpen(true)}>
                      New
                    </Button>
                  ) : null}
                </CardHeader>
                <CardContent className="space-y-2">
                  {ordersQuery.isLoading ? (
                    <p className="text-sm text-muted-foreground">Loading sales…</p>
                  ) : orders.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No sales yet. Open the counter and add a sold item.
                    </p>
                  ) : (
                    orders.slice(0, 8).map((order) => (
                      <button
                        key={order.id}
                        type="button"
                        className="flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition hover:-translate-y-0.5 hover:bg-amber-50/60 dark:hover:bg-amber-950/20"
                        onClick={() => navigate(`/app/sales/orders/${order.id}`)}
                      >
                        <div className="min-w-0">
                          <p className="font-mono text-sm font-medium">{order.reference}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {order.customerName} · {order.lines.length} item{order.lines.length === 1 ? "" : "s"} ·{" "}
                            {formatDate(order.orderedAt)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <StatusBadge status={order.deliveryStatus} />
                          <p className="mt-1 text-xs font-medium">{formatCurrency(order.total)}</p>
                        </div>
                      </button>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Top selling products</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(desk?.topSellingProducts ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Record a sale to populate this list.</p>
                  ) : (
                    desk?.topSellingProducts.map((row) => (
                      <div key={row.name} className="flex items-center justify-between text-sm">
                        <span className="truncate">{row.name}</span>
                        <span className="shrink-0 text-muted-foreground">
                          {row.quantity} · {formatCurrency(row.amount)}
                        </span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">All sales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {orders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing sold yet.</p>
                ) : (
                  orders.map((order) => (
                    <button
                      key={order.id}
                      type="button"
                      className="flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left hover:bg-muted/50"
                      onClick={() => navigate(`/app/sales/orders/${order.id}`)}
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-medium">{order.reference}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {order.customerName} · {order.salespersonName} · {formatDate(order.orderedAt)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <StatusBadge status={order.deliveryStatus} />
                        <p className="mt-1 text-xs text-muted-foreground">{paymentLabel(order)}</p>
                        <p className="text-xs font-medium">{formatCurrency(order.total)}</p>
                      </div>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-base">Low stock products</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/app/inventory">Inventory</Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {(desk?.lowStockProducts ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No items at reorder level.</p>
                ) : (
                  desk?.lowStockProducts.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-muted/50"
                      onClick={() => navigate(`/app/inventory/${item.id}`)}
                    >
                      <span>
                        {item.name} <span className="font-mono text-xs text-muted-foreground">{item.sku}</span>
                      </span>
                      <span className="text-warning-foreground">{item.available} available</span>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <StatCard label="Daily sales" value={formatCurrency(reports?.dailySales ?? 0)} icon={IndianRupee} />
              <StatCard label="Monthly sales" value={formatCurrency(reports?.monthlySales ?? 0)} icon={Receipt} />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              {[
                ["Product-wise", reports?.productWise],
                ["Spare parts", reports?.sparePartsSales],
                ["Services / packages", reports?.equipmentSales],
                ["Salesperson", reports?.salespersonWise],
                ["Customer", reports?.customerWise],
                ["Top selling", reports?.topSelling],
              ].map(([title, rows]) => (
                <Card key={String(title)}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{title as string}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {(rows as { name: string; quantity: number; amount: number }[] | undefined)?.length ? (
                      (rows as { name: string; quantity: number; amount: number }[]).slice(0, 8).map((row) => (
                        <div key={row.name} className="flex justify-between text-sm">
                          <span className="truncate pr-3">{row.name}</span>
                          <span className="shrink-0">{formatCurrency(row.amount)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No data yet.</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
            {canBill ? (
              <p className="text-xs text-muted-foreground">
                Create sale invoices from each order. Service-ticket invoices are billed separately under Billing.
              </p>
            ) : null}
          </TabsContent>
        </Tabs>

        <SaleFormDialog
          open={saleOpen}
          onOpenChange={setSaleOpen}
          mode="create"
          onSaved={(order) => {
            void queryClient.invalidateQueries({ queryKey: ["sales"] });
            navigate(`/app/sales/orders/${order.id}`);
          }}
        />
      </div>
    </RoleGuard>
  );
}
