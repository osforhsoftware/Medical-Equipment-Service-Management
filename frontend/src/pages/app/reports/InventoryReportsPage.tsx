import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Boxes, ShoppingCart, Wrench } from "lucide-react";
import { ReportCategoryLayout } from "@/components/reports/ReportCategoryLayout";
import { ReportSection } from "@/components/reports/ReportSection";
import { ReportTable } from "@/components/reports/ReportTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useReportFilters } from "@/hooks/useReportFilters";
import { ApiError, api, type BackendInventoryItem, type BackendPurchaseOrder, type BackendServiceJob } from "@/lib/api";
import { getReportCategory } from "@/lib/reportCategories";
import { exportActivityRows, exportReportRows } from "@/lib/reportExport";
import { formatCurrency, formatCurrencyShort, formatDate } from "@/lib/format";
import {
  asNumber,
  isInDateRange,
  matchesQuery,
  type ReportActivityRow,
  type ReportExportRow,
} from "@/lib/reportUtils";

const category = getReportCategory("inventory")!;

function emptyOnError<T>(fallback: T) {
  return async (fn: () => Promise<T>) => {
    try {
      return await fn();
    } catch {
      return fallback;
    }
  };
}

export default function InventoryReportsPage() {
  const navigate = useNavigate();
  const { dateRange, search, status, setDateRange, setSearch, setStatus } = useReportFilters();

  const inventoryQuery = useQuery({
    queryKey: ["reports", "inventory"],
    queryFn: () => emptyOnError({ data: [] as BackendInventoryItem[] })(() => api.listInventory({ limit: 100, page: 1, status: "active" })),
  });
  const purchaseQuery = useQuery({
    queryKey: ["reports", "purchase-orders"],
    queryFn: () => emptyOnError({ data: [] as BackendPurchaseOrder[] })(() => api.listPurchaseOrders({ limit: 100, page: 1 })),
  });
  const jobsQuery = useQuery({
    queryKey: ["reports", "jobs"],
    queryFn: () => emptyOnError({ data: [] as BackendServiceJob[] })(() => api.listJobs({ limit: 100, page: 1, completedScope: "all" })),
  });

  const items = inventoryQuery.data?.data ?? [];
  const purchaseOrders = purchaseQuery.data?.data ?? [];
  const jobs = jobsQuery.data?.data ?? [];

  const stockRows = useMemo(() => {
    return items
      .map((item) => {
        const cost = asNumber(item.unitCost);
        const qty = item.inStock;
        const low = qty <= item.reorderLevel;
        return {
          ...item,
          value: cost * qty,
          low,
        };
      })
      .filter((item) => {
        if (status === "low" && !item.low) return false;
        if (status === "ok" && item.low) return false;
        return matchesQuery(search, item.name, item.sku, item.category, item.supplier);
      })
      .sort((a, b) => b.value - a.value);
  }, [items, search, status]);

  const stockValue = stockRows.reduce((sum, item) => sum + item.value, 0);

  const consumptionRows = useMemo(() => {
    const rows: { id: string; jobId: string; reference: string; item: string; quantity: number; amount: number; at: string }[] = [];
    for (const job of jobs) {
      if (!isInDateRange(job.updatedAt, dateRange.from, dateRange.to)) continue;
      if (!matchesQuery(search, job.reference, job.customerName, job.equipmentName)) continue;
      for (const extra of job.extras ?? []) {
        rows.push({
          id: extra.id,
          jobId: job.id,
          reference: job.reference,
          item: extra.description,
          quantity: asNumber(extra.quantity),
          amount: asNumber(extra.quantity) * asNumber(extra.unitPrice),
          at: extra.createdAt,
        });
      }
    }
    return rows;
  }, [jobs, dateRange, search]);

  const moverRows = useMemo(() => {
    const usage = new Map<string, { id: string; name: string; quantity: number; amount: number }>();
    for (const row of consumptionRows) {
      const current = usage.get(row.item) ?? { id: row.item, name: row.item, quantity: 0, amount: 0 };
      current.quantity += row.quantity;
      current.amount += row.amount;
      usage.set(row.item, current);
    }
    const used = [...usage.values()].sort((a, b) => b.quantity - a.quantity);
    const usedNames = new Set(used.map((row) => row.name.toLowerCase()));
    const unused = items
      .filter((item) => !usedNames.has(item.name.toLowerCase()) && matchesQuery(search, item.name, item.sku))
      .map((item) => ({
        id: `slow-${item.id}`,
        name: item.name,
        quantity: 0,
        amount: asNumber(item.unitCost) * item.inStock,
        pace: "Slow",
      }));
    return [
      ...used.slice(0, 15).map((row) => ({ ...row, pace: "Fast" })),
      ...unused.slice(0, 15),
    ];
  }, [consumptionRows, items, search]);

  const purchaseRows = useMemo(() => {
    return purchaseOrders.filter((order) => {
      if (!isInDateRange(order.createdAt, dateRange.from, dateRange.to)) return false;
      if (status === "low") return false;
      return matchesQuery(search, order.reference, order.supplier, order.status);
    });
  }, [purchaseOrders, dateRange, search, status]);

  const reorderRows = useMemo(() => {
    return items
      .filter((item) => item.inStock <= item.reorderLevel)
      .filter((item) => matchesQuery(search, item.name, item.sku, item.category, item.supplier));
  }, [items, search]);

  const activity = useMemo<ReportActivityRow[]>(() => {
    const fromPurchases = purchaseRows.map((order) => ({
      id: order.id,
      at: order.updatedAt,
      actor: order.supplier,
      action: `PO ${order.status} · ${formatCurrency(asNumber(order.total))}`,
      reference: order.reference,
    }));
    const fromConsumption = consumptionRows.map((row) => ({
      id: row.id,
      at: row.at,
      actor: "Job parts",
      action: `${row.item} × ${row.quantity}`,
      reference: row.reference,
    }));
    return [...fromPurchases, ...fromConsumption].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 80);
  }, [purchaseRows, consumptionRows]);

  const exportRows = useMemo<ReportExportRow[]>(() => {
    return [
      ...stockRows.map((item) => ({
        section: "Stock valuation",
        name: `${item.sku} · ${item.name}`,
        quantity: item.inStock,
        amount: item.value,
        extra: item.category,
      })),
      ...consumptionRows.map((row) => ({
        section: "Consumption by job",
        name: `${row.reference} · ${row.item}`,
        quantity: row.quantity,
        amount: row.amount,
      })),
      ...moverRows.map((row) => ({
        section: "Fast / slow movers",
        name: row.name,
        quantity: row.quantity,
        amount: row.amount,
        extra: row.pace,
      })),
      ...purchaseRows.map((order) => ({
        section: "Purchase history",
        name: `${order.reference} · ${order.supplier}`,
        quantity: order.items,
        amount: asNumber(order.total),
        extra: order.status,
      })),
      ...reorderRows.map((item) => ({
        section: "Reorder report",
        name: `${item.sku} · ${item.name}`,
        quantity: `${item.inStock}/${item.reorderLevel}`,
        amount: asNumber(item.unitCost) * item.inStock,
      })),
    ];
  }, [stockRows, consumptionRows, moverRows, purchaseRows, reorderRows]);

  const loading = inventoryQuery.isLoading || purchaseQuery.isLoading || jobsQuery.isLoading;
  const firstError = inventoryQuery.error || purchaseQuery.error || jobsQuery.error;
  const error = firstError
    ? firstError instanceof ApiError
      ? firstError.message
      : "Unable to load inventory reports"
    : null;

  return (
    <ReportCategoryLayout
      category={category}
      dateRange={dateRange}
      onDateRangeChange={setDateRange}
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search SKU, item, supplier, job…"
      extraFilters={
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-full sm:w-[180px]">
            <SelectValue placeholder="Stock" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stock</SelectItem>
            <SelectItem value="low">Low stock only</SelectItem>
            <SelectItem value="ok">Healthy stock</SelectItem>
          </SelectContent>
        </Select>
      }
      kpis={[
        { label: "Stock value", value: formatCurrencyShort(stockValue), icon: Boxes },
        { label: "Consumed lines", value: String(consumptionRows.length), icon: Wrench },
        { label: "Purchase orders", value: String(purchaseRows.length), icon: ShoppingCart },
        { label: "Reorder items", value: String(reorderRows.length), icon: AlertTriangle, accent: "warning" },
      ]}
      loading={loading}
      error={error}
      onExportAll={() => exportReportRows("inventory-reports-all", exportRows)}
      onExportActivity={() => exportActivityRows("inventory-reports-activity", activity)}
    >
      <div className="space-y-6">
        <ReportSection
          id="stock-valuation"
          title="Stock valuation"
          description="Current on-hand value (qty × unit cost). Live snapshot."
          count={stockRows.length}
          onExport={() =>
            exportReportRows(
              "inventory-stock-valuation",
              stockRows.map((item) => ({
                section: "Stock valuation",
                name: `${item.sku} · ${item.name}`,
                quantity: item.inStock,
                amount: item.value,
                extra: item.category,
              })),
            )
          }
        >
          <ReportTable
            rows={stockRows}
            onRowClick={(item) => navigate(`/app/inventory/${item.id}`)}
            columns={[
              { key: "sku", header: "SKU", render: (item) => item.sku },
              { key: "name", header: "Item", render: (item) => item.name },
              { key: "qty", header: "On hand", className: "text-right", render: (item) => item.inStock },
              { key: "cost", header: "Unit cost", className: "text-right", render: (item) => formatCurrency(asNumber(item.unitCost)) },
              { key: "value", header: "Value", className: "text-right", render: (item) => formatCurrency(item.value) },
            ]}
          />
        </ReportSection>

        <ReportSection
          id="consumption-by-job"
          title="Consumption by job"
          description="Parts and extras booked on jobs updated in the selected period."
          count={consumptionRows.length}
          onExport={() =>
            exportReportRows(
              "inventory-consumption-by-job",
              consumptionRows.map((row) => ({
                section: "Consumption by job",
                name: `${row.reference} · ${row.item}`,
                quantity: row.quantity,
                amount: row.amount,
              })),
            )
          }
        >
          <ReportTable
            rows={consumptionRows}
            onRowClick={(row) => navigate(`/app/jobs/${row.jobId}`)}
            columns={[
              { key: "reference", header: "Job", render: (row) => row.reference },
              { key: "item", header: "Item", render: (row) => row.item },
              { key: "qty", header: "Qty", className: "text-right", render: (row) => row.quantity },
              { key: "amount", header: "Amount", className: "text-right", render: (row) => formatCurrency(row.amount) },
              { key: "at", header: "Date", render: (row) => formatDate(row.at) },
            ]}
          />
        </ReportSection>

        <ReportSection
          id="fast-slow-movers"
          title="Fast / slow movers"
          description="Fast movers used on jobs in range. Slow movers have no job consumption in range."
          count={moverRows.length}
          onExport={() =>
            exportReportRows(
              "inventory-fast-slow-movers",
              moverRows.map((row) => ({
                section: "Fast / slow movers",
                name: row.name,
                quantity: row.quantity,
                amount: row.amount,
                extra: row.pace,
              })),
            )
          }
        >
          <ReportTable
            rows={moverRows}
            columns={[
              { key: "name", header: "Item", render: (row) => row.name },
              { key: "pace", header: "Pace", render: (row) => <StatusBadge status={row.pace.toLowerCase()} /> },
              { key: "qty", header: "Used", className: "text-right", render: (row) => row.quantity },
              { key: "amount", header: "Value", className: "text-right", render: (row) => formatCurrency(row.amount) },
            ]}
          />
        </ReportSection>

        <ReportSection
          id="purchase-history"
          title="Purchase history"
          description="Purchase orders created in the selected period."
          count={purchaseRows.length}
          onExport={() =>
            exportReportRows(
              "inventory-purchase-history",
              purchaseRows.map((order) => ({
                section: "Purchase history",
                name: `${order.reference} · ${order.supplier}`,
                quantity: order.items,
                amount: asNumber(order.total),
                extra: order.status,
              })),
            )
          }
        >
          <ReportTable
            rows={purchaseRows}
            onRowClick={(order) => navigate(`/app/purchase-orders/${order.id}`)}
            columns={[
              { key: "reference", header: "PO", render: (order) => order.reference },
              { key: "supplier", header: "Supplier", render: (order) => order.supplier },
              { key: "items", header: "Lines", className: "text-right", render: (order) => order.items },
              { key: "total", header: "Total", className: "text-right", render: (order) => formatCurrency(asNumber(order.total)) },
              { key: "status", header: "Status", render: (order) => <StatusBadge status={order.status} /> },
              { key: "created", header: "Created", render: (order) => formatDate(order.createdAt) },
            ]}
          />
        </ReportSection>

        <ReportSection
          id="reorder-report"
          title="Reorder report"
          description="Items at or below reorder level. Live snapshot."
          count={reorderRows.length}
          onExport={() =>
            exportReportRows(
              "inventory-reorder-report",
              reorderRows.map((item) => ({
                section: "Reorder report",
                name: `${item.sku} · ${item.name}`,
                quantity: `${item.inStock}/${item.reorderLevel}`,
                amount: asNumber(item.unitCost) * item.inStock,
              })),
            )
          }
        >
          <ReportTable
            rows={reorderRows}
            onRowClick={(item) => navigate(`/app/inventory/${item.id}`)}
            columns={[
              { key: "sku", header: "SKU", render: (item) => item.sku },
              { key: "name", header: "Item", render: (item) => item.name },
              { key: "stock", header: "On hand", className: "text-right", render: (item) => item.inStock },
              { key: "reorder", header: "Reorder at", className: "text-right", render: (item) => item.reorderLevel },
              { key: "supplier", header: "Supplier", render: (item) => item.supplier || "—" },
            ]}
          />
        </ReportSection>

        <ReportSection
          id="activity"
          title="Activity"
          description="Purchase and job-consumption activity for the current filters."
          count={activity.length}
          onExport={() => exportActivityRows("inventory-reports-activity", activity)}
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
