import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Plus, PackageCheck, Loader2, AlertTriangle, Boxes, Lock, Eye, Package, X, ChevronLeft, ChevronRight, ExternalLink, MapPin, PackageMinus, RefreshCw, IndianRupee, Pencil, Trash2, RotateCcw } from "lucide-react";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import { FormFieldError } from "@/components/shared/FormFieldError";
import { RequiredMark } from "@/components/shared/RequiredMark";
import { PageHeader } from "@/components/shared/PageHeader";
import { InventoryStageNav, inventoryStageFromLocation } from "@/components/inventory/InventoryStageNav";
import { ModuleQuickAction } from "@/components/shared/ModuleFlowStrip";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { INVENTORY_WRITE_ROLES } from "@/config/roles";
import { activeTerms, termLabel } from "@/lib/taxonomy";
import { parseCustomerAdditionalFields, sanitizeCustomerAdditionalFields } from "@/lib/customerFields";
import {
  formatInventoryItemClass,
  INVENTORY_ITEM_CLASS_OPTIONS,
  INVENTORY_ITEM_CLASSES,
  inferItemClassFromCategory,
  type InventoryItemClass,
} from "@/lib/inventoryItemClass";
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
    sku: z.string().trim().max(64, "SKU must be 64 characters or fewer."),
    name: fieldRules.requiredString("Name"),
    itemClass: z.enum(INVENTORY_ITEM_CLASSES),
    category: z.string(),
    categoryOther: z.string().optional(),
    description: fieldRules.optionalString(),
    manufacturer: fieldRules.optionalString(),
    compatibleModels: fieldRules.optionalString(),
    inStock: nonNegativeString("Quantity on hand"),
    reorderLevel: nonNegativeString("Min level"),
    maxLevel: nonNegativeString("Max level"),
    binLocation: fieldRules.optionalString(),
    unitCost: nonNegativeString("Cost price"),
    sellingPrice: nonNegativeString("Selling price"),
    deliveryCharge: nonNegativeString("Delivery charge"),
    deliveryChargeType: z.enum(["flat", "perUnit"]),
    unitOfMeasure: z.string(),
    supplierId: z.string(),
    supplierOther: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.itemClass) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["itemClass"],
        message: "Select Spare Parts, Consumables, or Equipment.",
      });
    }
    if (data.category === ADD_OPTION) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: data.categoryOther?.trim() ? ["categoryOther"] : ["category"],
        message: data.categoryOther?.trim() ? "Click Add to save the new category." : "Enter a category, or choose an existing one.",
      });
    }
    if (data.category === ADD_OPTION && !data.categoryOther?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["categoryOther"],
        message: "Enter a category.",
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
  itemClass: "spare_part" as InventoryItemClass,
  category: "",
  categoryOther: "",
  description: "",
  manufacturer: "",
  compatibleModels: "",
  inStock: "0",
  reorderLevel: "5",
  maxLevel: "0",
  binLocation: "",
  trackBatches: false,
  trackSerials: false,
  batchNumbers: "",
  serialNumbers: "",
  unitCost: "0",
  sellingPrice: "0",
  deliveryCharge: "0",
  deliveryChargeType: "flat" as "flat" | "perUnit",
  unitOfMeasure: "pcs",
  supplierId: "",
  supplierOther: "",
};

function buildTrackingAdditionalFields(
  form: typeof emptyForm,
  existingAdditionalFields?: BackendInventoryItem["additionalFields"],
) {
  const preserved = parseCustomerAdditionalFields(existingAdditionalFields).filter(
    (f) => f.label !== "Batch numbers" && f.label !== "Serial numbers",
  );
  const fields: { label: string; value: string }[] = [...preserved];
  if (form.trackBatches && form.batchNumbers.trim()) {
    fields.push({ label: "Batch numbers", value: form.batchNumbers.trim() });
  }
  if (form.trackSerials && form.serialNumbers.trim()) {
    fields.push({ label: "Serial numbers", value: form.serialNumbers.trim() });
  }
  return fields.length ? sanitizeCustomerAdditionalFields(fields) : undefined;
}

