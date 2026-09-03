import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Loader2, Pencil, Plus, Wrench } from "lucide-react";
import { FormFieldError } from "@/components/shared/FormFieldError";
import { RequiredMark } from "@/components/shared/RequiredMark";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useFormValidation } from "@/hooks/useFormValidation";
import { fieldAria, fieldErrorClass, fieldRules } from "@/lib/formValidation";
import { api, type BackendCatalogItem, type CatalogItemInput } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { toast } from "@/lib/toast";
import { useAuth } from "@/context/AuthContext";
import { CATALOG_WRITE_ROLES } from "@/config/roles";

const catalogSchema = z.object({
  code: fieldRules.requiredString("Code"),
  name: fieldRules.requiredString("Name"),
  description: fieldRules.optionalString(),
  category: fieldRules.requiredString("Category"),
  unit: fieldRules.requiredString("Unit"),
  unitPrice: fieldRules.nonNegativeNumber("Rate"),
  taxRate: z
    .number({ invalid_type_error: "Tax must be a number." })
    .min(0, "Tax cannot be negative.")
    .max(100, "Tax cannot exceed 100%."),
  isActive: z.boolean(),
});

const blank: CatalogItemInput = {
  code: "",
  name: "",
  description: "",
  category: "",
  unit: "service",
  unitPrice: 0,
  taxRate: 0,
  isActive: true,
};

