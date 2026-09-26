import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  ChevronRight,
  ClipboardList,
  Download,
  Eye,
  FileQuestion,
  FileSpreadsheet,
  FileText,
  IndianRupee,
  Layers,
  Loader2,
  Package,
  Plus,
  Printer,
  Receipt,
  Search,
  ShoppingBag,
  Sparkles,
  Truck,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { DateRangeFilter, type DateRangeValue } from "@/components/shared/DateRangeFilter";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { SaleFormDialog } from "@/components/sales/SaleFormDialog";
import {
  ReportCategoryDetailDialog,
  type ReportCategoryItem,
} from "@/components/sales/ReportCategoryDetailDialog";
import { SalesReportPrintDialog } from "@/components/sales/SalesReportPrintDialog";
import { SALES_BILL_ROLES, SALES_DESK_ROLES, SALES_WRITE_ROLES } from "@/config/roles";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import {
  api,
  ApiError,
  type BackendSalesOrder,
  type SalesReportDetailedLine,
} from "@/lib/api";
import { defaultDateRange } from "@/lib/charts";
import { downloadSpreadsheet } from "@/lib/exportSpreadsheet";
import { formatCurrency, formatCurrencyShort, formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";

function paymentLabel(order: BackendSalesOrder) {
  if (order.paymentStatus === "paid") return "Paid";
  if (order.paymentStatus === "partial") return "Partially paid";
  return "Unpaid";
}

type SalesStage = "overview" | "orders" | "delivery" | "invoice";

function resolveSalesStage(raw: string | null): SalesStage {
  if (raw === "orders" || raw === "delivery" || raw === "invoice") return raw;
  return "overview";
}

const FLOW_STEPS = [
  { key: "enquiry", label: "Enquiry", to: "/app/sales-enquiries", icon: FileQuestion },
  { key: "quotation", label: "Quotation", to: "/app/sales/quotations", icon: FileText },
  { key: "orders", label: "SO", to: "/app/sales?stage=orders", icon: ShoppingBag },
  { key: "delivery", label: "Delivery", to: "/app/sales?stage=delivery", icon: Truck },
  { key: "invoice", label: "Invoice", to: "/app/sales?stage=invoice", icon: Receipt },
] as const;

export default function Sales() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasRole } = useAuth();
  const canBuild = hasRole(SALES_WRITE_ROLES);
  const canBill = hasRole(SALES_BILL_ROLES);

  const stage = resolveSalesStage(searchParams.get("stage"));
  const tabParam = stage === "orders" ? (searchParams.get("tab") || "orders") : "orders";
  const [activeTab, setActiveTab] = useState<string>(tabParam);
  const [deliveryFilter, setDeliveryFilter] = useState<"pending" | "delivered" | "all">("pending");

  // Date Range state for Reports and Order filtering
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => defaultDateRange(29));

  // Dialog states
  const [saleOpen, setSaleOpen] = useState(false);
  const [printDialog, setPrintDialog] = useState(false);
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

  // Sold Items In-Page Table filter state
  const [itemClassFilter, setItemClassFilter] = useState<string>("all");
  const [itemSearchQuery, setItemSearchQuery] = useState<string>("");

  useEffect(() => {
    if (searchParams.get("new") !== "1" || !canBuild) return;
    setSaleOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete("new");
    setSearchParams(next, { replace: true });
  }, [canBuild, searchParams, setSearchParams]);

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    const next = new URLSearchParams(searchParams);
    next.set("tab", val);
    setSearchParams(next, { replace: true });
  };

  const deskQuery = useQuery({
    queryKey: ["sales", "desk"],
    queryFn: () => api.getSalesDesk(),
  });

  const ordersQuery = useQuery({
    queryKey: ["sales", "orders", dateRange.from, dateRange.to],
    queryFn: () =>
      api.listSalesOrders({
        from: dateRange.from,
        to: dateRange.to,
      }),
  });

  const reportsQuery = useQuery({
    queryKey: ["sales", "reports", dateRange.from, dateRange.to],
    queryFn: () =>
      api.getSalesReports({
        from: dateRange.from,
        to: dateRange.to,
      }),
  });

  const desk = deskQuery.data;
  const kpis = desk?.kpis;
  const reports = reportsQuery.data;
  const allOrders = ordersQuery.data ?? [];

  const pendingDeliveryOrders = useMemo(
    () => allOrders.filter((order) => order.deliveryStatus !== "delivered"),
    [allOrders],
  );
  const deliveredOrders = useMemo(
    () => allOrders.filter((order) => order.deliveryStatus === "delivered"),
    [allOrders],
  );
  const invoiceQueueOrders = useMemo(
    () =>
      allOrders.filter(
        (order) => (order.invoices?.length ?? 0) > 0 || order.paymentStatus !== "paid",
      ),
    [allOrders],
  );

  const orders = useMemo(() => {
    if (stage === "delivery") {
      if (deliveryFilter === "pending") return pendingDeliveryOrders;
      if (deliveryFilter === "delivered") return deliveredOrders;
      return allOrders;
    }
    if (stage === "invoice") return invoiceQueueOrders;
    return allOrders;
  }, [allOrders, stage, deliveryFilter, pendingDeliveryOrders, deliveredOrders, invoiceQueueOrders]);

  const recentOrders = useMemo(() => allOrders.slice(0, 6), [allOrders]);

  const pendingDeliveryValue = useMemo(
    () => pendingDeliveryOrders.reduce((sum, o) => sum + Number(o.total || 0), 0),
    [pendingDeliveryOrders],
  );
  const pendingDeliveryItems = useMemo(
    () => pendingDeliveryOrders.reduce((sum, o) => sum + (o.lines?.length ?? 0), 0),
    [pendingDeliveryOrders],
  );

  useEffect(() => {
    if (stage === "orders") {
      const tab = searchParams.get("tab") || "orders";
      setActiveTab(tab);
    }
  }, [stage, searchParams]);

  const dateRangeLabel = `${formatDate(dateRange.from)} – ${formatDate(dateRange.to)}`;

  // Filtered sold item lines for the in-page detailed table
  const detailedLines = reports?.detailedLines ?? [];
  const filteredDetailedLines = useMemo(() => {
    return detailedLines.filter((line) => {
      // Class/Type match
      if (itemClassFilter !== "all") {
        if (itemClassFilter === "spare_part" && line.itemClass !== "spare_part" && line.type !== "part") return false;
        if (itemClassFilter === "consumable" && line.itemClass !== "consumable") return false;
        if (itemClassFilter === "service" && line.type !== "service" && line.type !== "labor") return false;
        if (itemClassFilter === "other" && line.type !== "other") return false;
      }
      // Search match
      if (itemSearchQuery.trim()) {
        const q = itemSearchQuery.trim().toLowerCase();
        const matchesName = line.description.toLowerCase().includes(q);
        const matchesSku = (line.sku || "").toLowerCase().includes(q);
        const matchesCustomer = line.customerName.toLowerCase().includes(q);
        const matchesSalesperson = line.salespersonName.toLowerCase().includes(q);
        const matchesRef = line.orderReference.toLowerCase().includes(q);
        return matchesName || matchesSku || matchesCustomer || matchesSalesperson || matchesRef;
      }
      return true;
    });
  }, [detailedLines, itemClassFilter, itemSearchQuery]);

  // Export handlers
  const exportSalesOrders = (ordersToExport: BackendSalesOrder[]) => {
    downloadSpreadsheet(
      "sales-orders",
      [
        { header: "Order Ref", value: (row) => row.reference },
        { header: "Date", value: (row) => formatDate(row.orderedAt) },
        { header: "Customer", value: (row) => row.customerName },
        { header: "Sales Rep", value: (row) => row.salespersonName },
        { header: "Delivery Status", value: (row) => row.deliveryStatus },
        { header: "Payment Status", value: (row) => row.paymentStatus },
        { header: "Items Count", value: (row) => row.lines.length },
        { header: "Subtotal (₹)", value: (row) => row.subtotal },
        { header: "Discount (₹)", value: (row) => row.discount },
        { header: "Tax (₹)", value: (row) => row.tax },
        { header: "Total Amount (₹)", value: (row) => row.total },
        { header: "Paid Amount (₹)", value: (row) => row.paidTotal ?? 0 },
        { header: "Balance Due (₹)", value: (row) => row.balanceDue ?? 0 },
        { header: "Notes", value: (row) => row.notes ?? "" },
      ],
      ordersToExport,
    );
    toast.success("Export ready", {
      description: `${ordersToExport.length} sales order(s) exported for Excel.`,
    });
  };

  const exportSoldLines = (linesToExport: SalesReportDetailedLine[]) => {
    downloadSpreadsheet(
      "sold-items-breakdown",
      [
        { header: "Order Ref", value: (row) => row.orderReference },
        { header: "Date", value: (row) => formatDate(row.orderedAt) },
        { header: "Customer", value: (row) => row.customerName },
        { header: "Sales Rep", value: (row) => row.salespersonName },
        { header: "Item Description", value: (row) => row.description },
        { header: "Category / Class", value: (row) => row.itemClass || row.type },
        { header: "SKU", value: (row) => row.sku ?? "" },
        { header: "Quantity", value: (row) => row.quantity },
        { header: "Unit Price (₹)", value: (row) => row.unitPrice },
        { header: "Discount (₹)", value: (row) => row.discount },
        { header: "Tax Rate (%)", value: (row) => row.taxRate },
        { header: "Line Total (₹)", value: (row) => row.lineTotal },
      ],
      linesToExport,
    );
    toast.success("Export ready", {
      description: `${linesToExport.length} sold item line(s) exported for Excel.`,
    });
  };

  const exportReportSummary = () => {
    if (!reports) return;
    const summaryRows = [
      { Category: "KPI", Item: "Today's Sales", Quantity: 0, Amount: reports.dailySales },
      { Category: "KPI", Item: "Monthly Sales (MTD)", Quantity: 0, Amount: reports.monthlySales },
      {
        Category: "KPI",
        Item: `Period Sales (${dateRangeLabel})`,
        Quantity: reports.rangeOrdersCount ?? orders.length,
        Amount: reports.rangeSales ?? reports.monthlySales,
      },
      { Category: "KPI", Item: "Total Invoiced", Quantity: 0, Amount: reports.invoiced ?? 0 },
      { Category: "KPI", Item: "Total Collected", Quantity: 0, Amount: reports.collected ?? 0 },
      { Category: "KPI", Item: "Total Outstanding", Quantity: 0, Amount: reports.outstandingTotal ?? 0 },
      ...reports.productWise.map((r) => ({ Category: "Product Sales", Item: r.name, Quantity: r.quantity, Amount: r.amount })),
      ...reports.sparePartsSales.map((r) => ({ Category: "Spare Parts", Item: r.name, Quantity: r.quantity, Amount: r.amount })),
      ...reports.consumablesSales.map((r) => ({ Category: "Consumables", Item: r.name, Quantity: r.quantity, Amount: r.amount })),
      ...reports.equipmentSales.map((r) => ({ Category: "Services / Packages", Item: r.name, Quantity: r.quantity, Amount: r.amount })),
      ...reports.salespersonWise.map((r) => ({ Category: "Salesperson Performance", Item: r.name, Quantity: r.quantity, Amount: r.amount })),
      ...reports.customerWise.map((r) => ({ Category: "Customer Sales", Item: r.name, Quantity: r.quantity, Amount: r.amount })),
    ];

    downloadSpreadsheet(
      "sales-report-summary",
      [
        { header: "Category", value: (row) => row.Category },
        { header: "Item / Name", value: (row) => row.Item },
        { header: "Quantity", value: (row) => row.Quantity },
        { header: "Amount (₹)", value: (row) => row.Amount },
      ],
      summaryRows,
    );
    toast.success("Sales report summary exported for Excel.");
  };

  const openCategorySeeAll = (title: string, rows?: ReportCategoryItem[], subtitle?: string) => {
    setCategoryModal({
      open: true,
      title,
      subtitle,
      rows: rows ?? [],
    });
  };

  // DataTable columns for Sales Orders
  const orderColumns: Column<BackendSalesOrder>[] = [
    {
      key: "reference",
      header: "Order Ref",
      render: (order) => (
        <button
          type="button"
          className="font-mono text-sm font-semibold text-primary hover:underline text-left"
          onClick={() => navigate(`/app/sales/orders/${order.id}`)}
        >
          {order.reference}
        </button>
      ),
    },
    {
      key: "orderedAt",
      header: "Date",
      render: (order) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatDate(order.orderedAt)}
        </span>
      ),
    },
    {
      key: "customerName",
      header: "Customer",
      render: (order) => (
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{order.customerName}</p>
          <p className="text-xs text-muted-foreground truncate">
            {order.lines.length} item{order.lines.length === 1 ? "" : "s"} ·{" "}
            {order.lines.map((l) => l.description).slice(0, 2).join(", ")}
            {order.lines.length > 2 ? "…" : ""}
          </p>
        </div>
      ),
    },
    {
      key: "salespersonName",
      header: "Sales Rep",
      render: (order) => (
        <span className="text-sm text-muted-foreground">{order.salespersonName || "Unassigned"}</span>
      ),
    },
    {
      key: "deliveryStatus",
      header: "Delivery",
      render: (order) => <StatusBadge status={order.deliveryStatus} />,
    },
    {
      key: "paymentStatus",
      header: "Payment",
      render: (order) => {
        const isPaid = order.paymentStatus === "paid";
        const isPartial = order.paymentStatus === "partial";
        return (
          <Badge
            variant="outline"
            className={`text-xs font-normal capitalize ${
              isPaid
                ? "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400"
                : isPartial
                  ? "border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400"
                  : ""
            }`}
          >
            {paymentLabel(order)}
          </Badge>
        );
      },
    },
    {
      key: "total",
      header: "Amount",
      className: "text-right",
      render: (order) => (
        <div className="text-right">
          <p className="font-mono font-medium text-sm">{formatCurrency(order.total)}</p>
          {order.balanceDue !== undefined && order.balanceDue > 0 && (
            <p className="text-[11px] font-mono text-amber-600">Due: {formatCurrency(order.balanceDue)}</p>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-24 text-right",
      render: (order) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs gap-1"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/app/sales/orders/${order.id}`);
            }}
          >
            <Eye className="h-3.5 w-3.5" /> View
          </Button>
        </div>
      ),
    },
  ];

  const pageMeta = {
    overview: {
      title: "Sales Overview",
      description: "Your sales desk at a glance — counts, quick actions, and the sales flow.",
    },
    orders: {
      title: "Sales Orders",
      description: "All sales orders, reports, and inventory insights.",
    },
    delivery: {
      title: "Delivery",
      description: "Track pending and completed deliveries for your sales orders.",
    },
    invoice: {
      title: "Invoice",
      description: "Sale invoices and orders that still need billing or collection.",
    },
  }[stage];

  return (
    <RoleGuard roles={SALES_DESK_ROLES}>
      <div className="space-y-6">
        <PageHeader
          title={pageMeta.title}
          description={pageMeta.description}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-1.5">
                    <Download className="h-4 w-4 text-emerald-600" />
                    Download / Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Sales Export Options</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => exportSalesOrders(orders)} className="gap-2 cursor-pointer">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                    Export Sales Orders ({orders.length})
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => exportSoldLines(detailedLines)}
                    disabled={detailedLines.length === 0}
                    className="gap-2 cursor-pointer"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                    Export Sold Items Lines ({detailedLines.length})
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportReportSummary} className="gap-2 cursor-pointer">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                    Export Report Summary
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setPrintDialog(true)} className="gap-2 cursor-pointer">
                    <Printer className="h-4 w-4 text-primary" />
                    Print / Download PDF Report
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {canBuild ? (
                <>
                  {stage === "overview" ? (
                    <Button variant="outline" asChild className="gap-1.5">
                      <Link to="/app/sales-enquiries">
                        <Plus className="h-4 w-4" /> New enquiry
                      </Link>
                    </Button>
                  ) : null}
                  <Button variant="brand" onClick={() => setSaleOpen(true)} className="gap-1.5">
                    <Plus className="h-4 w-4" /> New sale
                  </Button>
                </>
              ) : null}
            </div>
          }
        />

        {/* Sales flow strip */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border bg-muted/30 px-3 py-2.5">
          <Link
            to="/app/sales"
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
              stage === "overview"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background hover:text-foreground"
            }`}
          >
            <ClipboardList className="h-3.5 w-3.5" />
            Overview
          </Link>
          <span className="mx-0.5 h-4 w-px bg-border" />
          <span className="mr-0.5 text-xs font-medium text-muted-foreground">Flow</span>
          {FLOW_STEPS.map((step, index) => {
            const active =
              (step.key === "orders" && stage === "orders") ||
              (step.key === "delivery" && stage === "delivery") ||
              (step.key === "invoice" && stage === "invoice");
            const Icon = step.icon;
            return (
              <div key={step.key} className="flex items-center gap-1.5">
                {index > 0 ? <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/60" /> : null}
                <Link
                  to={step.to}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-background hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {step.label}
                </Link>
              </div>
            );
          })}
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

        {stage === "overview" ? (
          <>
            <div className="overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50 via-card to-teal-50 p-4 dark:border-amber-900/40 dark:from-amber-950/20 dark:to-teal-950/20">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 text-white shadow-sm">
                  <Sparkles className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">Product sales desk & live reporting</p>
                  <p className="text-sm text-muted-foreground">
                    Counts below are for your sales. Use the flow above to manage enquiry → quotation → SO → delivery → invoice.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Today's sales" value={formatCurrencyShort(kpis?.todaySales ?? 0)} icon={IndianRupee} accent="success" />
              <StatCard label="Monthly sales" value={formatCurrencyShort(kpis?.monthlySales ?? 0)} icon={Receipt} />
              <StatCard
                label={`Period sales (${dateRangeLabel})`}
                value={formatCurrencyShort(reports?.rangeSales ?? kpis?.monthlySales ?? 0)}
                icon={TrendingUp}
                accent="accent"
              />
              <StatCard label="Total orders" value={String(kpis?.totalOrders ?? allOrders.length)} icon={ShoppingBag} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Pending deliveries" value={String(kpis?.pendingOrders ?? pendingDeliveryOrders.length)} icon={Package} accent="warning" />
              <StatCard label="Pending payments" value={String(kpis?.pendingPayments ?? 0)} icon={IndianRupee} accent="warning" />
              <StatCard label="Outstanding balance" value={formatCurrencyShort(reports?.outstandingTotal ?? kpis?.outstanding ?? 0)} icon={IndianRupee} accent="warning" />
              <StatCard label="Total collected" value={formatCurrencyShort(reports?.collected ?? kpis?.collected ?? 0)} icon={Receipt} accent="success" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  title: "New sale",
                  hint: "Record a product sale now",
                  icon: Plus,
                  action: () => setSaleOpen(true),
                  show: canBuild,
                },
                {
                  title: "New enquiry",
                  hint: "Capture a customer lead",
                  icon: FileQuestion,
                  to: "/app/sales-enquiries",
                  show: canBuild,
                },
                {
                  title: "Pending delivery",
                  hint: `${pendingDeliveryOrders.length} order(s) waiting`,
                  icon: Truck,
                  to: "/app/sales?stage=delivery",
                  show: true,
                },
                {
                  title: "Open invoices",
                  hint: `${invoiceQueueOrders.length} need attention`,
                  icon: Receipt,
                  to: "/app/sales?stage=invoice",
                  show: true,
                },
              ]
                .filter((card) => card.show)
                .map((card) => {
                  const Icon = card.icon;
                  const inner = (
                    <>
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1 text-left">
                        <p className="text-sm font-semibold text-foreground">{card.title}</p>
                        <p className="text-xs text-muted-foreground">{card.hint}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </>
                  );
                  if (card.to) {
                    return (
                      <Link
                        key={card.title}
                        to={card.to}
                        className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40"
                      >
                        {inner}
                      </Link>
                    );
                  }
                  return (
                    <button
                      key={card.title}
                      type="button"
                      onClick={card.action}
                      className="flex items-center gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/40"
                    >
                      {inner}
                    </button>
                  );
                })}
            </div>

            <div className="grid gap-6 lg:grid-cols-5">
              <Card className="lg:col-span-3">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <div>
                    <CardTitle className="text-base">Recent sales orders</CardTitle>
                    <CardDescription className="text-xs">Latest orders in your date range</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" asChild className="h-8 gap-1 text-xs text-primary">
                    <Link to="/app/sales?stage=orders">
                      View all <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2">
                  {ordersQuery.isLoading ? (
                    <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                    </div>
                  ) : recentOrders.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">No sales orders yet. Record your first sale.</p>
                  ) : (
                    recentOrders.map((order) => (
                      <button
                        key={order.id}
                        type="button"
                        className="flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
                        onClick={() => navigate(`/app/sales/orders/${order.id}`)}
                      >
                        <div className="min-w-0">
                          <p className="font-mono text-sm font-semibold text-primary">{order.reference}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {order.customerName} · {formatDate(order.orderedAt)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-mono text-sm font-medium">{formatCurrency(order.total)}</p>
                          <StatusBadge status={order.deliveryStatus} />
                        </div>
                      </button>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Period snapshot</CardTitle>
                  <CardDescription className="text-xs">{dateRangeLabel}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <DateRangeFilter value={dateRange} onChange={setDateRange} dense />
                  <div className="space-y-2 rounded-lg border bg-muted/20 p-3 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Orders</span>
                      <span className="font-mono font-medium">{reports?.rangeOrdersCount ?? allOrders.length}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Sales</span>
                      <span className="font-mono font-medium">{formatCurrency(reports?.rangeSales ?? 0)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Collected</span>
                      <span className="font-mono font-medium text-emerald-600">{formatCurrency(reports?.rangeCollected ?? 0)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Outstanding</span>
                      <span className="font-mono font-medium text-amber-600">{formatCurrency(reports?.outstandingTotal ?? 0)}</span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="w-full gap-1.5" asChild>
                    <Link to="/app/sales?stage=orders&tab=reports">
                      <TrendingUp className="h-3.5 w-3.5" /> Open full sales reports
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}

        {stage === "delivery" ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Pending deliveries" value={String(pendingDeliveryOrders.length)} icon={Truck} accent="warning" />
              <StatCard label="Items to deliver" value={String(pendingDeliveryItems)} icon={Package} />
              <StatCard label="Pending value" value={formatCurrencyShort(pendingDeliveryValue)} icon={IndianRupee} accent="warning" />
              <StatCard label="Delivered (in range)" value={String(deliveredOrders.length)} icon={Package} accent="success" />
            </div>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">Delivery queue</CardTitle>
                    <CardDescription className="text-xs">
                      Orders waiting to ship, plus delivered history for the selected date range.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex rounded-lg border bg-muted/30 p-0.5">
                      {(
                        [
                          { key: "pending", label: "Pending", count: pendingDeliveryOrders.length },
                          { key: "delivered", label: "Delivered", count: deliveredOrders.length },
                          { key: "all", label: "All", count: allOrders.length },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setDeliveryFilter(opt.key)}
                          className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                            deliveryFilter === opt.key
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {opt.label}
                          <span className="ml-1 font-mono text-[11px] opacity-70">{opt.count}</span>
                        </button>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportSalesOrders(orders)}
                      disabled={orders.length === 0}
                      className="h-8 gap-1.5 text-xs"
                    >
                      <Download className="h-3.5 w-3.5 text-emerald-600" />
                      Export ({orders.length})
                    </Button>
                  </div>
                </div>
                <div className="pt-3">
                  <DateRangeFilter value={dateRange} onChange={setDateRange} dense />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {ordersQuery.isLoading ? (
                  <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" /> Loading deliveries…
                  </div>
                ) : (
                  <DataTable
                    data={orders}
                    columns={orderColumns}
                    searchKeys={["reference", "customerName", "salespersonName", "notes"]}
                    searchPlaceholder="Search order, customer, sales rep…"
                    emptyMessage={
                      deliveryFilter === "pending"
                        ? "No pending deliveries."
                        : deliveryFilter === "delivered"
                          ? "No delivered orders in this range."
                          : "No sales orders found."
                    }
                    emptyHint="Adjust the date range or record a new sale."
                    onRowClick={(row) => navigate(`/app/sales/orders/${row.id}`)}
                  />
                )}
              </CardContent>
            </Card>
          </>
        ) : null}

        {stage === "invoice" ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Open invoice queue" value={String(invoiceQueueOrders.length)} icon={Receipt} accent="warning" />
              <StatCard label="Pending payments" value={String(kpis?.pendingPayments ?? 0)} icon={IndianRupee} accent="warning" />
              <StatCard label="Outstanding balance" value={formatCurrencyShort(reports?.outstandingTotal ?? kpis?.outstanding ?? 0)} icon={IndianRupee} accent="warning" />
              <StatCard label="Total collected" value={formatCurrencyShort(reports?.collected ?? kpis?.collected ?? 0)} icon={Receipt} accent="success" />
            </div>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">Invoice & collection</CardTitle>
                    <CardDescription className="text-xs">
                      Orders with invoices or unpaid balances. Open an order to bill or record payment.
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportSalesOrders(orders)}
                    disabled={orders.length === 0}
                    className="h-8 gap-1.5 text-xs"
                  >
                    <Download className="h-3.5 w-3.5 text-emerald-600" />
                    Export ({orders.length})
                  </Button>
                </div>
                <div className="pt-3">
                  <DateRangeFilter value={dateRange} onChange={setDateRange} dense />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {ordersQuery.isLoading ? (
                  <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" /> Loading invoices…
                  </div>
                ) : (
                  <DataTable
                    data={orders}
                    columns={orderColumns}
                    searchKeys={["reference", "customerName", "salespersonName", "notes"]}
                    searchPlaceholder="Search order, customer, sales rep…"
                    filters={[
                      {
                        label: "Payment",
                        options: [
                          { label: "All payment states", value: "all" },
                          { label: "Paid", value: "paid" },
                          { label: "Partially paid", value: "partial" },
                          { label: "Unpaid", value: "unpaid" },
                        ],
                        predicate: (row, val) => (row as BackendSalesOrder).paymentStatus === val,
                      },
                    ]}
                    emptyMessage="No invoices or unpaid orders in this range."
                    emptyHint="Create an invoice from a delivered sales order."
                    onRowClick={(row) => navigate(`/app/sales/orders/${row.id}`)}
                  />
                )}
              </CardContent>
            </Card>
          </>
        ) : null}

        {stage === "orders" ? (
        <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Today's sales" value={formatCurrencyShort(kpis?.todaySales ?? 0)} icon={IndianRupee} accent="success" />
          <StatCard label="Monthly sales" value={formatCurrencyShort(kpis?.monthlySales ?? 0)} icon={Receipt} />
          <StatCard
            label={`Period sales (${dateRangeLabel})`}
            value={formatCurrencyShort(reports?.rangeSales ?? kpis?.monthlySales ?? 0)}
            icon={TrendingUp}
            accent="accent"
          />
          <StatCard label="Total orders" value={String(kpis?.totalOrders ?? orders.length)} icon={ShoppingBag} />
        </div>

        {/* Tabs for Navigation */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-2">
            <TabsList>
              <TabsTrigger value="orders" className="gap-1.5">
                <ShoppingBag className="h-4 w-4" />
                All Sales Orders
                <Badge variant="secondary" className="ml-1 text-[11px] px-1.5 py-0 h-4 font-mono">
                  {orders.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="reports" className="gap-1.5">
                <TrendingUp className="h-4 w-4" />
                Sales Reports & Breakdown
              </TabsTrigger>
              <TabsTrigger value="insights" className="gap-1.5">
                <Layers className="h-4 w-4" />
                Inventory & Top Selling
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportSalesOrders(orders)}
                className="gap-1.5 text-xs h-8"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                Export Orders
              </Button>
            </div>
          </div>

          {/* TAB 1: ALL SALES ORDERS (WITH FILTER & EXPORT) */}
          <TabsContent value="orders" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-semibold">Sales Orders Directory</CardTitle>
                    <CardDescription className="text-xs">
                      Search, filter, and export all product sale orders. Filter follows the date range below.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportSalesOrders(orders)}
                      disabled={orders.length === 0}
                      className="gap-1.5 text-xs h-8"
                    >
                      <Download className="h-3.5 w-3.5 text-emerald-600" />
                      Export Table ({orders.length})
                    </Button>
                    {canBuild && (
                      <Button variant="brand" size="sm" onClick={() => setSaleOpen(true)} className="gap-1.5 text-xs h-8">
                        <Plus className="h-3.5 w-3.5" /> Record Sale
                      </Button>
                    )}
                  </div>
                </div>

                {/* Date range picker inside orders tab */}
                <div className="pt-3">
                  <DateRangeFilter value={dateRange} onChange={setDateRange} dense />
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {ordersQuery.isLoading ? (
                  <div className="flex justify-center items-center py-16 text-muted-foreground gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" /> Loading sales orders…
                  </div>
                ) : (
                  <DataTable
                    data={orders}
                    columns={orderColumns}
                    searchKeys={["reference", "customerName", "salespersonName", "notes"]}
                    searchPlaceholder="Search order ref, customer, sales rep, notes…"
                    filters={[
                      {
                        label: "Delivery",
                        options: [
                          { label: "All deliveries", value: "all" },
                          { label: "Delivered", value: "delivered" },
                          { label: "Pending delivery", value: "pending" },
                        ],
                        predicate: (row, val) => (row as BackendSalesOrder).deliveryStatus === val,
                      },
                      {
                        label: "Payment",
                        options: [
                          { label: "All payment states", value: "all" },
                          { label: "Paid", value: "paid" },
                          { label: "Partially paid", value: "partial" },
                          { label: "Unpaid", value: "unpaid" },
                        ],
                        predicate: (row, val) => (row as BackendSalesOrder).paymentStatus === val,
                      },
                    ]}
                    emptyMessage="No sales orders found."
                    emptyHint="Try adjusting your date range or search filters, or record a new sale."
                    onRowClick={(row) => navigate(`/app/sales/orders/${row.id}`)}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: SALES REPORTS & BREAKDOWN (WITH ALL "SEE ALL" OPTIONS AND EXPORT) */}
          <TabsContent value="reports" className="space-y-6">
            {/* Filter and Action Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex-1">
                <DateRangeFilter value={dateRange} onChange={setDateRange} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPrintDialog(true)} className="gap-1.5 h-9">
                  <Printer className="h-4 w-4" />
                  Print / PDF Report
                </Button>
                <Button variant="brand" size="sm" onClick={exportReportSummary} className="gap-1.5 h-9">
                  <FileSpreadsheet className="h-4 w-4" />
                  Export Report (Excel)
                </Button>
              </div>
            </div>

            {/* Range Performance Summary Cards */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="p-4 bg-gradient-to-br from-card to-amber-50/30 dark:to-amber-950/10">
                <p className="text-xs text-muted-foreground font-medium">Period Sales Total</p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {formatCurrency(reports?.rangeSales ?? reports?.monthlySales ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {reports?.rangeOrdersCount ?? orders.length} orders recorded in range
                </p>
              </Card>
              <Card className="p-4 bg-gradient-to-br from-card to-emerald-50/30 dark:to-emerald-950/10">
                <p className="text-xs text-muted-foreground font-medium">Collected in Period</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">
                  {formatCurrency(reports?.rangeCollected ?? reports?.collected ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Invoiced: {formatCurrency(reports?.rangeInvoiced ?? reports?.invoiced ?? 0)}
                </p>
              </Card>
              <Card className="p-4 bg-gradient-to-br from-card to-sky-50/30 dark:to-sky-950/10">
                <p className="text-xs text-muted-foreground font-medium">Unique Items Sold</p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {reports?.productWise?.length ?? 0}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {reports?.detailedLines?.length ?? 0} item transactions
                </p>
              </Card>
              <Card className="p-4 bg-gradient-to-br from-card to-amber-50/30 dark:to-amber-950/10">
                <p className="text-xs text-muted-foreground font-medium">Total Outstanding</p>
                <p className="text-2xl font-bold text-amber-600 mt-1">
                  {formatCurrency(reports?.outstandingTotal ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {reports?.outstanding?.length ?? 0} invoice(s) due
                </p>
              </Card>
            </div>

            {/* Breakdown Category Cards with SEE ALL buttons */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-foreground">Sales Performance Breakdowns</h3>
                <span className="text-xs text-muted-foreground">Click "See all" on any card for full searchable tables</span>
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* 1. Product-wise Sales */}
                <Card className="flex flex-col">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <Package className="h-4 w-4 text-amber-500 shrink-0" />
                      <CardTitle className="text-sm font-semibold truncate">Product-wise Sales</CardTitle>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-primary gap-1"
                      onClick={() =>
                        openCategorySeeAll(
                          "Product-wise Sales Breakdown",
                          reports?.productWise,
                          `All product sales recorded in ${dateRangeLabel}`,
                        )
                      }
                    >
                      See all ({reports?.productWise?.length ?? 0}) <ChevronRight className="h-3 w-3" />
                    </Button>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-2 pt-1">
                    {(reports?.productWise ?? []).length === 0 ? (
                      <p className="text-xs text-muted-foreground py-4 text-center">No product data for this period.</p>
                    ) : (
                      (reports?.productWise ?? []).slice(0, 5).map((row) => (
                        <div key={row.name} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-none">
                          <span className="truncate pr-2 font-medium">{row.name}</span>
                          <span className="shrink-0 font-mono text-muted-foreground">
                            {row.quantity} · <span className="text-foreground font-semibold">{formatCurrency(row.amount)}</span>
                          </span>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                {/* 2. Spare Parts */}
                <Card className="flex flex-col">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <Wrench className="h-4 w-4 text-sky-500 shrink-0" />
                      <CardTitle className="text-sm font-semibold truncate">Spare Parts</CardTitle>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-primary gap-1"
                      onClick={() =>
                        openCategorySeeAll(
                          "Spare Parts Sales Breakdown",
                          reports?.sparePartsSales,
                          `All spare parts sold in ${dateRangeLabel}`,
                        )
                      }
                    >
                      See all ({reports?.sparePartsSales?.length ?? 0}) <ChevronRight className="h-3 w-3" />
                    </Button>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-2 pt-1">
                    {(reports?.sparePartsSales ?? []).length === 0 ? (
                      <p className="text-xs text-muted-foreground py-4 text-center">No spare parts sold in this period.</p>
                    ) : (
                      (reports?.sparePartsSales ?? []).slice(0, 5).map((row) => (
                        <div key={row.name} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-none">
                          <span className="truncate pr-2 font-medium">{row.name}</span>
                          <span className="shrink-0 font-mono text-muted-foreground">
                            {row.quantity} · <span className="text-foreground font-semibold">{formatCurrency(row.amount)}</span>
                          </span>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                {/* 3. Consumables */}
                <Card className="flex flex-col">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <ShoppingBag className="h-4 w-4 text-emerald-500 shrink-0" />
                      <CardTitle className="text-sm font-semibold truncate">Consumables</CardTitle>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-primary gap-1"
                      onClick={() =>
                        openCategorySeeAll(
                          "Consumables Sales Breakdown",
                          reports?.consumablesSales,
                          `All consumable items sold in ${dateRangeLabel}`,
                        )
                      }
                    >
                      See all ({reports?.consumablesSales?.length ?? 0}) <ChevronRight className="h-3 w-3" />
                    </Button>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-2 pt-1">
                    {(reports?.consumablesSales ?? []).length === 0 ? (
                      <p className="text-xs text-muted-foreground py-4 text-center">No consumables sold in this period.</p>
                    ) : (
                      (reports?.consumablesSales ?? []).slice(0, 5).map((row) => (
                        <div key={row.name} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-none">
                          <span className="truncate pr-2 font-medium">{row.name}</span>
                          <span className="shrink-0 font-mono text-muted-foreground">
                            {row.quantity} · <span className="text-foreground font-semibold">{formatCurrency(row.amount)}</span>
                          </span>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                {/* 4. Services / Packages */}
                <Card className="flex flex-col">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <Sparkles className="h-4 w-4 text-purple-500 shrink-0" />
                      <CardTitle className="text-sm font-semibold truncate">Services & Packages</CardTitle>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-primary gap-1"
                      onClick={() =>
                        openCategorySeeAll(
                          "Services & Packages Breakdown",
                          reports?.equipmentSales,
                          `All service packages billed under sales in ${dateRangeLabel}`,
                        )
                      }
                    >
                      See all ({reports?.equipmentSales?.length ?? 0}) <ChevronRight className="h-3 w-3" />
                    </Button>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-2 pt-1">
                    {(reports?.equipmentSales ?? []).length === 0 ? (
                      <p className="text-xs text-muted-foreground py-4 text-center">No service packages sold in this period.</p>
                    ) : (
                      (reports?.equipmentSales ?? []).slice(0, 5).map((row) => (
                        <div key={row.name} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-none">
                          <span className="truncate pr-2 font-medium">{row.name}</span>
                          <span className="shrink-0 font-mono text-muted-foreground">
                            {row.quantity} · <span className="text-foreground font-semibold">{formatCurrency(row.amount)}</span>
                          </span>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                {/* 5. Salesperson Performance */}
                <Card className="flex flex-col">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <Receipt className="h-4 w-4 text-teal-500 shrink-0" />
                      <CardTitle className="text-sm font-semibold truncate">Salesperson Reps</CardTitle>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-primary gap-1"
                      onClick={() =>
                        openCategorySeeAll(
                          "Salesperson Performance Breakdown",
                          reports?.salespersonWise,
                          `Revenue by sales rep in ${dateRangeLabel}`,
                        )
                      }
                    >
                      See all ({reports?.salespersonWise?.length ?? 0}) <ChevronRight className="h-3 w-3" />
                    </Button>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-2 pt-1">
                    {(reports?.salespersonWise ?? []).length === 0 ? (
                      <p className="text-xs text-muted-foreground py-4 text-center">No salesperson data in this period.</p>
                    ) : (
                      (reports?.salespersonWise ?? []).slice(0, 5).map((row) => (
                        <div key={row.name} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-none">
                          <span className="truncate pr-2 font-medium">{row.name}</span>
                          <span className="shrink-0 font-mono text-muted-foreground">
                            {row.quantity} units · <span className="text-foreground font-semibold">{formatCurrency(row.amount)}</span>
                          </span>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                {/* 6. Customer Breakdown */}
                <Card className="flex flex-col">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <ShoppingBag className="h-4 w-4 text-indigo-500 shrink-0" />
                      <CardTitle className="text-sm font-semibold truncate">Customer Sales</CardTitle>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-primary gap-1"
                      onClick={() =>
                        openCategorySeeAll(
                          "Customer Sales Breakdown",
                          reports?.customerWise,
                          `Revenue by customer in ${dateRangeLabel}`,
                        )
                      }
                    >
                      See all ({reports?.customerWise?.length ?? 0}) <ChevronRight className="h-3 w-3" />
                    </Button>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-2 pt-1">
                    {(reports?.customerWise ?? []).length === 0 ? (
                      <p className="text-xs text-muted-foreground py-4 text-center">No customer data in this period.</p>
                    ) : (
                      (reports?.customerWise ?? []).slice(0, 5).map((row) => (
                        <div key={row.name} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-none">
                          <span className="truncate pr-2 font-medium">{row.name}</span>
                          <span className="shrink-0 font-mono text-muted-foreground">
                            {row.quantity} units · <span className="text-foreground font-semibold">{formatCurrency(row.amount)}</span>
                          </span>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* IN-PAGE ALL SOLD ITEMS & DATAS SECTION */}
            <Card className="shadow-sm border">
              <CardHeader className="pb-3 border-b bg-muted/10">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base font-semibold">All Sold Items & Transactions</CardTitle>
                      <Badge variant="secondary" className="font-mono text-xs">
                        {filteredDetailedLines.length} line{filteredDetailedLines.length === 1 ? "" : "s"}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs mt-0.5">
                      Full line-item breakdown of every product and service sold in {dateRangeLabel}.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportSoldLines(filteredDetailedLines)}
                      disabled={filteredDetailedLines.length === 0}
                      className="gap-1.5 text-xs h-8"
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                      Export Items ({filteredDetailedLines.length})
                    </Button>
                  </div>
                </div>

                {/* Filters toolbar for the line items */}
                <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-3">
                  <div className="relative w-full sm:flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by product, SKU, customer, or sales rep…"
                      value={itemSearchQuery}
                      onChange={(e) => setItemSearchQuery(e.target.value)}
                      className="pl-8 h-8 text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Select value={itemClassFilter} onValueChange={setItemClassFilter}>
                      <SelectTrigger className="h-8 text-xs w-full sm:w-[170px]">
                        <SelectValue placeholder="Filter item class" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Item Classes</SelectItem>
                        <SelectItem value="spare_part">Spare Parts</SelectItem>
                        <SelectItem value="consumable">Consumables</SelectItem>
                        <SelectItem value="service">Services / Labor</SelectItem>
                        <SelectItem value="other">Other Items</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {filteredDetailedLines.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm font-medium">No sold item records found.</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Try selecting a different date range or adjusting the filter.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[450px] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background/95 backdrop-blur z-10">
                        <TableRow>
                          <TableHead className="w-28 text-xs">Order Ref</TableHead>
                          <TableHead className="w-24 text-xs">Date</TableHead>
                          <TableHead className="text-xs">Product / Item</TableHead>
                          <TableHead className="w-24 text-xs">Class</TableHead>
                          <TableHead className="text-xs">Customer</TableHead>
                          <TableHead className="text-xs">Sales Rep</TableHead>
                          <TableHead className="text-right w-16 text-xs">Qty</TableHead>
                          <TableHead className="text-right w-24 text-xs">Unit Price</TableHead>
                          <TableHead className="text-right w-28 text-xs">Line Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredDetailedLines.map((line) => (
                          <TableRow key={line.id} className="text-xs hover:bg-muted/40">
                            <TableCell className="font-mono font-medium">
                              <button
                                type="button"
                                className="text-primary hover:underline text-left"
                                onClick={() => navigate(`/app/sales/orders/${line.orderId}`)}
                              >
                                {line.orderReference}
                              </button>
                            </TableCell>
                            <TableCell className="text-muted-foreground whitespace-nowrap">
                              {formatDate(line.orderedAt)}
                            </TableCell>
                            <TableCell>
                              <p className="font-medium text-foreground">{line.description}</p>
                              {line.sku && <p className="font-mono text-[11px] text-muted-foreground">SKU: {line.sku}</p>}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[11px] font-normal capitalize">
                                {line.itemClass || line.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">{line.customerName}</TableCell>
                            <TableCell className="text-muted-foreground">{line.salespersonName}</TableCell>
                            <TableCell className="text-right font-mono tabular-nums font-medium">
                              {line.quantity}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                              {formatCurrency(line.unitPrice)}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums font-semibold text-foreground">
                              {formatCurrency(line.lineTotal)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {canBill ? (
              <p className="text-xs text-muted-foreground">
                Create sale invoices from each order and record customer payments here. Service-ticket invoices are billed separately under Billing.
              </p>
            ) : null}
          </TabsContent>

          {/* TAB 3: INSIGHTS & INVENTORY */}
          <TabsContent value="insights" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
                  <CardTitle className="text-base">Top selling products</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-primary gap-1"
                    onClick={() =>
                      openCategorySeeAll("Top Selling Products", desk?.topSellingProducts, "Historical top selling products")
                    }
                  >
                    See all ({desk?.topSellingProducts?.length ?? 0}) <ChevronRight className="h-3 w-3" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(desk?.topSellingProducts ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Record a sale to populate this list.</p>
                  ) : (
                    desk?.topSellingProducts.map((row) => (
                      <div key={row.name} className="flex items-center justify-between text-sm py-1 border-b border-border/40 last:border-none">
                        <span className="truncate pr-2 font-medium">{row.name}</span>
                        <span className="shrink-0 text-muted-foreground font-mono">
                          {row.quantity} sold · <span className="font-semibold text-foreground">{formatCurrency(row.amount)}</span>
                        </span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <div>
                    <CardTitle className="text-base">Low stock products</CardTitle>
                    <CardDescription className="text-xs">Items at or below reorder level</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
                    <Link to="/app/inventory">Go to Inventory →</Link>
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
                        <div className="min-w-0">
                          <p className="font-medium truncate">{item.name}</p>
                          <p className="font-mono text-xs text-muted-foreground">{item.sku} · {item.category}</p>
                        </div>
                        <span className="shrink-0 text-warning-foreground font-medium text-xs font-mono">
                          {item.available} available
                        </span>
                      </button>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
        </>
        ) : null}

        {/* Dialogs */}
        <SaleFormDialog
          open={saleOpen}
          onOpenChange={setSaleOpen}
          mode="create"
          onSaved={(order) => {
            void queryClient.invalidateQueries({ queryKey: ["sales"] });
            navigate(`/app/sales/orders/${order.id}`);
          }}
        />

        <ReportCategoryDetailDialog
          open={categoryModal.open}
          onOpenChange={(open) => setCategoryModal((prev) => ({ ...prev, open }))}
          title={categoryModal.title}
          subtitle={categoryModal.subtitle}
          rows={categoryModal.rows}
          dateRangeLabel={dateRangeLabel}
        />

        <SalesReportPrintDialog
          open={printDialog}
          onOpenChange={setPrintDialog}
          reports={reports}
          orders={orders}
          dateRangeLabel={dateRangeLabel}
        />
      </div>
    </RoleGuard>
  );
}
