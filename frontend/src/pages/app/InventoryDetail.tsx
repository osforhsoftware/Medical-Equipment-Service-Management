import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { FormFieldError } from "@/components/shared/FormFieldError";
import { RequiredMark } from "@/components/shared/RequiredMark";
import { useFormValidation } from "@/hooks/useFormValidation";
import { fieldAria, fieldErrorClass, fieldRules } from "@/lib/formValidation";
import {
  DetailInfoGrid,
  DetailSection,
  RecordDetailLayout,
} from "@/components/shared/RecordDetailLayout";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError, type BackendInventoryItem } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { toast } from "@/lib/toast";

const adjustSchema = z.object({
  adjustDelta: z.string().refine((v) => v.trim() !== "" && Number(v) !== 0, "Enter a non-zero adjustment."),
  adjustReason: fieldRules.requiredString("Reason"),
});

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
  const adjustRef = useRef<HTMLDivElement>(null);
  const {
    errors,
    shouldShow,
    validateAll,
    handleBlur,
    handleChange,
    applyApiErrors,
    reset: resetValidation,
  } = useFormValidation({
    fieldOrder: ["adjustDelta", "adjustReason"],
    schema: adjustSchema,
  });

  const formValues = () => ({ adjustDelta, adjustReason });

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
    if (!validateAll(formValues(), undefined, adjustRef.current)) return;
    setSaving(true);
    try {
      const updated = await api.adjustInventoryStock(item.id, Number(adjustDelta), adjustReason.trim());
      setItem(updated);
      setAdjustDelta("");
      setAdjustReason("");
      resetValidation();
      toast({ title: "Stock adjusted" });
    } catch (err) {
      if (!applyApiErrors(err, adjustRef.current)) {
        toast.apiError(err, { fallback: "Adjustment failed" });
      }
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
                <form
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault();
                    void adjustStock();
                  }}
                >
                  <div ref={adjustRef} className="space-y-3">
                    <p className="text-sm font-medium">Force stock adjustment</p>
                    <div className="grid gap-2" data-field="adjustDelta">
                      <Label htmlFor="adjust-delta" className={shouldShow("adjustDelta") ? "text-destructive" : undefined}>
                        Delta (+/-)
                        <RequiredMark />
                      </Label>
                      <Input
                        id="adjust-delta"
                        name="adjustDelta"
                        type="number"
                        value={adjustDelta}
                        placeholder="Delta (+/-)"
                        className={fieldErrorClass(shouldShow("adjustDelta"))}
                        {...fieldAria("adjustDelta", shouldShow("adjustDelta") ? errors.adjustDelta : null)}
                        onChange={(e) => {
                          setAdjustDelta(e.target.value);
                          handleChange("adjustDelta", { adjustDelta: e.target.value, adjustReason });
                        }}
                        onBlur={() => handleBlur("adjustDelta", formValues())}
                      />
                      {shouldShow("adjustDelta") && <FormFieldError field="adjustDelta" message={errors.adjustDelta} />}
                    </div>
                    <div className="grid gap-2" data-field="adjustReason">
                      <Label htmlFor="adjust-reason" className={shouldShow("adjustReason") ? "text-destructive" : undefined}>
                        Reason
                        <RequiredMark />
                      </Label>
                      <Input
                        id="adjust-reason"
                        name="adjustReason"
                        value={adjustReason}
                        placeholder="Reason (required)"
                        className={fieldErrorClass(shouldShow("adjustReason"))}
                        {...fieldAria("adjustReason", shouldShow("adjustReason") ? errors.adjustReason : null)}
                        onChange={(e) => {
                          setAdjustReason(e.target.value);
                          handleChange("adjustReason", { adjustDelta, adjustReason: e.target.value });
                        }}
                        onBlur={() => handleBlur("adjustReason", formValues())}
                      />
                      {shouldShow("adjustReason") && <FormFieldError field="adjustReason" message={errors.adjustReason} />}
                    </div>
                    <Button type="submit" size="sm" className="w-full" disabled={saving}>
                      Apply adjustment
                    </Button>
                  </div>
                </form>
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
