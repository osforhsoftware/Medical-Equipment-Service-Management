import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Plus, PackageCheck, Loader2, AlertTriangle, Boxes, Lock } from "lucide-react";
import { FormFieldError } from "@/components/shared/FormFieldError";
import { RequiredMark } from "@/components/shared/RequiredMark";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { api, type BackendInventoryItem } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useFormValidation } from "@/hooks/useFormValidation";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useListingUrlState } from "@/hooks/useListingUrlState";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { fieldAria, fieldErrorClass, fieldRules } from "@/lib/formValidation";
import { formatCurrency, formatCurrencyShort } from "@/lib/format";
import { INVENTORY_CATEGORY_OPTIONS } from "@/lib/fixedOptions";
import { EMPTY_PAGINATION_META } from "@/lib/listing";
import { toast } from "@/lib/toast";

const UOM = ["pcs", "box", "meter", "set", "kit"];

const nonNegativeString = (label: string) =>
  z.string().refine((v) => {
    if (!v.trim()) return true;
    const n = Number(v);
    return !Number.isNaN(n) && n >= 0;
  }, `${label} cannot be negative.`);

const inventorySchema = z
  .object({
    sku: fieldRules.requiredString("SKU"),
    name: fieldRules.requiredString("Name"),
    category: z.string(),
    categoryOther: z.string().optional(),
    description: fieldRules.optionalString(),
    inStock: nonNegativeString("Quantity on hand"),
    reorderLevel: nonNegativeString("Reorder threshold"),
    unitCost: nonNegativeString("Cost price"),
    sellingPrice: nonNegativeString("Selling price"),
    deliveryCharge: nonNegativeString("Delivery charge"),
    deliveryChargeType: z.enum(["flat", "perUnit"]),
    unitOfMeasure: z.string(),
    supplier: fieldRules.optionalString(),
  })
  .superRefine((data, ctx) => {
    const resolvedCategory = data.category === "Other" ? data.categoryOther?.trim() : data.category;
    if (!resolvedCategory) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["category"],
        message: "Select or add a category.",
      });
    }
    if (data.category === "Other" && !data.categoryOther?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["categoryOther"],
        message: "Enter a category.",
      });
    }
  });

function buildCategoryOptions(items: BackendInventoryItem[], addedCategories: string[]) {
  const base = INVENTORY_CATEGORY_OPTIONS.filter((o) => o.value !== "Other");
  const other = INVENTORY_CATEGORY_OPTIONS.find((o) => o.value === "Other")!;
  const known = new Set(base.map((o) => o.value));
  const extras = [...new Set([...items.map((i) => i.category), ...addedCategories])]
    .filter((c) => c && !known.has(c) && c !== "Other")
    .sort()
    .map((c) => ({ value: c, label: c }));
  return [...base, ...extras, other];
}

const emptyForm = {
  sku: "",
  name: "",
  category: "Modules",
  categoryOther: "",
  description: "",
  inStock: "0",
  reorderLevel: "5",
  unitCost: "0",
  sellingPrice: "0",
  deliveryCharge: "0",
  deliveryChargeType: "flat" as "flat" | "perUnit",
  unitOfMeasure: "pcs",
  supplier: "",
};

