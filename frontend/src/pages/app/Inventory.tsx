import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import { api, type BackendInventoryItem, type BackendTaxonomyTerm } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { useFormValidation } from "@/hooks/useFormValidation";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useListingUrlState } from "@/hooks/useListingUrlState";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { fieldAria, fieldErrorClass, fieldRules } from "@/lib/formValidation";
import { formatCurrency, formatCurrencyShort } from "@/lib/format";
import { EMPTY_PAGINATION_META } from "@/lib/listing";
import { navItems } from "@/config/nav";
import { activeTerms, termLabel } from "@/lib/taxonomy";
import { userCanAccessModule } from "@/lib/userRoles";
import { toast } from "@/lib/toast";

const UOM = ["pcs", "box", "meter", "set", "kit"];
const ADD_OPTION = "__add__";

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
    subcategory: z.string(),
    categoryOther: z.string().optional(),
    subcategoryOther: z.string().optional(),
    description: fieldRules.optionalString(),
    inStock: nonNegativeString("Quantity on hand"),
    reorderLevel: nonNegativeString("Reorder threshold"),
    unitCost: nonNegativeString("Cost price"),
    sellingPrice: nonNegativeString("Selling price"),
    deliveryCharge: nonNegativeString("Delivery charge"),
    deliveryChargeType: z.enum(["flat", "perUnit"]),
    unitOfMeasure: z.string(),
    supplierId: z.string(),
    supplierOther: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.category || data.category === ADD_OPTION) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: data.category === ADD_OPTION && data.categoryOther?.trim() ? ["categoryOther"] : ["category"],
        message: data.category === ADD_OPTION ? "Click Add to save the new category." : "Select or add a category.",
      });
    }
    if (data.category === ADD_OPTION && !data.categoryOther?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["categoryOther"],
        message: "Enter a category.",
      });
    }
    if (!data.subcategory || data.subcategory === ADD_OPTION) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: data.subcategory === ADD_OPTION && data.subcategoryOther?.trim() ? ["subcategoryOther"] : ["subcategory"],
        message: data.subcategory === ADD_OPTION ? "Click Add to save the new subcategory." : "Select or add a subcategory.",
      });
    }
    if (data.subcategory === ADD_OPTION && !data.subcategoryOther?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["subcategoryOther"],
        message: "Enter a subcategory.",
      });
    }
    if (data.supplierId === ADD_OPTION) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["supplierOther"],
        message: data.supplierOther?.trim() ? "Click Add to save the new supplier." : "Enter a supplier name.",
      });
    }
  });

const emptyForm = {
  sku: "",
  name: "",
  category: "",
  subcategory: "",
  categoryOther: "",
  subcategoryOther: "",
  description: "",
  inStock: "0",
  reorderLevel: "5",
  unitCost: "0",
  sellingPrice: "0",
  deliveryCharge: "0",
  deliveryChargeType: "flat" as "flat" | "perUnit",
  unitOfMeasure: "pcs",
  supplierId: "",
  supplierOther: "",
};

function InlineAddTerm({
  id,
  label,
  value,
  placeholder,
  error,
  showError,
  disabled,
  adding,
  onChange,
  onAdd,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  error?: string;
  showError?: boolean;
  disabled?: boolean;
  adding?: boolean;
  onChange: (value: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="grid gap-2 rounded-lg border border-dashed border-border p-3" data-field={id}>
      <Label htmlFor={id} className={showError ? "text-destructive" : undefined}>
        {label}
        <RequiredMark />
      </Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={fieldErrorClass(Boolean(showError))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd();
            }
          }}
        />
        <Button type="button" variant="outline" disabled={disabled || adding || !value.trim()} onClick={onAdd}>
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Added terms appear in the dropdown and in Master Data.
      </p>
      {showError && error ? <FormFieldError field={id} message={error} /> : null}
    </div>
  );
}