function formFromItem(item: BackendInventoryItem): typeof emptyForm {
  const extras = parseCustomerAdditionalFields(item.additionalFields);
  const batch = extras.find((f) => f.label === "Batch numbers")?.value ?? "";
  const serials = extras.find((f) => f.label === "Serial numbers")?.value ?? "";
  return {
    sku: item.sku ?? "",
    name: item.name ?? "",
    itemClass: (item.itemClass as InventoryItemClass) || inferItemClassFromCategory(item.category),
    category: item.category ?? "",
    categoryOther: "",
    description: item.description ?? "",
    manufacturer: item.manufacturer ?? "",
    compatibleModels: item.compatibleModels ?? "",
    inStock: String(item.inStock ?? 0),
    reorderLevel: String(item.reorderLevel ?? 0),
    maxLevel: String(item.maxLevel ?? 0),
    binLocation: item.binLocation ?? "",
    trackBatches: Boolean(item.trackBatches),
    trackSerials: Boolean(item.trackSerials),
    batchNumbers: batch,
    serialNumbers: serials,
    unitCost: String(item.unitCost ?? 0),
    sellingPrice: String(item.sellingPrice ?? 0),
    deliveryCharge: String(item.deliveryCharge ?? 0),
    deliveryChargeType: (item.deliveryChargeType === "perUnit" ? "perUnit" : "flat") as "flat" | "perUnit",
    unitOfMeasure: item.unitOfMeasure ?? "pcs",
    supplierId: item.supplierId ?? "",
    supplierOther: "",
  };
}

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
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const stage = inventoryStageFromLocation("/app/inventory", searchParams.get("stage"));
  const { user, hasRole } = useAuth();
  const { rbacMatrix } = useSettings();
  const canManage = hasRole(INVENTORY_WRITE_ROLES);
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
  } = useListingUrlState({ filterKeys: ["category", "itemClass", "status"] });

  const debouncedSearch = useDebouncedValue(search);
  const queryParams = useMemo(
    () => ({
      ...listParams,
      search: debouncedSearch || undefined,
      status: filters.status || "active",
    }),
    [listParams, debouncedSearch, filters.status],
  );

  const itemsQuery = usePaginatedQuery({
    queryKey: "inventory",
    params: queryParams,
    queryFn: (params) => api.listInventory(params),
  });

  const statsQuery = useQuery({
    queryKey: ["inventory", "stats"],
    queryFn: () => api.listInventory({ limit: 100, page: 1, status: "active" }),
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
  const suppliers = suppliersQuery.data ?? [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BackendInventoryItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [addingTerm, setAddingTerm] = useState<"category" | "supplier" | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [existingImageFileIds, setExistingImageFileIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<BackendInventoryItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<{
    title: string;
    images: string[];
    index: number;
  } | null>(null);
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
      "itemClass",
      "category",
      "categoryOther",
      "name",
      "manufacturer",
      "compatibleModels",
      "inStock",
      "reorderLevel",
      "maxLevel",
      "binLocation",
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
  const issued = statsItems.reduce((s, i) => s + (i.issued ?? 0), 0);
  const damaged = statsItems.reduce((s, i) => s + (i.damaged ?? 0), 0);
  const totalValue = statsItems.reduce((s, i) => s + i.inStock * Number(i.unitCost), 0);
  const sparePartsValue = statsItems.filter((i) => i.itemClass === "spare_part").reduce((s, i) => s + i.inStock * Number(i.unitCost), 0);
  const consumablesValue = statsItems.filter((i) => i.itemClass === "consumable").reduce((s, i) => s + i.inStock * Number(i.unitCost), 0);

  const selectedCategory = categories.find((term) => term.slug === form.category);

  const categoryFilterOptions = useMemo(
    () => categories.map((term) => ({ label: term.name, value: term.slug })),
    [categories],
  );

  const openCreate = () => {
    setEditingItem(null);
    setForm(emptyForm);
    setImageFiles([]);
    setExistingImageFileIds([]);
    resetValidation();
    setDialogOpen(true);
  };

  const openEdit = (item: BackendInventoryItem) => {
    setEditingItem(item);
    setForm(formFromItem(item));
    setImageFiles([]);
    setExistingImageFileIds((item.images ?? []).map((img) => img.fileId));
    resetValidation();
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (saving) return;
    setDialogOpen(false);
    setEditingItem(null);
    resetValidation();
    if (searchParams.get("edit")) {
      const next = new URLSearchParams(searchParams);
      next.delete("edit");
      setSearchParams(next, { replace: true });
    }
  };

  // Deep-link: /app/inventory?stage=parts&edit=<id>
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || !canManage || dialogOpen) return;
    let cancelled = false;
    void (async () => {
      try {
        const item = await api.getInventoryItem(editId);
        if (cancelled) return;
        openEdit(item);
      } catch (err) {
        toast.apiError(err, { fallback: "Unable to open item for editing" });
        const next = new URLSearchParams(searchParams);
        next.delete("edit");
        setSearchParams(next, { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once when edit id appears
  }, [searchParams.get("edit"), canManage]);

  const openDelete = (item: BackendInventoryItem) => {
    setDeleteTarget(item);
  };

  const closeDelete = () => {
    if (deleting) return;
    setDeleteTarget(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteInventoryItem(deleteTarget.id);
      toast.success("Item moved to trash", {
        description: `${deleteTarget.name} is inactive. Stock history and linked documents remain.`,
      });
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to move item to trash" });
    } finally {
      setDeleting(false);
    }
  };

  const restoreItem = async (item: BackendInventoryItem) => {
    setRestoringId(item.id);
    try {
      await api.restoreInventoryItem(item.id);
      toast.success("Item restored", {
        description: `${item.name} is active again.`,
      });
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to restore item" });
    } finally {
      setRestoringId(null);
    }
  };

  const findExistingTerm = (terms: BackendTaxonomyTerm[], name: string) =>
    terms.find((term) => term.name.toLowerCase() === name.toLowerCase() || term.slug.toLowerCase() === name.toLowerCase());

  const addCategory = async () => {
    const name = form.categoryOther.trim();
    if (!name) return;
    const existing = findExistingTerm(categoriesQuery.data ?? [], name);
    if (existing) {
      const next = { ...form, category: existing.slug, categoryOther: "" };
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
      const next = { ...form, category: created.slug, categoryOther: "" };
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
      const uploadedIds: string[] = [];
      for (const file of imageFiles) {
        const uploaded = await api.uploadFile(file);
        uploadedIds.push(uploaded.id);
      }
      const imageFileIds = [...existingImageFileIds, ...uploadedIds];
      const payload = {
        sku: form.sku.trim(),
        name: form.name.trim(),
        itemClass: form.itemClass,
        category: form.category,
        description: form.description.trim() || null,
        manufacturer: form.manufacturer.trim(),
        compatibleModels: form.compatibleModels.trim() || null,
        inStock: Number(form.inStock) || 0,
        reorderLevel: Number(form.reorderLevel) || 0,
        maxLevel: Number(form.maxLevel) || 0,
        binLocation: form.binLocation.trim(),
        trackBatches: form.trackBatches,
        trackSerials: form.trackSerials,
        unitCost: Number(form.unitCost) || 0,
        sellingPrice: Number(form.sellingPrice) || 0,
        deliveryCharge: Number(form.deliveryCharge) || 0,
        deliveryChargeType: form.deliveryChargeType,
        unitOfMeasure: form.unitOfMeasure,
        supplier: supplier?.name ?? "",
        supplierId: form.supplierId || null,
        imageFileIds,
        additionalFields: buildTrackingAdditionalFields(form, editingItem?.additionalFields),
      };
      if (editingItem) {
        await api.updateInventoryItem(editingItem.id, payload);
        toast({ title: "Inventory item updated", description: form.name.trim() });
      } else {
        await api.createInventoryItem(payload);
        toast({ title: "Inventory item added", description: form.name.trim() });
      }
      closeDialog();
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
    } catch (err) {
      if (!applyApiErrors(err, dialogRef.current)) {
        toast.apiError(err, { fallback: editingItem ? "Unable to update item" : "Unable to save item" });
      }
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<BackendInventoryItem>[] = [
    {
      key: "image",
      header: "Product",
      render: (i) => {
        const hasImage = Boolean(i.images && i.images.length > 0);
        const firstImg = hasImage ? i.images![0] : null;
        return (
          <div className="flex items-center py-0.5">
            <div
              className={cn(
                "group relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/80 bg-gradient-to-br from-muted/50 via-muted/30 to-background shadow-2xs transition-all duration-200 hover:border-primary/60 hover:shadow-xs",
                hasImage ? "cursor-pointer" : ""
              )}
              title={hasImage ? "Click to view image preview" : "No product image"}
              onClick={(e) => {
                if (hasImage) {
                  e.stopPropagation();
                  setPreviewState({
                    title: i.name,
                    images: i.images!.map((img) => api.fileDownloadUrl(img.fileId)),
                    index: 0,
                  });
                }
              }}
            >
              {firstImg ? (
                <>
                  <img
                    src={api.fileDownloadUrl(firstImg.fileId)}
                    alt={i.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/25 flex items-center justify-center">
                    <Eye className="h-4 w-4 text-white opacity-0 transition-opacity group-hover:opacity-100 drop-shadow-md" />
                  </div>
                  {i.images!.length > 1 && (
                    <span className="absolute bottom-0.5 right-0.5 rounded-md bg-black/75 px-1 py-0.2 text-[9px] font-semibold text-white backdrop-blur-xs">
                      +{i.images!.length - 1}
                    </span>
                  )}
                </>
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 via-primary/5 to-muted text-primary/70">
                  <Package className="h-5 w-5 opacity-70" />
                </div>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: "name",
      header: "Inventory Item",
      render: (i) => (
        <div>
          <p className="font-semibold text-foreground hover:text-primary transition-colors">{i.name}</p>
          <p className="font-mono text-xs text-muted-foreground mt-0.5">
            {i.sku} · {formatInventoryItemClass(i.itemClass)} · {termLabel(categoriesQuery.data, i.category)}
            {i.subcategory ? ` · ${termLabel(subcategoriesQuery.data, i.subcategory)}` : ""} · {i.unitOfMeasure ?? "pcs"}
          </p>
        </div>
      ),
    },
    {
      key: "itemClass",
      header: "Class",
      render: (i) => (
        <Badge variant="secondary">{formatInventoryItemClass(i.itemClass)}</Badge>
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
      key: "issued",
      header: "Issued",
      render: (i) => <span className="text-sm">{i.issued ?? 0}</span>,
    },
    {
      key: "damaged",
      header: "Damaged",
      render: (i) => <span className="text-sm">{i.damaged ?? 0}</span>,
    },
    {
      key: "stockState",
      header: "Stock",
      render: (i) => {
        const fields = parseCustomerAdditionalFields(i.additionalFields);
        const damaged = fields
          .filter((f) => f.label === "Damaged Stock")
          .reduce((sum, f) => sum + (Number(f.value.split(" ")[0]) || 0), 0);
        return (
          <div className="flex flex-col gap-1 items-start">
            {i.inStock <= i.reorderLevel ? (
              <Badge className="gap-1 bg-warning/15 text-warning-foreground hover:bg-warning/15">
                <AlertTriangle className="h-3 w-3" /> Low
              </Badge>
            ) : (
              <Badge className="gap-1 bg-success/12 text-success hover:bg-success/12">
                <PackageCheck className="h-3 w-3" /> OK
              </Badge>
            )}
            {damaged > 0 && (
              <Badge variant="destructive" className="text-[10px] py-0">
                🔴 {damaged} Damaged
              </Badge>
            )}
          </div>
        );
      },
    },
    { key: "sellingPrice", header: "Sell", render: (i) => <span className="text-sm">{formatCurrency(i.sellingPrice ?? 0)}</span> },
    { key: "unitCost", header: "Cost", render: (i) => <span className="text-sm">{formatCurrency(i.unitCost)}</span> },
    ...(stage === "cost"
      ? [{
          key: "stockValue" as const,
          header: "Stock value",
          render: (i: BackendInventoryItem) => (
            <span className="font-semibold">{formatCurrency(i.inStock * Number(i.unitCost))}</span>
          ),
        }]
      : []),
    { key: "supplier", header: "Supplier", render: (i) => <span className="text-sm text-muted-foreground">{i.supplier}</span> },
    {
      key: "status",
      header: "Status",
      render: (i) => <StatusBadge status={(i.status === "inactive" ? "inactive" : "active") as "active" | "inactive"} />,
    },
    ...(canManage
      ? [
          {
            key: "actions" as keyof BackendInventoryItem,
            header: "Actions",
            className: "w-[1%] whitespace-nowrap text-right",
            render: (i: BackendInventoryItem) => (
              <div
                className="flex items-center justify-end gap-1"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <Button variant="outline" size="sm" onClick={() => openEdit(i)}>
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                </Button>
                {i.status === "inactive" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={restoringId === i.id}
                    onClick={() => void restoreItem(i)}
                  >
                    {restoringId === i.id ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="mr-1 h-3.5 w-3.5" />
                    )}
                    Restore
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => openDelete(i)}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Trash
                  </Button>
                )}
              </div>
            ),
          } satisfies Column<BackendInventoryItem>,
        ]
      : []),
  ];

  return (
    <RoleGuard roles={["admin", "inventory", "engineer"]}>
      <div className="space-y-6">
        <PageHeader
          title={
            stage === "overview"
              ? "Inventory Overview"
              : stage === "cost"
                ? "Cost"
                : "Parts"
          }
          description={
            stage === "overview"
              ? "Stock health at a glance — catalog, issues, locations, reorder, and cost."
              : stage === "cost"
                ? "Unit cost, selling price, and stock value on hand."
                : "Parts catalog for spare parts, consumables, and equipment."
          }
          actions={
            canManage && (stage === "parts" || stage === "overview") ? (
              <Button onClick={openCreate} variant="brand">
                <Plus className="mr-1 h-4 w-4" /> Add Item
              </Button>
            ) : undefined
          }
        />
        <InventoryStageNav stage={stage} />

        {stage === "overview" ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Total SKUs" value={String(pagination.total)} icon={Boxes} accent="primary" />
              <StatCard label="Low stock" value={String(lowStock)} icon={AlertTriangle} accent="warning" />
              <StatCard label="On-hand value" value={formatCurrencyShort(totalValue)} icon={PackageCheck} accent="success" />
              <StatCard label="Reserved / damaged" value={`${reserved} / ${damaged}`} icon={Lock} accent="accent" />
            </div>

            {lowStock > 0 ? (
              <Link
                to="/app/stock-purchase-requests"
                className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning-foreground hover:bg-warning/10"
              >
                <AlertTriangle className="h-4 w-4" /> {lowStock} item(s) at or below reorder level — open Reorder.
              </Link>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {canManage ? (
                <ModuleQuickAction title="Add item" hint="Create a catalog SKU" icon={Plus} onClick={openCreate} />
              ) : null}
              <ModuleQuickAction title="Stock issue" hint="Approve & issue movements" icon={PackageMinus} to="/app/stock-ledger" />
              <ModuleQuickAction title="Locations" hint="Bins & transfers" icon={MapPin} to="/app/stock-transfers" />
              <ModuleQuickAction
                title="Reorder"
                hint={lowStock > 0 ? `${lowStock} low-stock SKU(s)` : "Purchase requests"}
                icon={RefreshCw}
                to="/app/stock-purchase-requests"
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Stock value</CardTitle>
                  <CardDescription className="text-xs">Book value by item class</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between gap-2 rounded-lg border px-3 py-2">
                    <span className="text-muted-foreground">Spare parts</span>
                    <span className="font-mono font-medium">{formatCurrency(sparePartsValue)}</span>
                  </div>
                  <div className="flex justify-between gap-2 rounded-lg border px-3 py-2">
                    <span className="text-muted-foreground">Consumables</span>
                    <span className="font-mono font-medium">{formatCurrency(consumablesValue)}</span>
                  </div>
                  <div className="flex justify-between gap-2 rounded-lg border px-3 py-2">
                    <span className="text-muted-foreground">Total on hand</span>
                    <span className="font-mono font-semibold">{formatCurrency(totalValue)}</span>
                  </div>
                  <Button variant="outline" size="sm" className="mt-2 w-full gap-1.5" asChild>
                    <Link to="/app/inventory?stage=cost">
                      <IndianRupee className="h-3.5 w-3.5" /> Open cost view
                    </Link>
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <div>
                    <CardTitle className="text-base">Parts catalog</CardTitle>
                    <CardDescription className="text-xs">Browse and edit stock items</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" asChild className="h-8 text-xs text-primary">
                    <Link to="/app/inventory?stage=parts">View all →</Link>
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(statsItems.slice(0, 5)).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted/40"
                      onClick={() => navigate(`/app/inventory/${item.id}`)}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{item.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">{item.sku}</p>
                      </div>
                      <span className="shrink-0 font-mono text-xs">{item.inStock} on hand</span>
                    </button>
                  ))}
                  {statsItems.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">No inventory items yet.</p>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total SKUs" value={String(pagination.total)} icon={Boxes} accent="primary" />
          {stage === "cost" ? (
            <StatCard label="On-hand value" value={formatCurrencyShort(totalValue)} icon={PackageCheck} accent="accent" />
          ) : (
            <StatCard label="Reserved / issued / damaged" value={`${reserved} / ${issued} / ${damaged}`} icon={Lock} accent="accent" />
          )}
          <StatCard label="Spare Parts Value" value={formatCurrencyShort(sparePartsValue)} icon={PackageCheck} accent="success" />
          <StatCard label="Consumables Value" value={formatCurrencyShort(consumablesValue)} icon={PackageCheck} accent="accent" />
        </div>
        {lowStock > 0 && (
          <Link
            to="/app/stock-purchase-requests"
            className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning-foreground hover:bg-warning/10"
          >
            <AlertTriangle className="h-4 w-4" /> {lowStock} item(s) at or below reorder level — open Reorder.
          </Link>
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
          filterValues={{ ...filters, status: filters.status || "active" }}
          onFilterChange={setFilter}
          filters={[
            {
              key: "itemClass",
              label: "Class",
              options: INVENTORY_ITEM_CLASS_OPTIONS.map((o) => ({ label: o.label, value: o.value })),
            },
            { key: "category", label: "Category", options: categoryFilterOptions },
            {
              key: "status",
              label: "Status",
              options: [
                { label: "Active", value: "active" },
                { label: "Trash", value: "inactive" },
              ],
            },
          ]}
          pagination={pagination}
          onPageChange={setPage}
          onLimitChange={setLimit}
          loading={itemsQuery.isLoading}
          isFetching={itemsQuery.isFetching}
          error={itemsQuery.error as Error | null}
          onRetry={() => loadItems()}
          onRowClick={(item) => navigate(`/app/inventory/${item.id}`)}
        />
          </>
        )}

        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); else setDialogOpen(open); }}>
          <DialogContent ref={dialogRef} className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingItem ? "Edit Inventory Item" : "Add Inventory Item"}</DialogTitle>
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
                {existingImageFileIds.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {existingImageFileIds.map((fileId) => (
                      <div key={fileId} className="group relative h-14 w-14 overflow-hidden rounded-lg border border-border bg-muted">
                        <img src={api.fileDownloadUrl(fileId)} alt="" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={() => setExistingImageFileIds((prev) => prev.filter((id) => id !== fileId))}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
                {imageFiles.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {imageFiles.map((file, idx) => {
                      const url = URL.createObjectURL(file);
                      return (
                        <div key={idx} className="group relative h-14 w-14 overflow-hidden rounded-lg border border-border bg-muted">
                          <img src={url} alt={file.name} className="h-full w-full object-cover" />
                          <button
                            type="button"
                            className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100"
                            onClick={() => setImageFiles((prev) => prev.filter((_, i) => i !== idx))}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
              <div className="grid gap-2" data-field="sku">
                <Label htmlFor="inventory-sku" className={shouldShow("sku") ? "text-destructive" : undefined}>
                  Part ID / SKU
                </Label>
                <Input
                  id="inventory-sku"
                  value={form.sku}
                  placeholder="Optional"
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
              <div className="grid gap-2" data-field="itemClass">
                <Label className={shouldShow("itemClass") ? "text-destructive" : undefined}>
                  Category
                  <RequiredMark />
                </Label>
                <Select
                  value={form.itemClass}
                  onValueChange={(v) => {
                    const itemClass = v as InventoryItemClass;
                    const suggestedCategory =
                      itemClass === "consumable"
                        ? categories.find((c) => c.slug === "consumables")?.slug ?? form.category
                        : itemClass === "equipment"
                          ? categories.find((c) => c.slug === "equipment")?.slug ?? form.category
                          : form.category === "consumables" || form.category === "equipment"
                            ? categories.find((c) => c.slug === "spare-parts")?.slug ?? ""
                            : form.category;
                    const next = {
                      ...form,
                      itemClass,
                      category: suggestedCategory,
                    };
                    setForm(next);
                    clearError("itemClass");
                    handleChange("itemClass", next);
                  }}
                >
                  <SelectTrigger className={fieldErrorClass(shouldShow("itemClass"))}>
                    <SelectValue placeholder="Spare Parts, Consumables, or Equipment" />
                  </SelectTrigger>
                  <SelectContent>
                    {INVENTORY_ITEM_CLASS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Spare Parts, Consumables, or Equipment. Technical category options stay available below.
                </p>
                {shouldShow("itemClass") && <FormFieldError field="itemClass" message={errors.itemClass} />}
              </div>
              <div className="grid gap-2" data-field="category">
                <div className="flex items-center justify-between gap-2">
                  <Label className={shouldShow("category") ? "text-destructive" : undefined}>
                    Technical category
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
                      categoryOther: v === ADD_OPTION ? form.categoryOther : "",
                      itemClass:
                        v === ADD_OPTION
                          ? form.itemClass
                          : inferItemClassFromCategory(v),
                    };
                    if (v !== ADD_OPTION && v === "consumables") next.itemClass = "consumable";
                    if (v !== ADD_OPTION && v === "spare-parts") next.itemClass = "spare_part";
                    if (v !== ADD_OPTION && v === "equipment") next.itemClass = "equipment";
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
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2" data-field="manufacturer">
                  <Label htmlFor="inventory-manufacturer">Manufacturer</Label>
                  <Input
                    id="inventory-manufacturer"
                    value={form.manufacturer}
                    onChange={(e) => {
                      const next = { ...form, manufacturer: e.target.value };
                      setForm(next);
                      handleChange("manufacturer", next);
                    }}
                    onBlur={() => handleBlur("manufacturer", form)}
                    placeholder="e.g. Siemens"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Stock unit</Label>
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
              </div>
              <div className="grid gap-2" data-field="compatibleModels">
                <Label htmlFor="inventory-compatible">Compatible models</Label>
                <Textarea
                  id="inventory-compatible"
                  value={form.compatibleModels}
                  onChange={(e) => {
                    const next = { ...form, compatibleModels: e.target.value };
                    setForm(next);
                    handleChange("compatibleModels", next);
                  }}
                  onBlur={() => handleBlur("compatibleModels", form)}
                  rows={2}
                  placeholder="e.g. Magnetom Vida, Magnetom Sola"
                />
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
                  <Label htmlFor="inventory-reorder">Min/max level (min)</Label>
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
                <div className="grid gap-2" data-field="maxLevel">
                  <Label htmlFor="inventory-max">Min/max level (max)</Label>
                  <Input
                    id="inventory-max"
                    type="number"
                    min={0}
                    value={form.maxLevel}
                    onChange={(e) => {
                      const next = { ...form, maxLevel: e.target.value };
                      setForm(next);
                      handleChange("maxLevel", next);
                    }}
                    onBlur={() => handleBlur("maxLevel", form)}
                    className={fieldErrorClass(shouldShow("maxLevel"))}
                    {...fieldAria("maxLevel", shouldShow("maxLevel") ? errors.maxLevel : null)}
                  />
                  {shouldShow("maxLevel") && <FormFieldError field="maxLevel" message={errors.maxLevel} />}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2" data-field="binLocation">
                  <Label htmlFor="inventory-bin">Bin/location</Label>
                  <Input
                    id="inventory-bin"
                    value={form.binLocation}
                    onChange={(e) => {
                      const next = { ...form, binLocation: e.target.value };
                      setForm(next);
                      handleChange("binLocation", next);
                    }}
                    onBlur={() => handleBlur("binLocation", form)}
                    placeholder="e.g. A-12-03"
                  />
                </div>
                <div className="grid gap-2" data-field="unitCost">
                  <Label htmlFor="inventory-cost">Cost / selling price (cost)</Label>
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
                  <Label htmlFor="inventory-selling">Cost / selling price (selling)</Label>
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
              <div className="space-y-3 rounded-lg border border-border p-3">
                <p className="text-sm font-medium">Batch / serial tracking</p>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="track-batches"
                    checked={form.trackBatches}
                    onCheckedChange={(checked) =>
                      setForm({
                        ...form,
                        trackBatches: checked === true,
                        batchNumbers: checked === true ? form.batchNumbers : "",
                      })
                    }
                  />
                  <Label htmlFor="track-batches" className="font-normal">
                    Track batches
                  </Label>
                </div>
                {form.trackBatches ? (
                  <div className="grid gap-2 pl-6">
                    <Label htmlFor="batch-numbers" className="text-muted-foreground font-normal">
                      Batch numbers
                    </Label>
                    <Textarea
                      id="batch-numbers"
                      value={form.batchNumbers}
                      placeholder="Enter batch or lot numbers (one per line or comma-separated)"
                      rows={3}
                      onChange={(e) => setForm({ ...form, batchNumbers: e.target.value })}
                    />
                  </div>
                ) : null}
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="track-serials"
                    checked={form.trackSerials}
                    onCheckedChange={(checked) =>
                      setForm({
                        ...form,
                        trackSerials: checked === true,
                        serialNumbers: checked === true ? form.serialNumbers : "",
                      })
                    }
                  />
                  <Label htmlFor="track-serials" className="font-normal">
                    Track serial numbers
                  </Label>
                </div>
                {form.trackSerials ? (
                  <div className="grid gap-2 pl-6">
                    <Label htmlFor="serial-numbers" className="text-muted-foreground font-normal">
                      Serial numbers
                    </Label>
                    <Textarea
                      id="serial-numbers"
                      value={form.serialNumbers}
                      placeholder="Enter serial numbers (one per line or comma-separated)"
                      rows={3}
                      onChange={(e) => setForm({ ...form, serialNumbers: e.target.value })}
                    />
                  </div>
                ) : null}
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
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {editingItem ? "Save changes" : "Save item"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <DeleteConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(open) => {
            if (!open) closeDelete();
          }}
          title="Move to trash?"
          description={
            <div className="space-y-2">
              <p>
                This soft-removes{" "}
                <span className="font-medium text-foreground">{deleteTarget?.name}</span>
                {deleteTarget?.sku ? ` (${deleteTarget.sku})` : ""}. The product is marked inactive — not permanently erased.
              </p>
              <p>
                Stock history, reservations, purchase lines, and sales lines stay linked. Restore anytime from the Trash status filter.
              </p>
            </div>
          }
          confirmLabel="Move to trash"
          loading={deleting}
          onConfirm={() => void confirmDelete()}
        />

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
      </div>
    </RoleGuard>
  );
}