export default function Inventory() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "inventory";
  const {
    search,
    setSearch,
    filters,
    setFilter,
    listParams,
    setPage,
    setLimit,
  } = useListingUrlState({ filterKeys: ["category"] });

  const debouncedSearch = useDebouncedValue(search);
  const queryParams = useMemo(
    () => ({ ...listParams, search: debouncedSearch || undefined }),
    [listParams, debouncedSearch],
  );

  const itemsQuery = usePaginatedQuery({
    queryKey: "inventory",
    params: queryParams,
    queryFn: (params) => api.listInventory(params),
  });

  const statsQuery = useQuery({
    queryKey: ["inventory", "stats"],
    queryFn: () => api.listInventory({ limit: 100, page: 1 }),
    staleTime: 60_000,
  });

  const items = itemsQuery.data?.data ?? [];
  const pagination = itemsQuery.data?.meta ?? EMPTY_PAGINATION_META;
  const statsItems = statsQuery.data?.data ?? items;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [addedCategories, setAddedCategories] = useState<string[]>([]);
  const dialogRef = useRef<HTMLDivElement>(null);

  const {
    errors,
    shouldShow,
    reset: resetValidation,
    validateAll,
    handleBlur,
    handleChange,
    applyApiErrors,
    clearError,
  } = useFormValidation({
    fieldOrder: ["sku", "category", "categoryOther", "name", "inStock", "reorderLevel", "unitCost", "sellingPrice", "deliveryCharge"],
    schema: inventorySchema,
  });

  const loadItems = () => {
    void queryClient.invalidateQueries({ queryKey: ["inventory"] });
  };

  const lowStock = statsItems.filter((i) => i.inStock <= i.reorderLevel).length;
  const reserved = statsItems.reduce((s, i) => s + i.reserved, 0);
  const totalValue = statsItems.reduce((s, i) => s + i.inStock * Number(i.unitCost), 0);

  const categorySelectOptions = useMemo(
    () => buildCategoryOptions(items, addedCategories),
    [items, addedCategories],
  );

  const categoryFilterOptions = useMemo(
    () => categorySelectOptions.filter((o) => o.value !== "Other").map((o) => ({ label: o.label, value: o.value })),
    [categorySelectOptions],
  );

  const openCreate = () => {
    setForm(emptyForm);
    setImageFiles([]);
    resetValidation();
    setDialogOpen(true);
  };

  const resolvedCategory = form.category === "Other" ? "" : form.category;

  const addCategory = () => {
    const name = form.categoryOther.trim();
    if (!name) return;

    const existing = categorySelectOptions.find((o) => o.value.toLowerCase() === name.toLowerCase());
    if (existing && existing.value !== "Other") {
      setForm({ ...form, category: existing.value, categoryOther: "" });
      toast({ title: "Category selected", description: `"${existing.label}" is already in the list.` });
      return;
    }

    setAddedCategories((current) => [...new Set([...current, name])]);
    setForm({ ...form, category: name, categoryOther: "" });
    toast({ title: "Category added", description: `"${name}" is now available in the dropdown.` });
  };

  const saveItem = async () => {
    if (!validateAll(form, undefined, dialogRef.current)) return;

    setSaving(true);
    try {
      const imageFileIds: string[] = [];
      for (const file of imageFiles) {
        const uploaded = await api.uploadFile(file);
        imageFileIds.push(uploaded.id);
      }
      await api.createInventoryItem({
        sku: form.sku.trim(),
        name: form.name.trim(),
        category: resolvedCategory,
        description: form.description.trim() || null,
        inStock: Number(form.inStock) || 0,
        reorderLevel: Number(form.reorderLevel) || 0,
        unitCost: Number(form.unitCost) || 0,
        sellingPrice: Number(form.sellingPrice) || 0,
        deliveryCharge: Number(form.deliveryCharge) || 0,
        deliveryChargeType: form.deliveryChargeType,
        unitOfMeasure: form.unitOfMeasure,
        supplier: form.supplier.trim(),
        imageFileIds,
      });
      toast({ title: "Inventory item added", description: form.name.trim() });
      setDialogOpen(false);
      resetValidation();
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
    } catch (err) {
      if (!applyApiErrors(err, dialogRef.current)) {
        toast.apiError(err, { fallback: "Unable to save item" });
      }
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<BackendInventoryItem>[] = [
    {
      key: "name",
      header: "Inventory Item",
      render: (i) => (
        <div>
          <p className="font-medium">{i.name}</p>
          <p className="font-mono text-xs text-muted-foreground">
            {i.sku} · {i.category} · {i.unitOfMeasure ?? "pcs"}
          </p>
        </div>
      ),
    },
    {
      key: "inStock",
      header: "Available",
      render: (i) => {
        const available = i.inStock - i.reserved;
        return (
          <div className="w-32">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{available}</span>
              <span className="text-xs text-muted-foreground">/ {i.inStock}</span>
            </div>
            <Progress value={(available / Math.max(i.inStock, 1)) * 100} className="mt-1 h-1.5" />
          </div>
        );
      },
    },
    {
      key: "reserved",
      header: "Reserved",
      render: (i) => (
        <Badge variant="secondary" className="gap-1">
          <Lock className="h-3 w-3" /> {i.reserved}
        </Badge>
      ),
    },
    {
      key: "stockState",
      header: "Stock",
      render: (i) =>
        i.inStock <= i.reorderLevel ? (
          <Badge className="gap-1 bg-warning/15 text-warning-foreground hover:bg-warning/15">
            <AlertTriangle className="h-3 w-3" /> Low
          </Badge>
        ) : (
          <Badge className="gap-1 bg-success/12 text-success hover:bg-success/12">
            <PackageCheck className="h-3 w-3" /> OK
          </Badge>
        ),
    },
    { key: "sellingPrice", header: "Sell", render: (i) => <span className="text-sm">{formatCurrency(i.sellingPrice ?? 0)}</span> },
    { key: "unitCost", header: "Cost", render: (i) => <span className="text-sm">{formatCurrency(i.unitCost)}</span> },
    { key: "supplier", header: "Supplier", render: (i) => <span className="text-sm text-muted-foreground">{i.supplier}</span> },
  ];

  return (
    <RoleGuard roles={["admin", "inventory", "engineer", "inspector"]}>
      <div className="space-y-6">
        <PageHeader
          title="Inventory Items"
          description="Spare parts with cost, selling price, delivery charges, and system-managed reservations."
          actions={
            canManage ? (
              <Button onClick={openCreate} variant="brand">
                <Plus className="mr-1 h-4 w-4" /> Add Item
              </Button>
            ) : undefined
          }
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Total SKUs" value={String(pagination.total)} icon={Boxes} accent="primary" />
          <StatCard label="Reserved Units" value={String(reserved)} icon={Lock} accent="accent" />
          <StatCard label="Stock Value" value={formatCurrencyShort(totalValue)} icon={PackageCheck} accent="success" />
        </div>
        {lowStock > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning-foreground">
            <AlertTriangle className="h-4 w-4" /> {lowStock} item(s) at or below reorder level — raise a Stock Purchase Request.
          </div>
        )}

        <DataTable
          mode="server"
          data={items}
          columns={columns}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search inventory items…"
          emptyMessage="No inventory items yet."
          emptyHint="Try changing your search or filters."
          filterValues={filters}
          onFilterChange={setFilter}
          filters={[{ key: "category", label: "Category", options: categoryFilterOptions }]}
          pagination={pagination}
          onPageChange={setPage}
          onLimitChange={setLimit}
          loading={itemsQuery.isLoading}
          isFetching={itemsQuery.isFetching}
          error={itemsQuery.error as Error | null}
          onRetry={() => loadItems()}
          onRowClick={(item) => navigate(`/app/inventory/${item.id}`)}
        />

        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetValidation(); setDialogOpen(open); }}>
          <DialogContent ref={dialogRef} className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Inventory Item</DialogTitle>
            </DialogHeader>
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void saveItem();
              }}
              className="grid gap-4 py-2"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2" data-field="sku">
                  <Label htmlFor="inventory-sku" className={shouldShow("sku") ? "text-destructive" : undefined}>
                    SKU / Part Number
                    <RequiredMark />
                  </Label>
                  <Input
                    id="inventory-sku"
                    value={form.sku}
                    onChange={(e) => {
                      const next = { ...form, sku: e.target.value };
                      setForm(next);
                      handleChange("sku", next);
                    }}
                    onBlur={() => handleBlur("sku", form)}
                    className={fieldErrorClass(shouldShow("sku"), "font-mono")}
                    {...fieldAria("sku", shouldShow("sku") ? errors.sku : null)}
                  />
                  {shouldShow("sku") && <FormFieldError field="sku" message={errors.sku} />}
                </div>
                <div className="grid gap-2" data-field="category">
                  <Label className={shouldShow("category") ? "text-destructive" : undefined}>
                    Category
                    <RequiredMark />
                  </Label>
                  <Select
                    value={form.category}
                    onValueChange={(v) => {
                      const next = { ...form, category: v, categoryOther: v === "Other" ? form.categoryOther : "" };
                      setForm(next);
                      clearError("category");
                      if (v !== "Other") clearError("categoryOther");
                      handleChange("category", next);
                    }}
                  >
                    <SelectTrigger
                      id="category"
                      className={fieldErrorClass(shouldShow("category"))}
                      {...fieldAria("category", shouldShow("category") ? errors.category : null)}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categorySelectOptions.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {shouldShow("category") && <FormFieldError field="category" message={errors.category} />}
                </div>
              </div>
              {form.category === "Other" && (
                <div className="grid gap-2 rounded-lg border border-dashed border-border p-3" data-field="categoryOther">
                  <Label htmlFor="inventory-category-other" className={shouldShow("categoryOther") ? "text-destructive" : undefined}>
                    Add new category
                    <RequiredMark />
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="inventory-category-other"
                      value={form.categoryOther}
                      onChange={(e) => {
                        const next = { ...form, categoryOther: e.target.value };
                        setForm(next);
                        handleChange("categoryOther", next);
                      }}
                      onBlur={() => handleBlur("categoryOther", form)}
                      className={fieldErrorClass(shouldShow("categoryOther"))}
                      {...fieldAria("categoryOther", shouldShow("categoryOther") ? errors.categoryOther : null)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addCategory();
                        }
                      }}
                      placeholder="e.g. Cables, Adapters"
                    />
                    <Button type="button" variant="outline" disabled={!form.categoryOther.trim()} onClick={addCategory}>
                      Add
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Added categories appear in the dropdown above for this and future items.
                  </p>
                  {shouldShow("categoryOther") && <FormFieldError field="categoryOther" message={errors.categoryOther} />}
                </div>
              )}
              <div className="grid gap-2" data-field="name">
                <Label htmlFor="inventory-name" className={shouldShow("name") ? "text-destructive" : undefined}>
                  Name
                  <RequiredMark />
                </Label>
                <Input
                  id="inventory-name"
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
                <Label htmlFor="inventory-description">Description</Label>
                <Textarea id="inventory-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
              </div>
              <div className="grid gap-2">
                <Label>Unit of measure</Label>
                <Select value={form.unitOfMeasure} onValueChange={(v) => setForm({ ...form, unitOfMeasure: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UOM.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2" data-field="inStock">
                  <Label htmlFor="inventory-in-stock">Qty on hand</Label>
                  <Input
                    id="inventory-in-stock"
                    type="number"
                    min={0}
                    value={form.inStock}
                    onChange={(e) => {
                      const next = { ...form, inStock: e.target.value };
                      setForm(next);
                      handleChange("inStock", next);
                    }}
                    onBlur={() => handleBlur("inStock", form)}
                    className={fieldErrorClass(shouldShow("inStock"))}
                    {...fieldAria("inStock", shouldShow("inStock") ? errors.inStock : null)}
                  />
                  {shouldShow("inStock") && <FormFieldError field="inStock" message={errors.inStock} />}
                </div>
                <div className="grid gap-2" data-field="reorderLevel">
                  <Label htmlFor="inventory-reorder">Reorder threshold</Label>
                  <Input
                    id="inventory-reorder"
                    type="number"
                    min={0}
                    value={form.reorderLevel}
                    onChange={(e) => {
                      const next = { ...form, reorderLevel: e.target.value };
                      setForm(next);
                      handleChange("reorderLevel", next);
                    }}
                    onBlur={() => handleBlur("reorderLevel", form)}
                    className={fieldErrorClass(shouldShow("reorderLevel"))}
                    {...fieldAria("reorderLevel", shouldShow("reorderLevel") ? errors.reorderLevel : null)}
                  />
                  {shouldShow("reorderLevel") && <FormFieldError field="reorderLevel" message={errors.reorderLevel} />}
                </div>
                <div className="grid gap-2" data-field="unitCost">
                  <Label htmlFor="inventory-cost">Cost price</Label>
                  <Input
                    id="inventory-cost"
                    type="number"
                    min={0}
                    value={form.unitCost}
                    onChange={(e) => {
                      const next = { ...form, unitCost: e.target.value };
                      setForm(next);
                      handleChange("unitCost", next);
                    }}
                    onBlur={() => handleBlur("unitCost", form)}
                    className={fieldErrorClass(shouldShow("unitCost"))}
                    {...fieldAria("unitCost", shouldShow("unitCost") ? errors.unitCost : null)}
                  />
                  {shouldShow("unitCost") && <FormFieldError field="unitCost" message={errors.unitCost} />}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2" data-field="sellingPrice">
                  <Label htmlFor="inventory-selling">Selling price</Label>
                  <Input
                    id="inventory-selling"
                    type="number"
                    min={0}
                    value={form.sellingPrice}
                    onChange={(e) => {
                      const next = { ...form, sellingPrice: e.target.value };
                      setForm(next);
                      handleChange("sellingPrice", next);
                    }}
                    onBlur={() => handleBlur("sellingPrice", form)}
                    className={fieldErrorClass(shouldShow("sellingPrice"))}
                    {...fieldAria("sellingPrice", shouldShow("sellingPrice") ? errors.sellingPrice : null)}
                  />
                  {shouldShow("sellingPrice") && <FormFieldError field="sellingPrice" message={errors.sellingPrice} />}
                </div>
                <div className="grid gap-2" data-field="deliveryCharge">
                  <Label htmlFor="inventory-delivery">Delivery charge</Label>
                  <Input
                    id="inventory-delivery"
                    type="number"
                    min={0}
                    value={form.deliveryCharge}
                    onChange={(e) => {
                      const next = { ...form, deliveryCharge: e.target.value };
                      setForm(next);
                      handleChange("deliveryCharge", next);
                    }}
                    onBlur={() => handleBlur("deliveryCharge", form)}
                    className={fieldErrorClass(shouldShow("deliveryCharge"))}
                    {...fieldAria("deliveryCharge", shouldShow("deliveryCharge") ? errors.deliveryCharge : null)}
                  />
                  {shouldShow("deliveryCharge") && <FormFieldError field="deliveryCharge" message={errors.deliveryCharge} />}
                </div>
                <div className="grid gap-2">
                  <Label>Delivery type</Label>
                  <Select
                    value={form.deliveryChargeType}
                    onValueChange={(v) => setForm({ ...form, deliveryChargeType: v as "flat" | "perUnit" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flat">Flat</SelectItem>
                      <SelectItem value="perUnit">Per unit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="inventory-supplier">Supplier</Label>
                <Input id="inventory-supplier" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="inventory-images">Product images</Label>
                <Input id="inventory-images" type="file" accept="image/*" multiple onChange={(e) => setImageFiles(Array.from(e.target.files ?? []))} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save item
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </RoleGuard>
  );
}