export default function Inventory() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { rbacMatrix } = useSettings();
  const canManage = user?.role === "admin" || user?.role === "inventory";
  const canManageMasterData = Boolean(
    user &&
      userCanAccessModule(
        user,
        "Master Data",
        rbacMatrix,
        navItems.find((item) => item.label === "Master Data")?.roles,
      ),
  );
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

  const categoriesQuery = useQuery({
    queryKey: ["taxonomy", "inventory_category"],
    queryFn: () => api.listTaxonomy({ type: "inventory_category" }),
  });
  const subcategoriesQuery = useQuery({
    queryKey: ["taxonomy", "inventory_subcategory"],
    queryFn: () => api.listTaxonomy({ type: "inventory_subcategory" }),
  });
  const suppliersQuery = useQuery({
    queryKey: ["suppliers", "options"],
    queryFn: () => api.listSuppliers({ limit: 100, page: 1 }).then((r) => r.data),
    enabled: canManage,
  });

  const items = itemsQuery.data?.data ?? [];
  const pagination = itemsQuery.data?.meta ?? EMPTY_PAGINATION_META;
  const statsItems = statsQuery.data?.data ?? items;
  const categories = activeTerms(categoriesQuery.data);
  const subcategories = activeTerms(subcategoriesQuery.data);
  const suppliers = suppliersQuery.data ?? [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingTerm, setAddingTerm] = useState<"category" | "subcategory" | "supplier" | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
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
    fieldOrder: [
      "sku",
      "category",
      "categoryOther",
      "subcategory",
      "subcategoryOther",
      "name",
      "inStock",
      "reorderLevel",
      "unitCost",
      "sellingPrice",
      "deliveryCharge",
      "supplierOther",
    ],
    schema: inventorySchema,
  });

  const loadItems = () => {
    void queryClient.invalidateQueries({ queryKey: ["inventory"] });
  };

  const lowStock = statsItems.filter((i) => i.inStock <= i.reorderLevel).length;
  const reserved = statsItems.reduce((s, i) => s + i.reserved, 0);
  const totalValue = statsItems.reduce((s, i) => s + i.inStock * Number(i.unitCost), 0);

  const selectedCategory = categories.find((term) => term.slug === form.category);
  const subcategoryOptions = subcategories.filter(
    (term) => !term.parentId || term.parentId === selectedCategory?.id,
  );

  const categoryFilterOptions = useMemo(
    () => categories.map((term) => ({ label: term.name, value: term.slug })),
    [categories],
  );

  const openCreate = () => {
    setForm(emptyForm);
    setImageFiles([]);
    resetValidation();
    setDialogOpen(true);
  };

  const findExistingTerm = (terms: BackendTaxonomyTerm[], name: string) =>
    terms.find((term) => term.name.toLowerCase() === name.toLowerCase() || term.slug.toLowerCase() === name.toLowerCase());

  const addCategory = async () => {
    const name = form.categoryOther.trim();
    if (!name) return;
    const existing = findExistingTerm(categoriesQuery.data ?? [], name);
    if (existing) {
      const next = { ...form, category: existing.slug, categoryOther: "", subcategory: "" };
      setForm(next);
      clearError("category");
      clearError("categoryOther");
      toast({ title: "Category selected", description: `"${existing.name}" is already in the list.` });
      return;
    }
    setAddingTerm("category");
    try {
      const created = await api.createTaxonomy({ type: "inventory_category", name });
      await queryClient.invalidateQueries({ queryKey: ["taxonomy", "inventory_category"] });
      const next = { ...form, category: created.slug, categoryOther: "", subcategory: "" };
      setForm(next);
      clearError("category");
      clearError("categoryOther");
      toast({ title: "Category added", description: `"${created.name}" is now available in the dropdown.` });
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to add category" });
    } finally {
      setAddingTerm(null);
    }
  };

  const addSubcategory = async () => {
    const name = form.subcategoryOther.trim();
    if (!name || !selectedCategory) return;
    const existing = findExistingTerm(subcategoryOptions, name);
    if (existing) {
      const next = { ...form, subcategory: existing.slug, subcategoryOther: "" };
      setForm(next);
      clearError("subcategory");
      clearError("subcategoryOther");
      toast({ title: "Subcategory selected", description: `"${existing.name}" is already in the list.` });
      return;
    }
    setAddingTerm("subcategory");
    try {
      const created = await api.createTaxonomy({
        type: "inventory_subcategory",
        name,
        parentId: selectedCategory.id,
      });
      await queryClient.invalidateQueries({ queryKey: ["taxonomy", "inventory_subcategory"] });
      const next = { ...form, subcategory: created.slug, subcategoryOther: "" };
      setForm(next);
      clearError("subcategory");
      clearError("subcategoryOther");
      toast({ title: "Subcategory added", description: `"${created.name}" is now available in the dropdown.` });
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to add subcategory" });
    } finally {
      setAddingTerm(null);
    }
  };

  const addSupplier = async () => {
    const name = form.supplierOther.trim();
    if (!name) return;
    const existing = suppliers.find((row) => row.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      const next = { ...form, supplierId: existing.id, supplierOther: "" };
      setForm(next);
      toast({ title: "Supplier selected", description: `"${existing.name}" is already in the list.` });
      return;
    }
    setAddingTerm("supplier");
    try {
      const created = await api.createSupplier({
        name,
        contact: "",
        email: "",
        phone: "",
        category: selectedCategory?.name ?? "",
      });
      await queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      const next = { ...form, supplierId: created.id, supplierOther: "" };
      setForm(next);
      clearError("supplierOther");
      toast({ title: "Supplier added", description: `"${created.name}" is now available in the dropdown.` });
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to add supplier" });
    } finally {
      setAddingTerm(null);
    }
  };

  const saveItem = async () => {
    if (!validateAll(form, undefined, dialogRef.current)) return;
    const supplier = suppliers.find((row) => row.id === form.supplierId);

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
        category: form.category,
        subcategory: form.subcategory,
        description: form.description.trim() || null,
        inStock: Number(form.inStock) || 0,
        reorderLevel: Number(form.reorderLevel) || 0,
        unitCost: Number(form.unitCost) || 0,
        sellingPrice: Number(form.sellingPrice) || 0,
        deliveryCharge: Number(form.deliveryCharge) || 0,
        deliveryChargeType: form.deliveryChargeType,
        unitOfMeasure: form.unitOfMeasure,
        supplier: supplier?.name ?? "",
        supplierId: form.supplierId || null,
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
            {i.sku} · {termLabel(categoriesQuery.data, i.category)}
            {i.subcategory ? ` · ${termLabel(subcategoriesQuery.data, i.subcategory)}` : ""} · {i.unitOfMeasure ?? "pcs"}
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
              <div className="grid gap-2">
                <Label htmlFor="inventory-images">Product images</Label>
                <Input
                  id="inventory-images"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setImageFiles(Array.from(e.target.files ?? []))}
                />
                {imageFiles.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {imageFiles.length} file{imageFiles.length === 1 ? "" : "s"} selected
                  </p>
                ) : null}
              </div>
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
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2" data-field="category">
                  <div className="flex items-center justify-between gap-2">
                    <Label className={shouldShow("category") ? "text-destructive" : undefined}>
                      Category
                      <RequiredMark />
                    </Label>
                    {canManageMasterData ? (
                      <Link to="/app/master-data?type=inventory_category" className="text-xs text-primary hover:underline">
                        Manage
                      </Link>
                    ) : null}
                  </div>
                  <Select
                    value={form.category || undefined}
                    onValueChange={(v) => {
                      const next = {
                        ...form,
                        category: v,
                        subcategory: v === ADD_OPTION ? "" : "",
                        categoryOther: v === ADD_OPTION ? form.categoryOther : "",
                      };
                      setForm(next);
                      clearError("category");
                      if (v !== ADD_OPTION) clearError("categoryOther");
                      handleChange("category", next);
                    }}
                  >
                    <SelectTrigger
                      id="category"
                      className={fieldErrorClass(shouldShow("category"))}
                      {...fieldAria("category", shouldShow("category") ? errors.category : null)}
                    >
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.slug}>
                          {c.name}
                        </SelectItem>
                      ))}
                      <SelectItem value={ADD_OPTION}>+ Add new category</SelectItem>
                    </SelectContent>
                  </Select>
                  {shouldShow("category") && <FormFieldError field="category" message={errors.category} />}
                </div>
                <div className="grid gap-2" data-field="subcategory">
                  <div className="flex items-center justify-between gap-2">
                    <Label className={shouldShow("subcategory") ? "text-destructive" : undefined}>
                      Subcategory
                      <RequiredMark />
                    </Label>
                    {canManageMasterData ? (
                      <Link to="/app/master-data?type=inventory_subcategory" className="text-xs text-primary hover:underline">
                        Manage
                      </Link>
                    ) : null}
                  </div>
                  <Select
                    value={form.subcategory || undefined}
                    disabled={!selectedCategory}
                    onValueChange={(v) => {
                      const next = {
                        ...form,
                        subcategory: v,
                        subcategoryOther: v === ADD_OPTION ? form.subcategoryOther : "",
                      };
                      setForm(next);
                      clearError("subcategory");
                      if (v !== ADD_OPTION) clearError("subcategoryOther");
                      handleChange("subcategory", next);
                    }}
                  >
                    <SelectTrigger
                      id="subcategory"
                      className={fieldErrorClass(shouldShow("subcategory"))}
                      {...fieldAria("subcategory", shouldShow("subcategory") ? errors.subcategory : null)}
                    >
                      <SelectValue placeholder={selectedCategory ? "Select subcategory" : "Select a category first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {subcategoryOptions.map((c) => (
                        <SelectItem key={c.id} value={c.slug}>
                          {c.name}
                        </SelectItem>
                      ))}
                      <SelectItem value={ADD_OPTION}>+ Add new subcategory</SelectItem>
                    </SelectContent>
                  </Select>
                  {shouldShow("subcategory") && <FormFieldError field="subcategory" message={errors.subcategory} />}
                </div>
              </div>
              {form.category === ADD_OPTION && (
                <InlineAddTerm
                  id="categoryOther"
                  label="Add new category"
                  value={form.categoryOther}
                  placeholder="e.g. Cables, Adapters"
                  error={errors.categoryOther}
                  showError={shouldShow("categoryOther")}
                  adding={addingTerm === "category"}
                  onChange={(value) => {
                    const next = { ...form, categoryOther: value };
                    setForm(next);
                    handleChange("categoryOther", next);
                  }}
                  onAdd={() => void addCategory()}
                />
              )}
              {form.subcategory === ADD_OPTION && (
                <InlineAddTerm
                  id="subcategoryOther"
                  label="Add new subcategory"
                  value={form.subcategoryOther}
                  placeholder="e.g. Probes, Filters"
                  error={errors.subcategoryOther}
                  showError={shouldShow("subcategoryOther")}
                  disabled={!selectedCategory}
                  adding={addingTerm === "subcategory"}
                  onChange={(value) => {
                    const next = { ...form, subcategoryOther: value };
                    setForm(next);
                    handleChange("subcategoryOther", next);
                  }}
                  onAdd={() => void addSubcategory()}
                />
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
                <div className="flex items-center justify-between gap-2">
                  <Label>Supplier</Label>
                  {canManage ? (
                    <Link to="/app/suppliers" className="text-xs text-primary hover:underline">
                      Manage
                    </Link>
                  ) : null}
                </div>
                <Select
                  value={form.supplierId || undefined}
                  onValueChange={(v) => {
                    const next = { ...form, supplierId: v, supplierOther: v === ADD_OPTION ? form.supplierOther : "" };
                    setForm(next);
                    if (v !== ADD_OPTION) clearError("supplierOther");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                    <SelectItem value={ADD_OPTION}>+ Add new supplier</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.supplierId === ADD_OPTION && (
                <InlineAddTerm
                  id="supplierOther"
                  label="Add new supplier"
                  value={form.supplierOther}
                  placeholder="e.g. MedParts Global"
                  error={errors.supplierOther}
                  showError={shouldShow("supplierOther")}
                  adding={addingTerm === "supplier"}
                  onChange={(value) => {
                    const next = { ...form, supplierOther: value };
                    setForm(next);
                    handleChange("supplierOther", next);
                  }}
                  onAdd={() => void addSupplier()}
                />
              )}
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
