import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  ChevronsUpDown,
  FileText,
  Loader2,
  Minus,
  Package,
  Plus,
  Receipt,
  Search,
  ShoppingBag,
  Sparkles,
  Trash2,
  User,
  UserPlus,
  Wrench,
  X,
} from "lucide-react";
import { QuickAddCustomerDialog } from "@/components/sales/QuickAddCustomerDialog";
import { CreditExposureBanner } from "@/components/shared/CreditExposureBanner";
import { inventoryOriginUnitPrice } from "@/components/shared/InventoryHelpers";
import { RequiredMark } from "@/components/shared/RequiredMark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  api,
  type BackendCatalogItem,
  type BackendCustomer,
  type BackendInventoryItem,
  type BackendSalesOrder,
  type BackendTaxonomyTerm,
} from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { termLabel } from "@/lib/taxonomy";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { CUSTOMER_WRITE_ROLES } from "@/config/roles";

type DraftLine = {
  key: string;
  inventoryItemId?: string | null;
  catalogItemId?: string | null;
  type: string;
  description: string;
  sku?: string | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
};

const SALE_LINE_TYPES = [
  { value: "part", label: "Part" },
  { value: "service", label: "Service" },
  { value: "other", label: "Other" },
] as const;

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sellingPrice(item: BackendInventoryItem) {
  return inventoryOriginUnitPrice(item);
}

function availableStock(item: BackendInventoryItem) {
  return item.available ?? Math.max(0, item.inStock - item.reserved);
}

const EQUIPMENT_STOCK_PATTERN = /\bequipments?\b|\bmachines?\b/;

function isEquipmentStockItem(
  item: BackendInventoryItem,
  inventoryCategories: BackendTaxonomyTerm[],
  equipmentCategories: BackendTaxonomyTerm[],
) {
  const inventoryTerm = inventoryCategories.find(
    (term) => term.slug === item.category || term.name === item.category,
  );
  const categoryText = `${item.category} ${inventoryTerm?.name ?? ""} ${inventoryTerm?.slug ?? ""}`.toLowerCase();
  const subcategoryText = `${item.subcategory ?? ""}`.toLowerCase();
  if (EQUIPMENT_STOCK_PATTERN.test(categoryText) || EQUIPMENT_STOCK_PATTERN.test(subcategoryText)) {
    return true;
  }
  const matchesEquipmentTaxonomy = equipmentCategories.some(
    (term) => term.slug === item.category || term.name === item.category,
  );
  const matchesInventoryTaxonomy = inventoryCategories.some(
    (term) => term.slug === item.category || term.name === item.category,
  );
  return matchesEquipmentTaxonomy && !matchesInventoryTaxonomy;
}

async function listSaleInventoryItems(search?: string) {
  const first = await api.listInventory({
    limit: 100,
    page: 1,
    search: search || undefined,
    sortBy: "name",
    sortOrder: "asc",
  });
  const totalPages = Math.min(first.meta.totalPages || 1, search ? 1 : 5);
  if (totalPages <= 1) return first.data;
  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      api
        .listInventory({
          limit: 100,
          page: index + 2,
          sortBy: "name",
          sortOrder: "asc",
        })
        .then((result) => result.data),
    ),
  );
  return first.data.concat(...rest);
}

function lineNet(line: DraftLine) {
  return Math.max(0, line.quantity * line.unitPrice - (line.discount || 0));
}

function lineTotal(line: DraftLine) {
  const net = lineNet(line);
  return net + (net * (line.taxRate || 0)) / 100;
}

function linesFromOrder(initial?: BackendSalesOrder): DraftLine[] {
  return (
    initial?.lines.map((line) => ({
      key: line.id,
      inventoryItemId: line.inventoryItemId,
      catalogItemId: line.catalogItemId,
      type: line.type || (line.inventoryItemId ? "part" : "other"),
      description: line.description,
      sku: line.sku,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discount: line.discount,
      taxRate: line.taxRate,
    })) ?? []
  );
}

