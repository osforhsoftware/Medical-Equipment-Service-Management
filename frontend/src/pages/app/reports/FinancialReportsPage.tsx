import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { IndianRupee, Receipt, ShoppingBag, Users } from "lucide-react";
import { ReportCategoryLayout } from "@/components/reports/ReportCategoryLayout";
import { ReportSection } from "@/components/reports/ReportSection";
import { ReportTable } from "@/components/reports/ReportTable";
import { BillingMixDoughnut, StackedRevenueChart } from "@/components/charts/DashboardCharts";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useReportFilters } from "@/hooks/useReportFilters";
import { ApiError, api } from "@/lib/api";
import { getReportCategory } from "@/lib/reportCategories";
import { exportActivityRows, exportReportRows } from "@/lib/reportExport";
import { formatCurrency, formatCurrencyShort, formatDate } from "@/lib/format";
import {
  agingBucket,
  asNumber,
  isInDateRange,
  matchesQuery,
  type ReportActivityRow,
  type ReportExportRow,
} from "@/lib/reportUtils";

const category = getReportCategory("financial")!;

export default function FinancialReportsPage() {
  const navigate = useNavigate();
  const { dateRange, search, status, setDateRange, setSearch, setStatus } = useReportFilters();

  const dashboardQuery = useQuery({
    queryKey: ["dashboard", dateRange.from, dateRange.to],
    queryFn: () => api.getDashboard({ from: dateRange.from, to: dateRange.to }),
  });
  const salesQuery = useQuery({
    queryKey: ["sales", "reports", dateRange.from, dateRange.to],
    queryFn: async () => {
      try {
        return await api.getSalesReports({ from: dateRange.from, to: dateRange.to });
      } catch {
        return undefined;
      }
    },
  });
  const invoicesQuery = useQuery({
    queryKey: ["reports", "invoices"],
    queryFn: async () => {
      try {
        return await api.listInvoices();
      } catch {
        return [];
      }
    },
  });

  const dashboard = dashboardQuery.data;
  const sales = salesQuery.data;
  const invoices = invoicesQuery.data ?? [];

  const activityTrend = dashboard?.activityTrend ?? dashboard?.revenueTrend.map((row) => ({
    label: row.month,
    key: row.month,
    jobs: row.jobs,
    tickets: 0,
    revenue: row.revenue,
    saleRevenue: row.saleRevenue ?? 0,
    serviceRevenue: row.serviceRevenue ?? 0,
  })) ?? [];

  const invoicesInRange = useMemo(() => {
    return invoices.filter((invoice) => {
      if (!isInDateRange(invoice.issuedAt, dateRange.from, dateRange.to)) return false;
      const channel = invoice.salesOrderId ? "sale" : "service";
      if (status === "sale" && channel !== "sale") return false;
      if (status === "service" && channel !== "service") return false;
      return matchesQuery(
        search,
        invoice.reference,
        invoice.customerName,
        invoice.jobRef,
        invoice.status,
      );
    });
  }, [invoices, dateRange, search, status]);

  const revenueRows = activityTrend.map((row, index) => ({
    id: row.key || `${row.label}-${index}`,
    label: row.label,
    saleRevenue: row.saleRevenue,
    serviceRevenue: row.serviceRevenue,
    total: row.saleRevenue + row.serviceRevenue,
  }));

  const saleRevenue = dashboard?.period?.totals.saleRevenue ?? sales?.rangeSales ?? 0;
  const serviceRevenue = dashboard?.period?.totals.serviceRevenue ?? 0;
  const mixRows = [
    { type: "Product sales", count: saleRevenue },
    { type: "Service billing", count: serviceRevenue },
  ].filter((row) => row.count > 0);

  const billed = invoicesInRange.reduce((sum, invoice) => sum + asNumber(invoice.total), 0);
  const collected = invoicesInRange.reduce((sum, invoice) => sum + asNumber(invoice.paidTotal), 0);
  const outstanding = invoicesInRange.reduce((sum, invoice) => sum + asNumber(invoice.balanceDue ?? asNumber(invoice.total) - asNumber(invoice.paidTotal)), 0);
  const vatOutput = invoicesInRange.reduce((sum, invoice) => sum + asNumber(invoice.tax), 0);
  const collectionRate = billed > 0 ? (collected / billed) * 100 : 0;

  const vatRows = invoicesInRange.map((invoice) => {
    const taxable = asNumber(invoice.amount);
    const tax = asNumber(invoice.tax);
    return {
      id: invoice.id,
      reference: invoice.reference,
      customerName: invoice.customerName,
      channel: invoice.salesOrderId ? "Sale" : "Service",
      taxable,
      tax,
      total: asNumber(invoice.total),
      status: invoice.status,
    };
  });

  const marginRows = invoicesInRange.map((invoice) => {
    const total = asNumber(invoice.total);
    const paid = asNumber(invoice.paidTotal);
    return {
      id: invoice.id,
      reference: invoice.reference,
      customerName: invoice.customerName,
      channel: invoice.salesOrderId ? "Sale" : "Service",
      total,
      paid,
      outstanding: asNumber(invoice.balanceDue ?? total - paid),
      realized: total > 0 ? (paid / total) * 100 : 0,
      status: invoice.status,
    };
  });

  const agingRows = useMemo(() => {
    const open = invoices.filter((invoice) => {
      const due = asNumber(invoice.balanceDue ?? asNumber(invoice.total) - asNumber(invoice.paidTotal));
      if (due <= 0) return false;
      const channel = invoice.salesOrderId ? "sale" : "service";
      if (status === "sale" && channel !== "sale") return false;
      if (status === "service" && channel !== "service") return false;
      return matchesQuery(search, invoice.reference, invoice.customerName, invoice.status);
    });
    const buckets = new Map<string, { id: string; bucket: string; count: number; amount: number }>();
    for (const invoice of open) {
      const bucket = agingBucket(invoice.dueAt);
      const current = buckets.get(bucket) ?? { id: bucket, bucket, count: 0, amount: 0 };
      current.count += 1;
      current.amount += asNumber(invoice.balanceDue ?? asNumber(invoice.total) - asNumber(invoice.paidTotal));
      buckets.set(bucket, current);
    }
    const order = ["Current", "1–30 days", "31–60 days", "61–90 days", "90+ days", "No due date"];
    return order
      .map((bucket) => buckets.get(bucket))
      .filter((row): row is { id: string; bucket: string; count: number; amount: number } => Boolean(row));
  }, [invoices, search, status]);

  const customerRows = useMemo(() => {
    const fromSales = (sales?.customerWise ?? [])
      .filter((row) => matchesQuery(search, row.name))
      .map((row, index) => ({
        id: `sales-${row.name}-${index}`,
        name: row.name,
        quantity: row.quantity,
        amount: row.amount,
        source: "Sales",
      }));
    const byCustomer = new Map<string, { id: string; name: string; quantity: number; amount: number; source: string }>();
    for (const invoice of invoicesInRange) {
      const key = invoice.customerName || "Unknown";
      const current = byCustomer.get(key) ?? {
        id: `inv-${key}`,
        name: key,
        quantity: 0,
        amount: 0,
        source: "Invoices",
      };
      current.quantity += 1;
      current.amount += asNumber(invoice.total);
      byCustomer.set(key, current);
    }
    const fromInvoices = [...byCustomer.values()].filter((row) => matchesQuery(search, row.name));
    return [...fromSales, ...fromInvoices].sort((a, b) => b.amount - a.amount);
  }, [sales, invoicesInRange, search]);

  const activity = useMemo<ReportActivityRow[]>(() => {
    const invoiceActivity = invoicesInRange.map((invoice) => ({
      id: invoice.id,
      at: invoice.issuedAt,
      actor: invoice.customerName,
      action: `Invoice ${invoice.status} · ${formatCurrency(asNumber(invoice.total))}`,
      reference: invoice.reference,
    }));
    const dashboardActivity = (dashboard?.recentActivity ?? []).map((row) => ({
      id: row.id,
      at: row.at,
      actor: row.actor,
      action: row.action,
      reference: "Dashboard",
    }));
    return [...invoiceActivity, ...dashboardActivity].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 80);
  }, [invoicesInRange, dashboard]);

  const exportRows = useMemo<ReportExportRow[]>(() => {
    return [
      ...revenueRows.map((row) => ({
        section: "Revenue by month",
        name: row.label,
        quantity: 1,
        amount: row.total,
        extra: `Sale ${row.saleRevenue} · Service ${row.serviceRevenue}`,
      })),
      { section: "Service vs sales", name: "Product sales", quantity: 1, amount: saleRevenue },
      { section: "Service vs sales", name: "Service billing", quantity: 1, amount: serviceRevenue },
      ...marginRows.map((row) => ({
        section: "Gross margin",
        name: `${row.reference} · ${row.customerName}`,
        quantity: `${row.realized.toFixed(1)}%`,
        amount: row.total,
        extra: row.channel,
      })),
      ...agingRows.map((row) => ({
        section: "Receivables aging",
        name: row.bucket,
        quantity: row.count,
        amount: row.amount,
      })),
      ...customerRows.map((row) => ({
        section: "Customer profitability",
        name: row.name,
        quantity: row.quantity,
        amount: row.amount,
        extra: row.source,
      })),
      ...vatRows.map((row) => ({
        section: "VAT / tax output",
        name: `${row.reference} · ${row.customerName}`,
        quantity: 1,
        amount: row.tax,
        extra: `${row.channel} · taxable ${row.taxable}`,
      })),
    ];
  }, [revenueRows, saleRevenue, serviceRevenue, marginRows, agingRows, customerRows, vatRows]);

  const loading = dashboardQuery.isLoading || salesQuery.isLoading || invoicesQuery.isLoading;
  const firstError = dashboardQuery.error || salesQuery.error || invoicesQuery.error;
  const error = firstError
    ? firstError instanceof ApiError
      ? firstError.message
      : "Unable to load financial reports"
    : null;

  return (
    <ReportCategoryLayout
      category={category}
      dateRange={dateRange}
      onDateRangeChange={setDateRange}
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search invoice, customer, reference…"
      extraFilters={
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-full sm:w-[180px]">
            <SelectValue placeholder="Channel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All channels</SelectItem>
            <SelectItem value="sale">Product sales</SelectItem>
            <SelectItem value="service">Service billing</SelectItem>
          </SelectContent>
        </Select>
      }
      kpis={[
        { label: "Sale billing", value: formatCurrencyShort(saleRevenue), icon: ShoppingBag },
        { label: "Service billing", value: formatCurrencyShort(serviceRevenue), icon: Receipt },
        { label: "Collected", value: formatCurrencyShort(collected), icon: IndianRupee, accent: "success" },
        { label: "Outstanding", value: formatCurrencyShort(outstanding), icon: Users, accent: "warning" },
        { label: "VAT output", value: formatCurrencyShort(vatOutput), icon: Receipt },
      ]}
      loading={loading}
      error={error}
      onExportAll={() => exportReportRows("financial-reports-all", exportRows)}
      onExportActivity={() => exportActivityRows("financial-reports-activity", activity)}
    >
      <div className="space-y-6">
        <ReportSection
          id="revenue-by-month"
          title="Revenue by month"
          description="Sale vs service billing for the selected range."
          count={revenueRows.length}
          onExport={() =>
            exportReportRows(
              "financial-revenue-by-month",
              revenueRows.map((row) => ({
                section: "Revenue by month",
                name: row.label,
                quantity: 1,
                amount: row.total,
                extra: `Sale ${row.saleRevenue} · Service ${row.serviceRevenue}`,
              })),
            )
          }
        >
          <StackedRevenueChart
            labels={revenueRows.map((row) => row.label)}
            saleRevenue={revenueRows.map((row) => row.saleRevenue)}
            serviceRevenue={revenueRows.map((row) => row.serviceRevenue)}
          />
          <div className="mt-4">
            <ReportTable
              rows={revenueRows}
              columns={[
                { key: "label", header: "Period", render: (row) => row.label },
                { key: "sale", header: "Sale", className: "text-right", render: (row) => formatCurrency(row.saleRevenue) },
                { key: "service", header: "Service", className: "text-right", render: (row) => formatCurrency(row.serviceRevenue) },
                { key: "total", header: "Total", className: "text-right", render: (row) => formatCurrency(row.total) },
              ]}
            />
          </div>
        </ReportSection>

        <ReportSection
          id="service-vs-sales"
          title="Service vs sales"
          description="Billing mix for the selected period."
          count={mixRows.length}
          onExport={() =>
            exportReportRows("financial-service-vs-sales", [
              { section: "Service vs sales", name: "Product sales", quantity: 1, amount: saleRevenue },
              { section: "Service vs sales", name: "Service billing", quantity: 1, amount: serviceRevenue },
            ])
          }
        >
          <BillingMixDoughnut rows={mixRows} />
        </ReportSection>

        <ReportSection
          id="gross-margin"
          title="Gross margin"
          description={`Invoices in range. Collection rate ${collectionRate.toFixed(1)}% (collected ÷ billed).`}
          count={marginRows.length}
          onExport={() =>
            exportReportRows(
              "financial-gross-margin",
              marginRows.map((row) => ({
                section: "Gross margin",
                name: `${row.reference} · ${row.customerName}`,
                quantity: `${row.realized.toFixed(1)}%`,
                amount: row.total,
                extra: row.channel,
              })),
            )
          }
        >
          <ReportTable
            rows={marginRows}
            onRowClick={(row) => navigate(`/app/billing/invoices/${row.id}`)}
            columns={[
              { key: "reference", header: "Invoice", render: (row) => row.reference },
              { key: "customer", header: "Customer", render: (row) => row.customerName },
              { key: "channel", header: "Channel", render: (row) => row.channel },
              { key: "total", header: "Billed", className: "text-right", render: (row) => formatCurrency(row.total) },
              { key: "paid", header: "Collected", className: "text-right", render: (row) => formatCurrency(row.paid) },
              { key: "realized", header: "Realized", className: "text-right", render: (row) => `${row.realized.toFixed(1)}%` },
              { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
            ]}
          />
        </ReportSection>

        <ReportSection
          id="receivables-aging"
          title="Receivables aging"
          description="Open invoice balances by days past due. Snapshot — not limited to the issued date range."
          count={agingRows.length}
          onExport={() =>
            exportReportRows(
              "financial-receivables-aging",
              agingRows.map((row) => ({
                section: "Receivables aging",
                name: row.bucket,
                quantity: row.count,
                amount: row.amount,
              })),
            )
          }
        >
          <ReportTable
            rows={agingRows}
            columns={[
              { key: "bucket", header: "Bucket", render: (row) => row.bucket },
              { key: "count", header: "Invoices", className: "text-right", render: (row) => row.count },
              { key: "amount", header: "Outstanding", className: "text-right", render: (row) => formatCurrency(row.amount) },
            ]}
          />
        </ReportSection>

        <ReportSection
          id="customer-profitability"
          title="Customer profitability"
          description="Sales breakdown plus invoices issued in the selected period."
          count={customerRows.length}
          onExport={() =>
            exportReportRows(
              "financial-customer-profitability",
              customerRows.map((row) => ({
                section: "Customer profitability",
                name: row.name,
                quantity: row.quantity,
                amount: row.amount,
                extra: row.source,
              })),
            )
          }
        >
          <ReportTable
            rows={customerRows}
            columns={[
              { key: "name", header: "Customer", render: (row) => row.name },
              { key: "source", header: "Source", render: (row) => row.source },
              { key: "quantity", header: "Qty / Invoices", className: "text-right", render: (row) => row.quantity },
              { key: "amount", header: "Amount", className: "text-right", render: (row) => formatCurrency(row.amount) },
            ]}
          />
        </ReportSection>

        <ReportSection
          id="vat-output"
          title="VAT / tax output"
          description="Invoice tax collected in the selected range (output VAT from invoice.tax)."
          count={vatRows.length}
          onExport={() =>
            exportReportRows(
              "financial-vat-output",
              vatRows.map((row) => ({
                section: "VAT / tax output",
                name: `${row.reference} · ${row.customerName}`,
                quantity: 1,
                amount: row.tax,
                extra: `${row.channel} · taxable ${row.taxable}`,
              })),
            )
          }
        >
          <ReportTable
            rows={vatRows}
            onRowClick={(row) => navigate(`/app/billing/invoices/${row.id}`)}
            columns={[
              { key: "reference", header: "Invoice", render: (row) => row.reference },
              { key: "customer", header: "Customer", render: (row) => row.customerName },
              { key: "channel", header: "Channel", render: (row) => row.channel },
              { key: "taxable", header: "Taxable", className: "text-right", render: (row) => formatCurrency(row.taxable) },
              { key: "tax", header: "VAT / tax", className: "text-right", render: (row) => formatCurrency(row.tax) },
              { key: "total", header: "Total", className: "text-right", render: (row) => formatCurrency(row.total) },
              { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
            ]}
          />
          <p className="mt-3 text-sm text-muted-foreground">
            Output VAT in range: <span className="font-medium text-foreground">{formatCurrency(vatOutput)}</span>
          </p>
        </ReportSection>

        <ReportSection
          id="activity"
          title="Activity"
          description="Invoice and dashboard activity for the current filters."
          count={activity.length}
          onExport={() => exportActivityRows("financial-reports-activity", activity)}
        >
          <ReportTable
            rows={activity}
            columns={[
              { key: "at", header: "Time", render: (row) => formatDate(row.at) },
              { key: "actor", header: "Actor", render: (row) => row.actor },
              { key: "action", header: "Action", render: (row) => row.action },
              { key: "reference", header: "Reference", render: (row) => row.reference },
            ]}
          />
        </ReportSection>
      </div>
    </ReportCategoryLayout>
  );
}
