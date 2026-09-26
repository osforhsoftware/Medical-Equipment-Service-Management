import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError, type BackendInventoryItem } from "@/lib/api";
import { Eye, Package, ChevronLeft, ChevronRight, ExternalLink, AlertTriangle, Pencil, Trash2, RotateCcw, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import { parseCustomerAdditionalFields, sanitizeCustomerAdditionalFields } from "@/lib/customerFields";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { formatInventoryItemClass } from "@/lib/inventoryItemClass";
import { toast } from "@/lib/toast";

const adjustSchema = z.object({
  adjustDelta: z.string().refine((v) => v.trim() !== "" && Number(v) !== 0, "Enter a non-zero adjustment."),
  adjustReason: fieldRules.requiredString("Reason"),
});

export default function InventoryDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasRole } = useAuth();
  const canAdjust = hasRole(["admin", "inventory"]);
  const [item, setItem] = useState<BackendInventoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adjustDelta, setAdjustDelta] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [damagedOpen, setDamagedOpen] = useState(false);
  const [damagedQty, setDamagedQty] = useState("1");
  const [damagedReason, setDamagedReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const additionalFieldMap = useMemo(() => {
    const fields = parseCustomerAdditionalFields(item?.additionalFields);
    return Object.fromEntries(fields.map((f) => [f.label, f.value]));
  }, [item?.additionalFields]);

  const damagedCount = useMemo(() => {
    if (!item?.additionalFields) return 0;
    const fields = parseCustomerAdditionalFields(item.additionalFields);
    return fields
      .filter((f) => f.label === "Damaged Stock")
      .reduce((sum, f) => {
        const qtyStr = f.value.split(" ")[0];
        return sum + (Number(qtyStr) || 0);
      }, 0);
  }, [item]);

  const logDamagedStock = async () => {
    if (!item) return;
    const qty = Number(damagedQty);
    if (isNaN(qty) || qty <= 0) {
      toast({ title: "Invalid quantity", description: "Quantity must be at least 1", variant: "destructive" });
      return;
    }
    if (!damagedReason.trim()) {
      toast({ title: "Reason required", description: "Please enter a reason for damaged stock", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await api.adjustInventoryStock(item.id, -qty, `DAMAGED: ${damagedReason.trim()}`);
      const existing = parseCustomerAdditionalFields(item.additionalFields);
      const newFields = [
        ...existing,
        { label: "Damaged Stock", value: `${qty} units - ${damagedReason.trim()} (${new Date().toISOString().slice(0, 10)})` },
      ];
      const finalItem = await api.updateInventoryItem(item.id, {
        additionalFields: sanitizeCustomerAdditionalFields(newFields),
      });
      setItem(finalItem);
      setDamagedOpen(false);
      setDamagedQty("1");
      setDamagedReason("");
      toast({ title: "Damaged stock logged", description: `${qty} units segregated and stock reduced.` });
    } catch (err) {
      toast.apiError(err, { fallback: "Failed to log damaged stock" });
    } finally {
      setSaving(false);
    }
  };
  const [previewState, setPreviewState] = useState<{
    title: string;
    images: string[];
    index: number;
  } | null>(null);
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

  const moveToTrash = async () => {
    if (!item) return;
    setDeleting(true);
    try {
      const updated = await api.deleteInventoryItem(item.id);
      setItem(updated);
      setDeleteOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Item moved to trash", {
        description: `${item.name} is inactive. Stock history remains available.`,
      });
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to move item to trash" });
    } finally {
      setDeleting(false);
    }
  };

  const restoreFromTrash = async () => {
    if (!item) return;
    setRestoring(true);
    try {
      const updated = await api.restoreInventoryItem(item.id);
      setItem(updated);
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Item restored", { description: `${item.name} is active again.` });
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to restore item" });
    } finally {
      setRestoring(false);
    }
  };

  return (
    <RoleGuard roles={["admin", "inventory", "engineer"]}>
      <RecordDetailLayout
        backTo="/app/inventory"
        backLabel="Back to Inventory"
        title={item?.name ?? "Inventory item"}
        subtitle={item ? [item.sku, formatInventoryItemClass(item.itemClass), item.category].filter(Boolean).join(" · ") || undefined : undefined}
        meta={item ? [
          { label: "Category", value: formatInventoryItemClass(item.itemClass) },
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
                      { label: "Part ID / SKU", value: item.sku || "—" },
                      { label: "Category", value: formatInventoryItemClass(item.itemClass) },
                      { label: "Technical category", value: item.category || "—" },
                      { label: "Subcategory", value: item.subcategory || "—" },
                      { label: "Manufacturer", value: item.manufacturer || "—" },
                      { label: "Compatible models", value: item.compatibleModels || "—" },
                      { label: "In stock", value: String(item.inStock) },
                      { label: "Available", value: String(item.available ?? Math.max(0, item.inStock - item.reserved)) },
                      { label: "Reserved", value: String(item.reserved) },
                      { label: "Issued", value: String(item.issued ?? 0) },
                      { label: "Damaged", value: String(item.damaged ?? 0) },
                      { label: "Min/max level (min)", value: String(item.reorderLevel) },
                      { label: "Min/max level (max)", value: String(item.maxLevel ?? 0) },
                      { label: "Bin/location", value: item.binLocation || "—" },
                      { label: "Stock unit", value: item.unitOfMeasure ?? "pcs" },
                      { label: "Cost / selling price (cost)", value: formatCurrency(item.unitCost) },
                      { label: "Cost / selling price (selling)", value: formatCurrency(item.sellingPrice ?? 0) },
                      { label: "Delivery", value: `${formatCurrency(item.deliveryCharge ?? 0)} (${item.deliveryChargeType ?? "flat"})` },
                      { label: "Supplier", value: item.supplier },
                      { label: "Batch / serial tracking (batches)", value: item.trackBatches ? "Yes" : "No" },
                      ...(item.trackBatches && additionalFieldMap["Batch numbers"]
                        ? [{ label: "Batch numbers", value: additionalFieldMap["Batch numbers"] }]
                        : []),
                      { label: "Batch / serial tracking (serials)", value: item.trackSerials ? "Yes" : "No" },
                      ...(item.trackSerials && additionalFieldMap["Serial numbers"]
                        ? [{ label: "Serial numbers", value: additionalFieldMap["Serial numbers"] }]
                        : []),
                    ]}
                  />
                </DetailSection>
                {item.images && item.images.length > 0 ? (
                  <DetailSection title="Product Images">
                    <div className="flex flex-wrap gap-3">
                      {item.images.map((img, idx) => (
                        <div
                          key={img.id}
                          className="group relative h-28 w-28 overflow-hidden rounded-xl border border-border shadow-2xs cursor-pointer transition-all hover:border-primary hover:shadow-xs bg-muted"
                          onClick={() =>
                            setPreviewState({
                              title: item.name,
                              images: item.images!.map((i) => api.fileDownloadUrl(i.fileId)),
                              index: idx,
                            })
                          }
                        >
                          <img
                            src={api.fileDownloadUrl(img.fileId)}
                            alt={`${item.name} ${idx + 1}`}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/25 flex items-center justify-center">
                            <Eye className="h-5 w-5 text-white opacity-0 transition-opacity group-hover:opacity-100 drop-shadow-md" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </DetailSection>
                ) : null}
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
                    { label: "Min/max level (min)", value: String(item.reorderLevel) },
                  ]}
                />
                {item.inStock <= item.reorderLevel ? (
                  <p className="mt-3 text-sm text-warning-foreground">Stock is at or below Min/max level (min).</p>
                ) : null}
              </DetailSection>
            ),
          },
        ] : undefined}
        sidebar={item ? (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Actions</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {canAdjust ? (
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => navigate(`/app/inventory?stage=parts&edit=${item.id}`)}
                  >
                    <Pencil className="mr-2 h-4 w-4" /> Edit product
                  </Button>
                  {item.status === "inactive" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      disabled={restoring}
                      onClick={() => void restoreFromTrash()}
                    >
                      {restoring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                      Restore from trash
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-destructive hover:text-destructive"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Move to trash
                    </Button>
                  )}
                </div>
              ) : null}
              {canAdjust ? (
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
                <p className="text-sm text-muted-foreground">Stock adjustments require inventory access.</p>
              )}
              {canAdjust && (
                <div className="pt-2 border-t border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Damaged Stock Segregation</span>
                    {damagedCount > 0 && (
                      <Badge variant="destructive" className="text-[10px]">
                        🔴 {damagedCount} Damaged
                      </Badge>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full text-destructive border-destructive/40 hover:bg-destructive/10"
                    onClick={() => setDamagedOpen(true)}
                  >
                    <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
                    Log Damaged Stock
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ) : undefined}
      />

      <Dialog open={damagedOpen} onOpenChange={setDamagedOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Log Damaged Stock
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Logging damaged stock will reduce available stock and record the segregated items for inspection.
            </p>
            <div className="space-y-1">
              <Label htmlFor="damaged-qty">Quantity Damaged</Label>
              <Input
                id="damaged-qty"
                type="number"
                min={1}
                value={damagedQty}
                onChange={(e) => setDamagedQty(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="damaged-reason">Reason / Damage Description</Label>
              <Textarea
                id="damaged-reason"
                placeholder="e.g. Water damage in transit, cracked housing, burnt circuit board"
                value={damagedReason}
                onChange={(e) => setDamagedReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDamagedOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => void logDamagedStock()} disabled={saving}>
              {saving ? "Saving…" : "Log Damaged Stock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {previewState ? (
        <Dialog open={Boolean(previewState)} onOpenChange={(open) => !open && setPreviewState(null)}>
          <DialogContent className="sm:max-w-xl p-0 overflow-hidden bg-background border-border">
            <DialogHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
              <div>
                <DialogTitle className="text-base font-semibold">{previewState.title}</DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Image {previewState.index + 1} of {previewState.images.length}
                </p>
              </div>
            </DialogHeader>
            <div className="relative flex items-center justify-center min-h-[340px] max-h-[520px] bg-black/95 p-4">
              <img
                src={previewState.images[previewState.index]}
                alt={previewState.title}
                className="max-h-[480px] max-w-full rounded-md object-contain shadow-2xl"
              />
              {previewState.images.length > 1 ? (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/60 border-white/20 text-white hover:bg-black/80"
                    onClick={() =>
                      setPreviewState((prev) =>
                        prev
                          ? {
                              ...prev,
                              index: (prev.index - 1 + prev.images.length) % prev.images.length,
                            }
                          : null
                      )
                    }
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/60 border-white/20 text-white hover:bg-black/80"
                    onClick={() =>
                      setPreviewState((prev) =>
                        prev
                          ? {
                              ...prev,
                              index: (prev.index + 1) % prev.images.length,
                            }
                          : null
                      )
                    }
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </>
              ) : null}
            </div>
            <div className="p-3 border-t border-border flex justify-between items-center bg-muted/30">
              <div className="flex gap-2 overflow-x-auto">
                {previewState.images.map((url, i) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setPreviewState((prev) => (prev ? { ...prev, index: i } : null))}
                    className={cn(
                      "h-10 w-10 overflow-hidden rounded-lg border transition-all cursor-pointer",
                      i === previewState.index ? "border-primary ring-2 ring-primary/30" : "border-border opacity-60 hover:opacity-100"
                    )}
                  >
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => window.open(previewState.images[previewState.index], "_blank")}
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open original
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!deleting) setDeleteOpen(open);
        }}
        title="Move to trash?"
        description={
          <div className="space-y-2">
            <p>
              This soft-removes{" "}
              <span className="font-medium text-foreground">{item?.name}</span>
              {item?.sku ? ` (${item.sku})` : ""}. The product is marked inactive — not permanently erased.
            </p>
            <p>Stock history and linked documents remain. You can restore it later from Inventory → Status: Trash.</p>
          </div>
        }
        confirmLabel="Move to trash"
        loading={deleting}
        onConfirm={() => void moveToTrash()}
      />
    </RoleGuard>
  );
}
