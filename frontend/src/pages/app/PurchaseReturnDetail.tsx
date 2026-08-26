import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { DetailInfoGrid, DetailSection, RecordDetailLayout } from "@/components/shared/RecordDetailLayout";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError, type BackendPurchaseReturn } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";

export default function PurchaseReturnDetail() {
  const { id = "" } = useParams();
  const [row, setRow] = useState<BackendPurchaseReturn | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setRow(await api.getPurchaseReturn(id));
    } catch (err) {
      setRow(null);
      setError(err instanceof ApiError && err.status === 404 ? null : "Please try again.");
      if (!(err instanceof ApiError && err.status === 404)) {
        toast.apiError(err, { fallback: "Failed to load purchase return" });
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <RoleGuard roles={["admin", "inventory"]}>
      <RecordDetailLayout
        backTo="/app/purchase-returns"
        backLabel="Back to Purchase Returns"
        title={row?.reference ?? "Purchase return"}
        subtitle={row ? `${row.purchaseOrder?.supplier ?? "Supplier"} · ${row.purchaseOrder?.reference ?? ""}` : undefined}
        status={row?.status}
        meta={row ? [
          { label: "Lines", value: String(row.items) },
          { label: "Value", value: formatCurrency(row.total) },
          { label: "Returned", value: formatDate(row.returnedAt) },
        ] : undefined}
        loading={loading}
        error={error}
        notFound={!loading && !error && !row}
        notFoundTitle="Purchase return not found"
        notFoundDescription="The requested purchase return could not be found."
        onRetry={() => void load()}
        tabs={row ? [
          {
            id: "overview",
            label: "Overview",
            content: (
              <DetailSection title="Return details">
                <DetailInfoGrid
                  items={[
                    { label: "Purchase order", value: row.purchaseOrder?.reference ?? "—" },
                    { label: "Supplier", value: row.purchaseOrder?.supplier ?? "—" },
                    { label: "Reason", value: (row.reason ?? "—").replace("_", " ") },
                    { label: "Status", value: row.status },
                    { label: "Value", value: formatCurrency(row.total) },
                    { label: "Returned", value: formatDate(row.returnedAt) },
                    { label: "Notes", value: row.notes ?? "—" },
                  ]}
                />
              </DetailSection>
            ),
          },
          {
            id: "lines",
            label: "Line items",
            content: (
              <DetailSection title="Returned lines">
                {!row.lines?.length ? (
                  <p className="text-sm text-muted-foreground">No line details.</p>
                ) : (
                  <div className="space-y-2">
                    {row.lines.map((line) => (
                      <div key={line.id} className="grid grid-cols-[1fr_auto] gap-3 rounded-lg border p-3 text-sm">
                        <div>
                          <p className="font-medium">{line.description}</p>
                          <p className="text-xs text-muted-foreground">{line.sku} · {line.quantity} returned · {formatCurrency(line.unitCost)} ea</p>
                        </div>
                        <span className="font-semibold">{formatCurrency(Number(line.unitCost) * line.quantity)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </DetailSection>
            ),
          },
        ] : undefined}
        sidebar={row ? (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Summary</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Status</span><StatusBadge status={row.status} /></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Value</span><span className="font-semibold">{formatCurrency(row.total)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Lines</span><span>{row.items}</span></div>
            </CardContent>
          </Card>
        ) : undefined}
      />
    </RoleGuard>
  );
}