export function SaleFormDialog({
  open,
  onOpenChange,
  mode,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: BackendSalesOrder;
  onSaved: (order: BackendSalesOrder) => void;
}) {
  const { hasRole } = useAuth();
  const canAddCustomer = hasRole(CUSTOMER_WRITE_ROLES);
  const [customerId, setCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [extraCustomers, setExtraCustomers] = useState<BackendCustomer[]>([]);
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [serviceSearch, setServiceSearch] = useState("");
  const [activeItemTab, setActiveItemTab] = useState<"inventory" | "service">("inventory");
  const [saving, setSaving] = useState(false);
  const debouncedItemSearch = useDebouncedValue(itemSearch);

  useEffect(() => {
    if (!open) return;
    setCustomerId(initial?.customerId ?? "");
    setNotes(initial?.notes ?? "");
    setLines(linesFromOrder(initial));
    setCustomerSearch("");
    setItemSearch("");
    setServiceSearch("");
    setCustomerOpen(false);
    setItemOpen(false);
    setServiceOpen(false);
    setActiveItemTab("inventory");
  }, [open, initial?.id]);

  const customersQuery = useQuery({
    queryKey: ["customers", "sale-form"],
    queryFn: () =>
      api.listCustomers({
        status: "active",
        limit: 200,
        page: 1,
      }),
    enabled: open,
  });

  const inventoryQuery = useQuery({
    queryKey: ["inventory", "sale-form", debouncedItemSearch],
    queryFn: () => listSaleInventoryItems(debouncedItemSearch || undefined),
    enabled: open,
  });

  const inventoryCategoriesQuery = useQuery({
    queryKey: ["taxonomy", "inventory_category"],
    queryFn: () => api.listTaxonomy({ type: "inventory_category" }),
    enabled: open,
  });

  const inventorySubcategoriesQuery = useQuery({
    queryKey: ["taxonomy", "inventory_subcategory"],
    queryFn: () => api.listTaxonomy({ type: "inventory_subcategory" }),
    enabled: open,
  });

  const equipmentCategoriesQuery = useQuery({
    queryKey: ["taxonomy", "equipment_category"],
    queryFn: () => api.listTaxonomy({ type: "equipment_category" }),
    enabled: open,
  });

  const catalogQuery = useQuery({
    queryKey: ["service-catalog", "sale-form"],
    queryFn: () => api.listServiceCatalog(),
    enabled: open,
  });

  const customers = useMemo(() => {
    const rows = [...(customersQuery.data?.data ?? [])];
    for (const extra of extraCustomers) {
      if (!rows.some((row) => row.id === extra.id)) rows.unshift(extra);
    }
    if (initial?.customerId && !rows.some((row) => row.id === initial.customerId)) {
      rows.unshift({
        id: initial.customerId,
        name: initial.customerName,
        phone: "",
        city: "",
        type: "",
      } as BackendCustomer);
    }
    return rows;
  }, [customersQuery.data?.data, extraCustomers, initial]);

  const inventoryCategories = useMemo(
    () => inventoryCategoriesQuery.data ?? [],
    [inventoryCategoriesQuery.data],
  );
  const inventorySubcategories = inventorySubcategoriesQuery.data ?? [];
  const equipmentCategories = useMemo(
    () => equipmentCategoriesQuery.data ?? [],
    [equipmentCategoriesQuery.data],
  );
  const inventory = useMemo(
    () =>
      (inventoryQuery.data ?? []).filter(
        (item) => !isEquipmentStockItem(item, inventoryCategories, equipmentCategories),
      ),
    [equipmentCategories, inventoryCategories, inventoryQuery.data],
  );
  const selectedCustomer = customers.find((c) => c.id === customerId);
  const selectedInventoryIds = useMemo(
    () => new Set(lines.map((line) => line.inventoryItemId).filter(Boolean) as string[]),
    [lines],
  );
  const selectedCatalogIds = useMemo(
    () => new Set(lines.map((line) => line.catalogItemId).filter(Boolean) as string[]),
    [lines],
  );
  const catalog = useMemo(() => {
    const rows = (catalogQuery.data ?? []).filter((item) => item.isActive !== false);
    const q = serviceSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((item) =>
      `${item.name} ${item.code} ${item.category} ${item.description ?? ""}`.toLowerCase().includes(q),
    );
  }, [catalogQuery.data, serviceSearch]);

  const totals = useMemo(() => {
    const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
    const discount = lines.reduce((sum, line) => sum + (line.discount || 0), 0);
    const tax = lines.reduce((sum, line) => sum + (lineNet(line) * (line.taxRate || 0)) / 100, 0);
    return { subtotal, discount, tax, total: subtotal - discount + tax };
  }, [lines]);

  const addInventory = (item: BackendInventoryItem) => {
    setLines((prev) => {
      if (prev.some((line) => line.inventoryItemId === item.id)) return prev;
      return [
        ...prev,
        {
          key: newKey(),
          inventoryItemId: item.id,
          type: "part",
          description: item.name,
          sku: item.sku,
          quantity: 1,
          unitPrice: sellingPrice(item),
          discount: 0,
          taxRate: 0,
        },
      ];
    });
  };

  const removeInventory = (itemId: string) => {
    setLines((prev) => prev.filter((line) => line.inventoryItemId !== itemId));
  };

  const toggleInventory = (item: BackendInventoryItem) => {
    if (selectedInventoryIds.has(item.id)) removeInventory(item.id);
    else addInventory(item);
  };

  const addCatalogService = (item: BackendCatalogItem) => {
    setLines((prev) => {
      if (prev.some((line) => line.catalogItemId === item.id)) return prev;
      return [
        ...prev,
        {
          key: newKey(),
          catalogItemId: item.id,
          type: "service",
          description: item.name,
          sku: item.code,
          quantity: 1,
          unitPrice: Number(item.unitPrice ?? 0),
          discount: 0,
          taxRate: Number(item.taxRate ?? 0),
        },
      ];
    });
  };

  const removeCatalog = (itemId: string) => {
    setLines((prev) => prev.filter((line) => line.catalogItemId !== itemId));
  };

  const toggleCatalog = (item: BackendCatalogItem) => {
    if (selectedCatalogIds.has(item.id)) removeCatalog(item.id);
    else addCatalogService(item);
  };

  const addCustomItem = (type: "service" | "other" = "other") => {
    setLines((prev) => [
      ...prev,
      {
        key: newKey(),
        type,
        description: "",
        sku: "",
        quantity: 1,
        unitPrice: 0,
        discount: 0,
        taxRate: 0,
      },
    ]);
    setItemOpen(false);
    setServiceOpen(false);
  };

  const updateLine = (key: string, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

  const closeForm = (next: boolean) => {
    if (addCustomerOpen) return;
    onOpenChange(next);
  };

  const save = async () => {
    if (!customerId) {
      toast({ title: "Pick a customer", variant: "destructive" });
      return;
    }
    const ready = lines.filter((line) => line.description.trim() && line.quantity > 0);
    if (!ready.length) {
      toast({ title: "Add at least one sold item", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        customerId,
        notes: notes.trim() || null,
        lines: ready.map((line) => ({
          inventoryItemId: line.inventoryItemId ?? null,
          catalogItemId: line.catalogItemId ?? null,
          type: line.type,
          description: line.description.trim(),
          sku: line.sku?.trim() || null,
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
          discount: Number(line.discount || 0),
          taxRate: Number(line.taxRate || 0),
        })),
      };
      const saved =
        mode === "edit" && initial
          ? await api.updateSalesOrder(initial.id, payload)
          : await api.createSalesOrder(payload);
      toast.success(mode === "edit" ? "Sale updated successfully" : "Sale recorded successfully", {
        description: `${saved.reference} · ${formatCurrency(saved.total)}`,
      });
      onOpenChange(false);
      onSaved(saved);
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to save sale order" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={closeForm}>
        <DialogContent
          className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-3xl"
          onPointerDownOutside={(event) => {
            const target = event.target as HTMLElement | null;
            if (addCustomerOpen || target?.closest("[data-radix-popper-content-wrapper]")) {
              event.preventDefault();
            }
          }}
          onInteractOutside={(event) => {
            const target = event.target as HTMLElement | null;
            if (addCustomerOpen || target?.closest("[data-radix-popper-content-wrapper]")) {
              event.preventDefault();
            }
          }}
        >
          {/* Header section with gradient accent */}
          <div className="border-b bg-gradient-to-r from-amber-500/10 via-teal-500/5 to-transparent p-6 dark:from-amber-500/20 dark:via-teal-500/10">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-md shadow-amber-500/20">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight">
                  {mode === "edit" ? "Edit sale order" : "Create new sale"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Select a customer, pick inventory items, adjust pricing, and record the order billing.
                </DialogDescription>
              </div>
            </div>
          </div>

          <div className="space-y-6 p-6">
            {/* Step 1: Customer Selection */}
            <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="flex items-center gap-2 text-sm font-semibold">
                  <User className="h-4 w-4 text-amber-500" />
                  Select Customer
                  <RequiredMark />
                </Label>
                {canAddCustomer ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700"
                    onClick={() => setAddCustomerOpen(true)}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    New customer
                  </Button>
                ) : null}
              </div>

              <Popover modal open={customerOpen} onOpenChange={setCustomerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={customerOpen}
                    className="h-11 w-full justify-between bg-background font-normal shadow-none hover:bg-accent/50"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <User className="h-4 w-4 text-muted-foreground shrink-0" />
                      {selectedCustomer ? (
                        <span className="font-medium text-foreground">{selectedCustomer.name}</span>
                      ) : customersQuery.isLoading ? (
                        <span className="text-muted-foreground">Loading customers list…</span>
                      ) : (
                        <span className="text-muted-foreground">Search and select a customer…</span>
                      )}
                    </span>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="z-[80] p-0"
                  align="start"
                  style={{ width: "var(--radix-popover-trigger-width)" }}
                >
                  <Command>
                    <CommandInput
                      placeholder="Search customer by name, phone or reference…"
                      value={customerSearch}
                      onValueChange={setCustomerSearch}
                    />
                    <CommandList className="max-h-60">
                      <CommandEmpty>
                        {customersQuery.isLoading ? "Loading customers…" : "No customer found."}
                      </CommandEmpty>
                      <CommandGroup>
                        {customers.map((customer) => (
                          <CommandItem
                            key={customer.id}
                            value={`${customer.reference} ${customer.name} ${customer.phone} ${customer.city} ${customer.type}`}
                            onSelect={() => {
                              setCustomerId(customer.id);
                              setCustomerOpen(false);
                              setCustomerSearch("");
                            }}
                            className="py-2.5"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4 shrink-0 text-amber-500",
                                customer.id === customerId ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium truncate">{customer.name}</span>
                                <span className="text-[10px] font-mono text-muted-foreground uppercase bg-muted px-1.5 py-0.5 rounded">
                                  {customer.reference}
                                </span>
                              </div>
                              <span className="block truncate text-xs text-muted-foreground mt-0.5">
                                {customer.phone || customer.city || customer.type || "Client"}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <CreditExposureBanner customerId={customerId} currentTotal={totals.total} />

            {/* Step 2: Sold Items Selection */}
            <div className="rounded-xl border bg-card p-4 shadow-sm space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Label className="flex items-center gap-2 text-sm font-semibold">
                  <Package className="h-4 w-4 text-amber-500" />
                  Sold Items
                  <RequiredMark />
                </Label>

                {/* Switcher & Secondary Actions */}
                <div className="flex flex-wrap items-center gap-1.5 bg-muted/50 p-1 rounded-lg border">
                  <button
                    type="button"
                    onClick={() => setActiveItemTab("inventory")}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                      activeItemTab === "inventory"
                        ? "bg-background text-amber-600 dark:text-amber-400 shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Package className="h-3.5 w-3.5" />
                    Inventory Items
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveItemTab("service")}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                      activeItemTab === "service"
                        ? "bg-background text-amber-600 dark:text-amber-400 shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Wrench className="h-3.5 w-3.5" />
                    Catalog Services
                  </button>
                  <div className="h-4 w-[1px] bg-border mx-0.5 hidden sm:block" />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => addCustomItem("other")}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Custom Charge
                  </Button>
                </div>
              </div>

              {/* Active Tab Item Selector */}
              {activeItemTab === "inventory" ? (
                <div className="space-y-3">
                  <Popover modal open={itemOpen} onOpenChange={setItemOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={itemOpen}
                        className="h-11 w-full justify-between bg-background font-normal shadow-none hover:bg-accent/50"
                      >
                        <span className="flex items-center gap-2 truncate">
                          <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                          {selectedInventoryIds.size > 0 ? (
                            <span className="font-medium text-amber-600 dark:text-amber-400">
                              {selectedInventoryIds.size} inventory item
                              {selectedInventoryIds.size === 1 ? "" : "s"} selected
                            </span>
                          ) : inventoryQuery.isLoading ? (
                            <span className="text-muted-foreground">Loading inventory stock…</span>
                          ) : (
                            <span className="text-muted-foreground">
                              Select products / inventory items to sell…
                            </span>
                          )}
                        </span>
                        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="z-[80] p-0"
                      align="start"
                      style={{ width: "var(--radix-popover-trigger-width)" }}
                    >
                      <Command shouldFilter={!debouncedItemSearch}>
                        <CommandInput
                          placeholder="Search inventory items by name, SKU or category…"
                          value={itemSearch}
                          onValueChange={setItemSearch}
                        />
                        <CommandList className="max-h-64">
                          <CommandEmpty>
                            {inventoryQuery.isLoading
                              ? "Searching inventory…"
                              : "No matching inventory items found."}
                          </CommandEmpty>
                          <CommandGroup heading="Available Products & Parts">
                            {inventory.map((item) => {
                              const selected = selectedInventoryIds.has(item.id);
                              const categoryName = termLabel(inventoryCategories, item.category);
                              const subcategoryName = item.subcategory
                                ? termLabel(inventorySubcategories, item.subcategory)
                                : "";
                              const stock = availableStock(item);
                              return (
                                <CommandItem
                                  key={item.id}
                                  value={`${item.name} ${item.sku ?? ""} ${categoryName} ${subcategoryName} ${item.supplier ?? ""}`}
                                  onSelect={() => toggleInventory(item)}
                                  className="py-2.5"
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4 shrink-0 text-amber-500",
                                      selected ? "opacity-100" : "opacity-0",
                                    )}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <span className="block truncate font-medium">{item.name}</span>
                                    <span className="block truncate text-xs text-muted-foreground mt-0.5">
                                      <span className="font-mono text-[11px]">{item.sku ?? "No SKU"}</span>
                                      {categoryName && categoryName !== "—" ? ` · ${categoryName}` : ""}
                                      {subcategoryName && subcategoryName !== "—" ? ` · ${subcategoryName}` : ""}
                                    </span>
                                  </div>
                                  <div className="ml-2 shrink-0 text-right">
                                    <span className="block font-semibold text-amber-600 dark:text-amber-400">
                                      {formatCurrency(sellingPrice(item))}
                                    </span>
                                    <span
                                      className={cn(
                                        "text-[10px] font-medium px-1.5 py-0.5 rounded",
                                        stock > 0
                                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                          : "bg-rose-500/10 text-rose-600 dark:text-rose-400",
                                      )}
                                    >
                                      {stock > 0 ? `${stock} in stock` : "Out of stock"}
                                    </span>
                                  </div>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  {/* Selected Inventory Badges */}
                  {lines.some((line) => line.inventoryItemId) ? (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-xs text-muted-foreground mr-1">Selected:</span>
                      {lines
                        .filter((line) => line.inventoryItemId)
                        .map((line) => (
                          <Badge
                            key={line.key}
                            variant="secondary"
                            className="gap-1.5 py-1 px-2.5 bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"
                          >
                            <Package className="h-3 w-3" />
                            <span>{line.description}</span>
                            <button
                              type="button"
                              className="rounded-full p-0.5 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300"
                              onClick={() => removeInventory(line.inventoryItemId!)}
                              aria-label={`Remove ${line.description}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-3">
                  <Popover modal open={serviceOpen} onOpenChange={setServiceOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={serviceOpen}
                        className="h-11 w-full justify-between bg-background font-normal shadow-none hover:bg-accent/50"
                      >
                        <span className="flex items-center gap-2 truncate">
                          <Wrench className="h-4 w-4 text-muted-foreground shrink-0" />
                          {selectedCatalogIds.size > 0 ? (
                            <span className="font-medium text-teal-600 dark:text-teal-400">
                              {selectedCatalogIds.size} service
                              {selectedCatalogIds.size === 1 ? "" : "s"} selected
                            </span>
                          ) : catalogQuery.isLoading ? (
                            <span className="text-muted-foreground">Loading services catalog…</span>
                          ) : (
                            <span className="text-muted-foreground">
                              Select services from catalog…
                            </span>
                          )}
                        </span>
                        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="z-[80] p-0"
                      align="start"
                      style={{ width: "var(--radix-popover-trigger-width)" }}
                    >
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Search service catalog by name or code…"
                          value={serviceSearch}
                          onValueChange={setServiceSearch}
                        />
                        <CommandList className="max-h-64">
                          <CommandEmpty>
                            {catalogQuery.isLoading ? "Loading services…" : "No catalog services found."}
                          </CommandEmpty>
                          <CommandGroup heading="Service Catalog">
                            {catalog.map((item) => {
                              const selected = selectedCatalogIds.has(item.id);
                              return (
                                <CommandItem
                                  key={item.id}
                                  value={`${item.name} ${item.code} ${item.category}`}
                                  onSelect={() => toggleCatalog(item)}
                                  className="py-2.5"
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4 shrink-0 text-teal-500",
                                      selected ? "opacity-100" : "opacity-0",
                                    )}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <span className="block truncate font-medium">{item.name}</span>
                                    <span className="block truncate text-xs text-muted-foreground mt-0.5 font-mono">
                                      {item.code} {item.category ? `· ${item.category}` : ""}
                                    </span>
                                  </div>
                                  <span className="ml-2 shrink-0 font-semibold text-teal-600 dark:text-teal-400">
                                    {formatCurrency(Number(item.unitPrice ?? 0))}
                                  </span>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  {/* Selected Services Badges */}
                  {lines.some((line) => line.catalogItemId) ? (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-xs text-muted-foreground mr-1">Selected Services:</span>
                      {lines
                        .filter((line) => line.catalogItemId)
                        .map((line) => (
                          <Badge
                            key={line.key}
                            variant="secondary"
                            className="gap-1.5 py-1 px-2.5 bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20"
                          >
                            <Wrench className="h-3 w-3" />
                            <span>{line.description}</span>
                            <button
                              type="button"
                              className="rounded-full p-0.5 hover:bg-teal-500/20 text-teal-700 dark:text-teal-300"
                              onClick={() => removeCatalog(line.catalogItemId!)}
                              aria-label={`Remove ${line.description}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {/* Line Items Pricing Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-amber-500" />
                  Order Line Items ({lines.length})
                </Label>
                {lines.length > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-destructive hover:bg-destructive/10"
                    onClick={() => setLines([])}
                  >
                    Clear all items
                  </Button>
                ) : null}
              </div>

              {lines.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center bg-muted/20 space-y-2">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
                    <ShoppingBag className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-medium text-foreground">No items added to this sale yet</p>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    Select inventory items above or click "+ Custom Charge" to build your order billing lines.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {lines.map((line, idx) => (
                    <div
                      key={line.key}
                      className="group relative rounded-xl border bg-card p-3.5 shadow-sm transition-all hover:border-amber-500/30"
                    >
                      <div className="grid gap-3 sm:grid-cols-12 sm:items-center">
                        {/* Item Description */}
                        <div className="sm:col-span-5 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                              #{idx + 1} Item / Description
                            </span>
                            {line.inventoryItemId ? (
                              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                                Product
                              </span>
                            ) : line.catalogItemId ? (
                              <span className="text-[10px] font-semibold text-teal-600 dark:text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded">
                                Service
                              </span>
                            ) : null}
                          </div>
                          <Input
                            value={line.description}
                            onChange={(e) => updateLine(line.key, { description: e.target.value })}
                            placeholder="Item name or service description"
                            className="h-9 font-medium"
                          />
                        </div>

                        {/* Quantity controls */}
                        <div className="sm:col-span-2 space-y-1">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                            Qty
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-9 w-7 shrink-0"
                              onClick={() =>
                                updateLine(line.key, { quantity: Math.max(1, Number(line.quantity) - 1) })
                              }
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              className="h-9 min-w-0 flex-1 px-1 text-center font-medium tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                              type="number"
                              min={1}
                              value={line.quantity}
                              onChange={(e) =>
                                updateLine(line.key, { quantity: Math.max(1, Number(e.target.value) || 0) })
                              }
                            />
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-9 w-7 shrink-0"
                              onClick={() =>
                                updateLine(line.key, { quantity: Number(line.quantity) + 1 })
                              }
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        {/* Unit Price */}
                        <div className="sm:col-span-2 space-y-1">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                            Unit Price
                          </span>
                          <Input
                            className="h-9 text-right font-medium tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            type="number"
                            min={0}
                            step="0.01"
                            value={line.unitPrice}
                            onChange={(e) =>
                              updateLine(line.key, { unitPrice: Number(e.target.value) || 0 })
                            }
                          />
                        </div>

                        {/* Line Total & Remove */}
                        <div className="sm:col-span-3 flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-4">
                          <div className="text-right">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                              Net Total
                            </span>
                            <span className="text-base font-bold text-foreground">
                              {formatCurrency(lineTotal(line))}
                            </span>
                          </div>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setLines((prev) => prev.filter((row) => row.key !== line.key))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notes Section */}
            <div className="rounded-xl border bg-card p-4 shadow-sm space-y-2">
              <Label htmlFor="sale-notes" className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-500" />
                Sale Notes & Hints
              </Label>
              <Textarea
                id="sale-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add serial numbers, warranty details, delivery notes, or special customer requests…"
                className="resize-none text-sm"
              />
            </div>
          </div>

          {/* Footer Summary */}
          <DialogFooter className="border-t bg-muted/40 p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
              <div className="text-left">
                <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                  Subtotal: {formatCurrency(totals.subtotal)}
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-xs text-muted-foreground font-medium">Total Sale:</span>
                  <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                    {formatCurrency(totals.total)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <Button type="button" variant="outline" className="h-10" onClick={() => closeForm(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="brand"
                className="h-10 px-6 gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold shadow-md shadow-amber-500/20"
                disabled={saving}
                onClick={() => void save()}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {mode === "edit" ? "Save changes" : "Record sale"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {canAddCustomer ? (
        <QuickAddCustomerDialog
          open={addCustomerOpen}
          onOpenChange={setAddCustomerOpen}
          onCreated={(customer) => {
            setExtraCustomers((prev) => [customer, ...prev.filter((row) => row.id !== customer.id)]);
            setCustomerId(customer.id);
          }}
        />
      ) : null}
    </>
  );
}

