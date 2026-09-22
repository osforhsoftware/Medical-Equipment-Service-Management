import { useRef } from "react";
import { Download, FileSpreadsheet, Printer, X, Building2, Calendar, TrendingUp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSettings } from "@/context/SettingsContext";
import { type SalesReportsData, type BackendSalesOrder } from "@/lib/api";
import { downloadSpreadsheet } from "@/lib/exportSpreadsheet";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { toast } from "@/lib/toast";

interface SalesReportPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reports?: SalesReportsData;
  orders?: BackendSalesOrder[];
  dateRangeLabel: string;
}

export function SalesReportPrintDialog({
  open,
  onOpenChange,
  reports,
  orders = [],
  dateRangeLabel,
}: SalesReportPrintDialogProps) {
  const { settings } = useSettings();
  const printRef = useRef<HTMLDivElement>(null);

  const companyName = settings?.companyName || "Medical Equipment Service & Sales Management";
  const companyAddress = settings?.companyAddress || "";
  const companyPhone = settings?.companyPhone || "";
  const companyEmail = settings?.supportEmail || "";

  const handlePrint = () => {
    window.print();
  };

  const handleExportSummary = () => {
    if (!reports) return;

    // Export a comprehensive workbook
    const summaryRows = [
      { Section: "KPI Summary", Metric: "Daily Sales (Today)", Value: formatCurrency(reports.dailySales) },
      { Section: "KPI Summary", Metric: "Monthly Sales (MTD)", Value: formatCurrency(reports.monthlySales) },
      { Section: "KPI Summary", Metric: "Range Total Sales", Value: formatCurrency(reports.rangeSales ?? reports.monthlySales) },
      { Section: "KPI Summary", Metric: "Total Range Orders", Value: String(reports.rangeOrdersCount ?? orders.length) },
      { Section: "KPI Summary", Metric: "Total Invoiced", Value: formatCurrency(reports.invoiced ?? 0) },
      { Section: "KPI Summary", Metric: "Total Collected", Value: formatCurrency(reports.collected ?? 0) },
      { Section: "KPI Summary", Metric: "Total Outstanding", Value: formatCurrency(reports.outstandingTotal ?? 0) },
      ...reports.productWise.map((p) => ({
        Section: "Product Sales",
        Metric: p.name,
        Value: `Qty: ${p.quantity} | Amount: ₹${p.amount}`,
      })),
      ...reports.salespersonWise.map((s) => ({
        Section: "Salesperson Performance",
        Metric: s.name,
        Value: `Qty: ${s.quantity} | Amount: ₹${s.amount}`,
      })),
      ...reports.customerWise.map((c) => ({
        Section: "Customer Sales",
        Metric: c.name,
        Value: `Qty: ${c.quantity} | Amount: ₹${c.amount}`,
      })),
    ];

    downloadSpreadsheet(
      "sales-summary-report",
      [
        { header: "Section", value: (row) => row.Section },
        { header: "Metric / Item", value: (row) => row.Metric },
        { header: "Value / Details", value: (row) => row.Value },
      ],
      summaryRows,
    );
    toast.success("Sales summary exported for Excel.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl flex flex-col p-0 overflow-hidden print:max-w-none print:max-h-none print:border-none print:shadow-none">
        <DialogHeader className="p-4 sm:p-6 pb-3 border-b bg-muted/30 flex flex-row items-center justify-between print:hidden">
          <div>
            <DialogTitle className="text-lg font-bold">Sales Report Preview & Print</DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Period: {dateRangeLabel} · Generated on {formatDateTime(new Date())}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportSummary} className="gap-1.5">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              Export Excel
            </Button>
            <Button variant="brand" size="sm" onClick={handlePrint} className="gap-1.5">
              <Printer className="h-4 w-4" />
              Print / Save PDF
            </Button>
          </div>
        </DialogHeader>

        {/* Printable Area */}
        <div ref={printRef} className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 print:p-0 print:overflow-visible">
          {/* Header */}
          <div className="flex justify-between items-start border-b pb-4">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground">{companyName}</h1>
              {companyAddress && <p className="text-xs text-muted-foreground mt-1">{companyAddress}</p>}
              <p className="text-xs text-muted-foreground">
                {[companyPhone && `Tel: ${companyPhone}`, companyEmail && `Email: ${companyEmail}`].filter(Boolean).join(" · ")}
              </p>
            </div>
            <div className="text-right">
              <Badge variant="outline" className="text-xs font-semibold uppercase tracking-wider mb-1">
                Sales Report
              </Badge>
              <p className="text-xs font-medium text-foreground">Period: {dateRangeLabel}</p>
              <p className="text-[11px] text-muted-foreground">Date: {formatDateTime(new Date())}</p>
            </div>
          </div>

          {/* Executive Summary Metrics */}
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Executive Summary
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg border bg-card p-3 shadow-sm">
                <p className="text-xs text-muted-foreground font-medium">Period Sales</p>
                <p className="text-xl font-bold text-foreground mt-1">
                  {formatCurrency(reports?.rangeSales ?? reports?.monthlySales ?? 0)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {reports?.rangeOrdersCount ?? orders.length} orders in range
                </p>
              </div>
              <div className="rounded-lg border bg-card p-3 shadow-sm">
                <p className="text-xs text-muted-foreground font-medium">Today's Sales</p>
                <p className="text-xl font-bold text-foreground mt-1">
                  {formatCurrency(reports?.dailySales ?? 0)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Live counter</p>
              </div>
              <div className="rounded-lg border bg-card p-3 shadow-sm">
                <p className="text-xs text-muted-foreground font-medium">Total Invoiced / Collected</p>
                <p className="text-xl font-bold text-emerald-600 mt-1">
                  {formatCurrency(reports?.collected ?? 0)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Invoiced: {formatCurrency(reports?.invoiced ?? 0)}
                </p>
              </div>
              <div className="rounded-lg border bg-card p-3 shadow-sm">
                <p className="text-xs text-muted-foreground font-medium">Total Outstanding</p>
                <p className="text-xl font-bold text-amber-600 mt-1">
                  {formatCurrency(reports?.outstandingTotal ?? 0)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Pending collection</p>
              </div>
            </div>
          </div>

          {/* Product & Category Sales Tables */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Top Products */}
            <div className="border rounded-lg p-4 bg-card">
              <h3 className="text-sm font-bold text-foreground mb-2 flex items-center justify-between">
                <span>Top Selling Products</span>
                <span className="text-xs font-normal text-muted-foreground">{reports?.productWise.length ?? 0} items</span>
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="py-2 text-xs">Product</TableHead>
                    <TableHead className="py-2 text-xs text-right">Qty</TableHead>
                    <TableHead className="py-2 text-xs text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(reports?.productWise ?? []).slice(0, 6).map((p) => (
                    <TableRow key={p.name}>
                      <TableCell className="py-1.5 text-xs font-medium truncate max-w-[160px]">{p.name}</TableCell>
                      <TableCell className="py-1.5 text-xs text-right font-mono">{p.quantity}</TableCell>
                      <TableCell className="py-1.5 text-xs text-right font-mono font-medium">{formatCurrency(p.amount)}</TableCell>
                    </TableRow>
                  ))}
                  {(reports?.productWise ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-3">
                        No product sales recorded in this period.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Salesperson Performance */}
            <div className="border rounded-lg p-4 bg-card">
              <h3 className="text-sm font-bold text-foreground mb-2 flex items-center justify-between">
                <span>Salesperson Performance</span>
                <span className="text-xs font-normal text-muted-foreground">{reports?.salespersonWise.length ?? 0} sales reps</span>
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="py-2 text-xs">Sales Rep</TableHead>
                    <TableHead className="py-2 text-xs text-right">Qty</TableHead>
                    <TableHead className="py-2 text-xs text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(reports?.salespersonWise ?? []).slice(0, 6).map((s) => (
                    <TableRow key={s.name}>
                      <TableCell className="py-1.5 text-xs font-medium">{s.name}</TableCell>
                      <TableCell className="py-1.5 text-xs text-right font-mono">{s.quantity}</TableCell>
                      <TableCell className="py-1.5 text-xs text-right font-mono font-medium">{formatCurrency(s.amount)}</TableCell>
                    </TableRow>
                  ))}
                  {(reports?.salespersonWise ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-3">
                        No salesperson data in this period.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Top Customers Breakdown */}
          <div className="border rounded-lg p-4 bg-card">
            <h3 className="text-sm font-bold text-foreground mb-2 flex items-center justify-between">
              <span>Customer Sales Breakdown</span>
              <span className="text-xs font-normal text-muted-foreground">{reports?.customerWise.length ?? 0} customers</span>
            </h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-2 text-xs">Customer Name</TableHead>
                  <TableHead className="py-2 text-xs text-right">Units Purchased</TableHead>
                  <TableHead className="py-2 text-xs text-right">Total Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(reports?.customerWise ?? []).slice(0, 8).map((c) => (
                  <TableRow key={c.name}>
                    <TableCell className="py-1.5 text-xs font-medium">{c.name}</TableCell>
                    <TableCell className="py-1.5 text-xs text-right font-mono">{c.quantity}</TableCell>
                    <TableCell className="py-1.5 text-xs text-right font-mono font-medium">{formatCurrency(c.amount)}</TableCell>
                  </TableRow>
                ))}
                {(reports?.customerWise ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-3">
                      No customer sales in this period.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Orders in Period */}
          {orders.length > 0 && (
            <div className="border rounded-lg p-4 bg-card">
              <h3 className="text-sm font-bold text-foreground mb-2 flex items-center justify-between">
                <span>Recent Orders in Period ({orders.length})</span>
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="py-2 text-xs">Order Ref</TableHead>
                    <TableHead className="py-2 text-xs">Customer</TableHead>
                    <TableHead className="py-2 text-xs">Sales Rep</TableHead>
                    <TableHead className="py-2 text-xs text-center">Delivery</TableHead>
                    <TableHead className="py-2 text-xs text-center">Payment</TableHead>
                    <TableHead className="py-2 text-xs text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.slice(0, 10).map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="py-1.5 text-xs font-mono font-medium">{order.reference}</TableCell>
                      <TableCell className="py-1.5 text-xs">{order.customerName}</TableCell>
                      <TableCell className="py-1.5 text-xs">{order.salespersonName}</TableCell>
                      <TableCell className="py-1.5 text-xs text-center capitalize">{order.deliveryStatus}</TableCell>
                      <TableCell className="py-1.5 text-xs text-center capitalize">{order.paymentStatus}</TableCell>
                      <TableCell className="py-1.5 text-xs text-right font-mono font-medium">{formatCurrency(order.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Footer */}
          <div className="pt-4 border-t text-center text-xs text-muted-foreground">
            <p>Generated by MESMS Product Sales Management Module · Authorized System Report</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
