import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, PackageCheck, Truck } from "lucide-react";
import { DetailInfoGrid, DetailSection, RecordDetailLayout } from "@/components/shared/RecordDetailLayout";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError, type BackendStockTransfer } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";

export default function StockTransferDetail() {
  const { id = "" } = useParams();
  const [row, setRow] = useState<BackendStockTransfer | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setRow(await api.getStockTransfer(id));
    } catch (err) {
      setRow(null);
      setError(err instanceof ApiError && err.status === 404 ? null : "Please try again.");
      if (!(err instanceof ApiError && err.status === 404)) {
        toast.apiError(err, { fallback: "Failed to load stock transfer" });
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (action: "dispatch" | "receive") => {
    if (!row) return;
    setSaving(true);
    try {
      const next = action === "dispatch"
        ? await api.dispatchStockTransfer(row.id)
        : await api.receiveStockTransfer(row.id);
      setRow(next);
      toast({ title: action === "dispatch" ? "Transfer dispatched" : "Transfer received" });
    } catch (err) {
      toast.apiError(err, { fallback: "Action failed" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <RoleGuard roles={["admin", "inventory"]}>
      <RecordDetailLayout
        backTo="/app/stock-transfers"
        backLabel="Back to Stock Transfers"
        title={row?.reference ?? "Stock transfer"}
        subtitle={row ? `${row.fromBranch} → ${row.toBranch}` : undefined}
        status={row?.status}
        meta={row ? [
          { label: "Lines", value: String(row.items) },
          { label: "Created", value: formatDate(row.createdAt) },
        ] : undefined}
        loading={loading}
        error={error}
        notFound={!loading && !error && !row}
        notFoundTitle="Stock transfer not found"
        notFoundDescription="The requested stock transfer could not be found."
        onRetry={() => void load()}
        actions={row && !saving ? (
          row.status === "pending" ? (
            <Button onClick={() => void act("dispatch")}><Truck className="mr-1 h-4 w-4" /> Dispatch</Button>
          ) : row.status === "inTransit" ? (
            <Button onClick={() => void act("receive")}><PackageCheck className="mr-1 h-4 w-4" /> Receive</Button>
          ) : undefined
        ) : saving ? (
          <Button disabled><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Working…</Button>
        ) : undefined}
        tabs={row ? [
          {
            id: "overview",
            label: "Overview",
            content: (
              <DetailSection title="Transfer details">
                <DetailInfoGrid
                  items={[
                    { label: "From", value: row.fromBranch },
                    { label: "To", value: row.toBranch },
                    { label: "Status", value: row.status },
                    { label: "Created", value: formatDate(row.createdAt) },
                  ]}
                />
              </DetailSection>
            ),
          },
          {
            id: "lines",
            label: "Line items",
            content: (
              <DetailSection title="Items">
                {!row.lineItems?.length ? (
                  <p className="text-sm text-muted-foreground">No line details.</p>
                ) : (
                  <div className="space-y-2">
                    {row.lineItems.map((line) => (
                      <div key={line.id} className="rounded-lg border p-3 text-sm">
                        <p className="font-medium">{line.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {line.sku} · qty {line.quantity}
                          {typeof line.quantityReceived === "number" ? ` · received ${line.quantityReceived}` : ""}
                        </p>
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
              <div className="flex justify-between"><span className="text-muted-foreground">Lines</span><span>{row.items}</span></div>
            </CardContent>
          </Card>
        ) : undefined}
      />
    </RoleGuard>
  );
}
