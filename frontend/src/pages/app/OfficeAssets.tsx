import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Building, Loader2, Plus } from "lucide-react";
import { FormFieldError } from "@/components/shared/FormFieldError";
import { RequiredMark } from "@/components/shared/RequiredMark";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useFormValidation } from "@/hooks/useFormValidation";
import { fieldAria, fieldErrorClass, fieldRules } from "@/lib/formValidation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, type BackendOfficeAsset, type OfficeAssetInput } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";

const blank: OfficeAssetInput = { assetTag: "", name: "", category: "", serialNumber: "", purchaseDate: "", purchaseCost: 0, notes: "" };

const assetSchema = z.object({
  assetTag: fieldRules.requiredString("Asset tag"),
  name: fieldRules.requiredString("Name"),
  category: fieldRules.requiredString("Category"),
  serialNumber: fieldRules.optionalString(),
  purchaseDate: fieldRules.optionalString(),
  purchaseCost: fieldRules.nonNegativeNumber("Purchase cost"),
  notes: fieldRules.optionalString(),
});

export default function OfficeAssets() {
  const queryClient = useQueryClient();
  const assetsQuery = useQuery({
    queryKey: ["office-assets"],
    queryFn: async () => {
      const result = await api.listOfficeAssets();
      return Array.isArray(result) ? result : (result as { data: BackendOfficeAsset[] }).data;
    },
  });
  const assets = assetsQuery.data ?? [];
  const [form, setForm] = useState<OfficeAssetInput>(blank);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const {
    errors,
    shouldShow,
    validateAll,
    handleBlur,
    handleChange,
    applyApiErrors,
    reset: resetValidation,
  } = useFormValidation({
    fieldOrder: ["assetTag", "category", "name", "purchaseCost"],
    schema: assetSchema,
  });

  const save = async () => {
    if (!validateAll(form, undefined, dialogRef.current)) return;
    setSaving(true);
    try {
      await api.createOfficeAsset({ ...form, purchaseDate: form.purchaseDate || null, serialNumber: form.serialNumber || null, notes: form.notes || null });
      setOpen(false);
      setForm(blank);
      resetValidation();
      await queryClient.invalidateQueries({ queryKey: ["office-assets"] });
      toast({ title: "Office asset created" });
    } catch (error) {
      if (!applyApiErrors(error, dialogRef.current)) {
        toast.apiError(error, { fallback: "Request failed" });
      }
    }
    finally { setSaving(false); }
  };

  const columns: Column<BackendOfficeAsset>[] = [
    { key: "assetTag", header: "Asset", render: (asset) => <div className="flex items-center gap-2"><Building className="h-4 w-4 text-primary" /><div><p className="font-medium">{asset.name}</p><p className="font-mono text-xs text-muted-foreground">{asset.assetTag}</p></div></div> },
    { key: "category", header: "Category", render: (asset) => <span>{asset.category}</span> },
    { key: "serialNumber", header: "Serial", render: (asset) => <span className="font-mono text-xs">{asset.serialNumber || "—"}</span> },
    { key: "purchaseDate", header: "Purchased", render: (asset) => <span>{asset.purchaseDate ? formatDate(asset.purchaseDate) : "—"}</span> },
    { key: "purchaseCost", header: "Cost", render: (asset) => <span>{formatCurrency(asset.purchaseCost)}</span> },
    { key: "status", header: "Status", render: (asset) => <StatusBadge status={asset.status} /> },
  ];

  return <div className="space-y-6">
    <PageHeader title="Office Assets" description="Internal equipment and acquisition details." actions={<Button variant="brand" onClick={() => { resetValidation(); setOpen(true); }}><Plus className="mr-1 h-4 w-4" /> Add asset</Button>} />
    {assetsQuery.isLoading ? <div className="flex justify-center gap-2 py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading assets…</div> : <DataTable data={assets} columns={columns} searchKeys={["assetTag", "name", "category", "serialNumber"]} searchPlaceholder="Search assets…" emptyMessage="No office assets recorded." />}
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) resetValidation(); setOpen(isOpen); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Add office asset</DialogTitle></DialogHeader>
        <form noValidate onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <div ref={dialogRef} className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2" data-field="assetTag">
                <Label htmlFor="asset-tag" className={shouldShow("assetTag") ? "text-destructive" : undefined}>Asset tag<RequiredMark /></Label>
                <Input id="asset-tag" name="assetTag" value={form.assetTag} className={fieldErrorClass(shouldShow("assetTag"))} {...fieldAria("assetTag", shouldShow("assetTag") ? errors.assetTag : null)} onChange={(e) => { const next = { ...form, assetTag: e.target.value }; setForm(next); handleChange("assetTag", next); }} onBlur={() => handleBlur("assetTag", form)} />
                {shouldShow("assetTag") && <FormFieldError field="assetTag" message={errors.assetTag} />}
              </div>
              <div className="grid gap-2" data-field="category">
                <Label htmlFor="asset-category" className={shouldShow("category") ? "text-destructive" : undefined}>Category<RequiredMark /></Label>
                <Input id="asset-category" name="category" value={form.category} className={fieldErrorClass(shouldShow("category"))} {...fieldAria("category", shouldShow("category") ? errors.category : null)} onChange={(e) => { const next = { ...form, category: e.target.value }; setForm(next); handleChange("category", next); }} onBlur={() => handleBlur("category", form)} />
                {shouldShow("category") && <FormFieldError field="category" message={errors.category} />}
              </div>
            </div>
            <div className="grid gap-2" data-field="name">
              <Label htmlFor="asset-name" className={shouldShow("name") ? "text-destructive" : undefined}>Name<RequiredMark /></Label>
              <Input id="asset-name" name="name" value={form.name} className={fieldErrorClass(shouldShow("name"))} {...fieldAria("name", shouldShow("name") ? errors.name : null)} onChange={(e) => { const next = { ...form, name: e.target.value }; setForm(next); handleChange("name", next); }} onBlur={() => handleBlur("name", form)} />
              {shouldShow("name") && <FormFieldError field="name" message={errors.name} />}
            </div>
            <div className="grid gap-2"><Label htmlFor="asset-serial">Serial number</Label><Input id="asset-serial" value={form.serialNumber ?? ""} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2"><Label htmlFor="asset-purchase-date">Purchase date</Label><Input id="asset-purchase-date" type="date" value={form.purchaseDate ?? ""} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} /></div>
              <div className="grid gap-2" data-field="purchaseCost">
                <Label htmlFor="asset-purchase-cost">Purchase cost</Label>
                <Input id="asset-purchase-cost" name="purchaseCost" type="number" min={0} value={form.purchaseCost} className={fieldErrorClass(shouldShow("purchaseCost"))} {...fieldAria("purchaseCost", shouldShow("purchaseCost") ? errors.purchaseCost : null)} onChange={(e) => { const next = { ...form, purchaseCost: Number(e.target.value) }; setForm(next); handleChange("purchaseCost", next); }} onBlur={() => handleBlur("purchaseCost", form)} />
                {shouldShow("purchaseCost") && <FormFieldError field="purchaseCost" message={errors.purchaseCost} />}
              </div>
            </div>
            <div className="grid gap-2"><Label htmlFor="asset-notes">Notes</Label><Textarea id="asset-notes" value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>;
}
