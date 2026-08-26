import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { api, type BackendStockMovement } from "@/lib/api";
import { formatDate } from "@/lib/format";

export default function StockLedger() {
  const rowsQuery = useQuery({
    queryKey: ["stock-movements"],
    queryFn: () => api.listStockMovements(),
  });
  const rows = rowsQuery.data ?? [];

  const columns: Column<BackendStockMovement>[] = useMemo(() => [
    { key: "createdAt", header: "When", render: (row) => <span>{formatDate(row.createdAt)}</span> },
    { key: "item", header: "Item", render: (row) => <div className="flex items-center gap-2"><History className="h-4 w-4 text-primary" /><span>{row.inventoryItem ? `${row.inventoryItem.sku} · ${row.inventoryItem.name}` : row.inventoryItemId}</span></div> },
    { key: "type", header: "Type", render: (row) => <span className="capitalize">{row.type.replace(/_/g, " ")}</span> },
    { key: "quantity", header: "Qty", render: (row) => <span className={row.quantity < 0 ? "text-destructive font-medium" : "font-medium"}>{row.quantity}</span> },
    { key: "balanceAfter", header: "Balance", render: (row) => <span>{row.balanceAfter}</span> },
    { key: "reference", header: "Reference", render: (row) => <span className="text-sm text-muted-foreground">{row.referenceType ? row.referenceType.replace(/_/g, " ") : "—"}</span> },
    { key: "reason", header: "Reason", render: (row) => <span className="text-sm text-muted-foreground">{row.reason ?? "—"}</span> },
  ], []);

  return (
    <RoleGuard roles={["admin", "inventory"]}>
      <div className="space-y-6">
        <PageHeader
          title="Stock Ledger"
          description="Inventory movements from receipts, returns, transfers, jobs, and adjustments."
        />
        <DataTable
          data={rows}
          columns={columns}
          searchKeys={["type", "reason"]}
          emptyMessage="No stock movements yet."
          loading={rowsQuery.isLoading}
          error={rowsQuery.error as Error | null}
          onRetry={() => void rowsQuery.refetch()}
        />
      </div>
    </RoleGuard>
  );
}
