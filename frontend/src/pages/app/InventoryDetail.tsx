import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  DetailInfoGrid,
  DetailSection,
  RecordDetailLayout,
} from "@/components/shared/RecordDetailLayout";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError, type BackendInventoryItem } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { toast } from "@/lib/toast";

export default function InventoryDetail() {
  const { id = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [item, setItem] = useState<BackendInventoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adjustDelta, setAdjustDelta] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [saving, setSaving] = useState(false);
  const tab = searchParams.get("tab") ?? "overview";

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setItem(await api.getInventoryItem(id));
    } catch (err) {
      setItem(null);
      setError(err instanceof ApiError && err.status === 404 ? null : "Please try again.");
      if (!(err instanceof ApiError && err.status === 404)) {
        toast.apiError(err, { fallback: "Failed to load inventory item" });
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const adjustStock = async () => {
    if (!item) return;
    setSaving(true);
    try {
      const updated = await api.adjustInventoryStock(item.id, Number(adjustDelta), adjustReason.trim());
      setItem(updated);
      setAdjustDelta("");
      setAdjustReason("");
      toast({ title: "Stock adjusted" });
    } catch (err) {
      toast.apiError(err, { fallback: "Adjustment failed" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <RoleGuard roles={["admin", "inventory", "engineer", "inspector"]}>
      <RecordDetailLayout
        backTo="/app/inventory"
        backLabel="Back to Inventory"
        title={item?.name ?? "Inventory item"}
        subtitle={item ? `${item.sku} · ${item.category}` : undefined}
        meta={item ? [
          { label: "In stock", value: String(item.inStock) },
          { label: "Reserved", value: String(item.reserved) },
          { label: "Supplier", value: item.supplier || "—" },
        ] : undefined}
        loading={loading}
        error={error}
        notFound={!loading && !error && !item}
        notFoundTitle="Inventory item not found"
        notFoundDescription="The requested inventory item could not be found."
        onRetry={() => void load()}
        activeTab={tab}
        onTabChange={(value) => setSearchParams(value === "overview" ? {} : { tab: value })}
        tabs={item ? [
          {
            id: "overview",
            label: "Overview",
            content: (
              <div className="space-y-4">
                <DetailSection title="Item details">
                  <DetailInfoGrid
                    items={[
                      { label: "SKU", value: item.sku },
                      { label: "Category", value: item.category },
                      { label: "In stock", value: String(item.inStock) },
                      { label: "Reserved", value: String(item.reserved) },
                      { label: "Reorder at", value: String(item.reorderLevel) },
                      { label: "UoM", value: item.unitOfMeasure ?? "pcs" },
                      { label: "Unit cost", value: formatCurrency(item.unitCost) },
                      { label: "Selling price", value: formatCurrency(item.sellingPrice ?? 0) },
                      { label: "Delivery", value: `${formatCurrency(item.deliveryCharge ?? 0)} (${item.deliveryChargeType ?? "flat"})` },
                      { label: "Supplier", value: item.supplier },
                    ]}
                  />
                </DetailSection>
                {item.description ? (
                  <DetailSection title="Description">
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </DetailSection>
                ) : null}
              </div>
            ),
          },
          {
            id: "stock",
            label: "Stock",
            content: (
              <DetailSection title="Stock levels">
                <DetailInfoGrid
                  items={[
                    { label: "Available", value: String(item.inStock - item.reserved) },
                    { label: "On hand", value: String(item.inStock) },
                    { label: "Reserved", value: String(item.reserved) },
                    { label: "Reorder level", value: String(item.reorderLevel) },
                  ]}
                />
                {item.inStock <= item.reorderLevel ? (
                  <p className="mt-3 text-sm text-warning-foreground">Stock is at or below reorder level.</p>
                ) : null}
              </DetailSection>
            ),
          },
        ] : undefined}
        sidebar={item ? (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Actions</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {user?.role === "admin" ? (
                <>
                  <p className="text-sm font-medium">Force stock adjustment</p>
                  <Input type="number" value={adjustDelta} onChange={(e) => setAdjustDelta(e.target.value)} placeholder="Delta (+/-)" />
                  <Input value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="Reason (required)" />
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={saving || !adjustReason.trim() || Number(adjustDelta) === 0}
                    onClick={() => void adjustStock()}
                  >
                    Apply adjustment
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Stock adjustments require admin access.</p>
              )}
            </CardContent>
          </Card>
        ) : undefined}
      />
    </RoleGuard>
  );
}