export default function ServiceCatalog() {
  const { hasRole } = useAuth();
  const canManage = hasRole(CATALOG_WRITE_ROLES);
  const queryClient = useQueryClient();
  const catalogQuery = useQuery({
    queryKey: ["service-catalog"],
    queryFn: () => api.listServiceCatalog(),
  });
  const items = catalogQuery.data ?? [];
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<BackendCatalogItem | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CatalogItemInput>(blank);
  const dialogRef = useRef<HTMLDivElement>(null);

  const {
    errors,
    shouldShow,
    reset: resetValidation,
    validateAll,
    handleBlur,
    handleChange,
    applyApiErrors,
  } = useFormValidation({
    fieldOrder: ["code", "category", "name", "unit", "unitPrice", "taxRate"],
    schema: catalogSchema,
  });

  const edit = (item?: BackendCatalogItem) => {
    if (!canManage) return;
    setEditing(item ?? null);
    setForm(item ? {
      branchId: item.branchId,
      code: item.code,
      name: item.name,
      description: item.description,
      category: item.category,
      unit: item.unit,
      unitPrice: Number(item.unitPrice),
      taxRate: Number(item.taxRate),
      isActive: item.isActive,
    } : blank);
    resetValidation();
    setOpen(true);
  };

  const save = async () => {
    if (!validateAll(form, undefined, dialogRef.current)) return;

    setSaving(true);
    try {
      if (editing) await api.updateServiceCatalogItem(editing.id, form);
      else await api.createServiceCatalogItem(form);
      setOpen(false);
      resetValidation();
      await queryClient.invalidateQueries({ queryKey: ["service-catalog"] });
      toast({ title: editing ? "Service updated" : "Service created" });
    } catch (error) {
      if (!applyApiErrors(error, dialogRef.current)) {
        toast.apiError(error, { fallback: "Request failed" });
      }
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<BackendCatalogItem>[] = [
    { key: "code", header: "Code", render: (item) => <span className="font-mono text-xs">{item.code}</span> },
    { key: "name", header: "Service", render: (item) => <div><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.category}</p></div> },
    { key: "unit", header: "Unit", render: (item) => <span className="text-sm">{item.unit}</span> },
    { key: "unitPrice", header: "Rate", render: (item) => <span className="font-medium">{formatCurrency(item.unitPrice)}</span> },
    { key: "taxRate", header: "Tax", render: (item) => <span>{Number(item.taxRate)}%</span> },
    { key: "isActive", header: "Status", render: (item) => <StatusBadge status={item.isActive ? "active" : "inactive"} /> },
    ...(canManage
      ? [{
          key: "actions" as keyof BackendCatalogItem,
          header: "",
          render: (item: BackendCatalogItem) => (
            <Button size="sm" variant="ghost" onClick={(event) => { event.stopPropagation(); edit(item); }}>
              <Pencil className="h-4 w-4" />
            </Button>
          ),
        } satisfies Column<BackendCatalogItem>]
      : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Service Catalog"
        description="Reusable services, labor rates and tax defaults for estimates."
        actions={
          canManage ? (
            <Button variant="brand" onClick={() => edit()}>
              <Plus className="mr-1 h-4 w-4" /> Add service
            </Button>
          ) : undefined
        }
      />
      {catalogQuery.isLoading ? <div className="flex justify-center gap-2 py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading catalog…</div> : (
        <DataTable data={items} columns={columns} searchKeys={["code", "name", "category"]} searchPlaceholder="Search services…" emptyMessage="No catalog services yet." />
      )}
      <Dialog open={canManage && open} onOpenChange={(isOpen) => { if (!isOpen) resetValidation(); setOpen(isOpen); }}>
        <DialogContent ref={dialogRef} className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Wrench className="h-5 w-5" /> {editing ? "Edit service" : "Add service"}</DialogTitle></DialogHeader>
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
            className="grid gap-4 py-2"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2" data-field="code">
                <Label htmlFor="catalog-code" className={shouldShow("code") ? "text-destructive" : undefined}>
                  Code
                  <RequiredMark />
                </Label>
                <Input
                  id="catalog-code"
                  value={form.code}
                  onChange={(e) => {
                    const next = { ...form, code: e.target.value };
                    setForm(next);
                    handleChange("code", next);
                  }}
                  onBlur={() => handleBlur("code", form)}
                  className={fieldErrorClass(shouldShow("code"))}
                  {...fieldAria("code", shouldShow("code") ? errors.code : null)}
                />
                {shouldShow("code") && <FormFieldError field="code" message={errors.code} />}
              </div>
              <div className="grid gap-2" data-field="category">
                <Label htmlFor="catalog-category" className={shouldShow("category") ? "text-destructive" : undefined}>
                  Category
                  <RequiredMark />
                </Label>
                <Input
                  id="catalog-category"
                  value={form.category}
                  onChange={(e) => {
                    const next = { ...form, category: e.target.value };
                    setForm(next);
                    handleChange("category", next);
                  }}
                  onBlur={() => handleBlur("category", form)}
                  className={fieldErrorClass(shouldShow("category"))}
                  {...fieldAria("category", shouldShow("category") ? errors.category : null)}
                />
                {shouldShow("category") && <FormFieldError field="category" message={errors.category} />}
              </div>
            </div>
            <div className="grid gap-2" data-field="name">
              <Label htmlFor="catalog-name" className={shouldShow("name") ? "text-destructive" : undefined}>
                Name
                <RequiredMark />
              </Label>
              <Input
                id="catalog-name"
                value={form.name}
                onChange={(e) => {
                  const next = { ...form, name: e.target.value };
                  setForm(next);
                  handleChange("name", next);
                }}
                onBlur={() => handleBlur("name", form)}
                className={fieldErrorClass(shouldShow("name"))}
                {...fieldAria("name", shouldShow("name") ? errors.name : null)}
              />
              {shouldShow("name") && <FormFieldError field="name" message={errors.name} />}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="catalog-description">Description</Label>
              <Textarea
                id="catalog-description"
                value={form.description ?? ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2" data-field="unit">
                <Label htmlFor="catalog-unit" className={shouldShow("unit") ? "text-destructive" : undefined}>
                  Unit
                  <RequiredMark />
                </Label>
                <Input
                  id="catalog-unit"
                  value={form.unit}
                  onChange={(e) => {
                    const next = { ...form, unit: e.target.value };
                    setForm(next);
                    handleChange("unit", next);
                  }}
                  onBlur={() => handleBlur("unit", form)}
                  className={fieldErrorClass(shouldShow("unit"))}
                  {...fieldAria("unit", shouldShow("unit") ? errors.unit : null)}
                />
                {shouldShow("unit") && <FormFieldError field="unit" message={errors.unit} />}
              </div>
              <div className="grid gap-2" data-field="unitPrice">
                <Label htmlFor="catalog-rate">Rate</Label>
                <Input
                  id="catalog-rate"
                  type="number"
                  min={0}
                  value={form.unitPrice}
                  onChange={(e) => {
                    const next = { ...form, unitPrice: Number(e.target.value) };
                    setForm(next);
                    handleChange("unitPrice", next);
                  }}
                  onBlur={() => handleBlur("unitPrice", form)}
                  className={fieldErrorClass(shouldShow("unitPrice"))}
                  {...fieldAria("unitPrice", shouldShow("unitPrice") ? errors.unitPrice : null)}
                />
                {shouldShow("unitPrice") && <FormFieldError field="unitPrice" message={errors.unitPrice} />}
              </div>
              <div className="grid gap-2" data-field="taxRate">
                <Label htmlFor="catalog-tax">Tax %</Label>
                <Input
                  id="catalog-tax"
                  type="number"
                  min={0}
                  max={100}
                  value={form.taxRate}
                  onChange={(e) => {
                    const next = { ...form, taxRate: Number(e.target.value) };
                    setForm(next);
                    handleChange("taxRate", next);
                  }}
                  onBlur={() => handleBlur("taxRate", form)}
                  className={fieldErrorClass(shouldShow("taxRate"))}
                  {...fieldAria("taxRate", shouldShow("taxRate") ? errors.taxRate : null)}
                />
                {shouldShow("taxRate") && <FormFieldError field="taxRate" message={errors.taxRate} />}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="catalog-active">Active</Label>
              <Switch id="catalog-active" checked={form.isActive} onCheckedChange={(isActive) => setForm({ ...form, isActive })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
