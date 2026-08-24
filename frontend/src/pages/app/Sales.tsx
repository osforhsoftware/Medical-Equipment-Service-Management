import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  FileText,
  IndianRupee,
  Loader2,
  Package,
  Plus,
  Receipt,
  ShoppingCart,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EstimateNewSheet } from "@/components/estimates/EstimateNewSheet";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError, type BackendSalesOrder } from "@/lib/api";
import { estimateStatusLabel } from "@/lib/estimates";
import { formatCurrency, formatCurrencyShort, formatDate } from "@/lib/format";
import { useState } from "react";

function paymentLabel(order: BackendSalesOrder) {
  if (order.paymentStatus === "paid") return "Paid";
  if (order.paymentStatus === "partial") return "Partially paid";
  return "Unpaid";
}

export default function Sales() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const canBuild = hasRole(["admin", "coordinator", "estimator"]);
  const canBill = hasRole(["admin", "billing"]);
  const [newOpen, setNewOpen] = useState(false);

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

  return (
    <RoleGuard roles={["admin", "coordinator", "estimator", "billing", "inventory"]}>
      <div className="space-y-6">
        <PageHeader
          title="Product Sales"
          description="Sell equipment, spare parts, accessories, consumables and service packages using existing inventory, quotations and billing."
          actions={
            canBuild ? (
              <Button variant="brand" onClick={() => setNewOpen(true)}>
                <Plus className="mr-1 h-4 w-4" /> New quotation
              </Button>
            ) : undefined
          }
        />

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
          <StatCard label="Total orders" value={String(kpis?.totalOrders ?? 0)} icon={ShoppingCart} />
          <StatCard label="Pending orders" value={String(kpis?.pendingOrders ?? 0)} icon={Package} accent="warning" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Open quotations" value={String(kpis?.openQuotes ?? 0)} icon={FileText} accent="accent" />
          <StatCard label="Pending payments" value={String(kpis?.pendingPayments ?? 0)} icon={AlertTriangle} accent="warning" />
          <StatCard label="Outstanding" value={formatCurrencyShort(kpis?.outstanding ?? 0)} icon={IndianRupee} accent="warning" />
          <StatCard label="Collected" value={formatCurrencyShort(kpis?.collected ?? 0)} icon={Receipt} accent="success" />
        </div>

        <Tabs defaultValue="desk">
          <TabsList>
            <TabsTrigger value="desk">Desk</TabsTrigger>
            <TabsTrigger value="orders">Sales orders</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="desk" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-base">Recent quotations</CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/app/estimates">View all</Link>
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(desk?.recentQuotes ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No product quotations yet. Select a customer and add parts or services.</p>
                  ) : (
                    desk?.recentQuotes.map((quote) => (
                      <button
                        key={quote.id}
                        type="button"
                        className="flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left hover:bg-muted/50"
                        onClick={() => navigate(`/app/estimates/${quote.id}`)}
                      >
                        <div className="min-w-0">
                          <p className="font-mono text-sm font-medium">{quote.reference}</p>
                          <p className="truncate text-xs text-muted-foreground">{quote.customerName}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <StatusBadge status={quote.status} label={estimateStatusLabel(quote.status)} />
                          <p className="mt-1 text-xs font-medium">{formatCurrency(quote.total)}</p>
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
                    <p className="text-sm text-muted-foreground">Sales orders will populate this list.</p>
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

          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sales orders</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {ordersQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading orders…</p>
                ) : (ordersQuery.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Approve a quotation, then convert it to a sales order.</p>
                ) : (
                  ordersQuery.data?.map((order) => (
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
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">Outstanding payments</CardTitle>
                {canBill ? (
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/app/billing">
                      Billing <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-2">
                {(reports?.outstanding ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No outstanding product-sales invoices.</p>
                ) : (
                  reports?.outstanding.map((row) => (
                    <div key={row.id} className="flex justify-between text-sm">
                      <span>{row.customerName}</span>
                      <span>{formatCurrency(row.balanceDue)} due</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <EstimateNewSheet open={newOpen} onOpenChange={setNewOpen} />
    </RoleGuard>
  );
}
