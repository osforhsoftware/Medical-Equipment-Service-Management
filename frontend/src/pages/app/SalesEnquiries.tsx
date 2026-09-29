import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileQuestion,
  Plus,
  Search,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  Minus,
  Package,
  Trash2,
  User,
  UserPlus,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { RequiredMark } from "@/components/shared/RequiredMark";
import { QuickAddCustomerDialog } from "@/components/sales/QuickAddCustomerDialog";
import { ActivityHistoryTabs, isInActivity, SalesPipelineTabs } from "@/components/sales/SalesPipelineTabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { CUSTOMER_WRITE_ROLES } from "@/config/roles";
import { inventoryOriginUnitPrice } from "@/components/shared/InventoryHelpers";
import { ProductThumb, productImageFileId } from "@/components/shared/ProductThumb";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { api, ApiError, type BackendCustomer, type BackendInventoryItem } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export type EnquiryStatus = "open" | "quoted" | "converted" | "lost";

export interface EnquiryInterestLine {
  source: "inventory" | "custom";
  inventoryItemId?: string | null;
  description: string;
  sku?: string | null;
  quantity: number;
  unitPrice: number;
}

export interface SalesEnquiry {
  id: string;
  reference: string;
  customerName: string;
  contactPerson: string;
  phone: string;
  email: string;
  productInterest: string;
  interestLines?: EnquiryInterestLine[] | null;
  quantity: number;
  estimatedBudget: string | number | null;
  source: string;
  priority: "low" | "medium" | "high";
  status: EnquiryStatus;
  notes: string;
  assignedTo: string;
  followUpDate: string | null;
  convertedEstimateId?: string | null;
  createdAt: string;
  updatedAt?: string;
}

// ── Status helpers ────────────────────────────────────────────────────────────

function statusBadge(status: EnquiryStatus) {
  switch (status) {
    case "open":
      return <Badge variant="outline" className="gap-1 border-blue-400 text-blue-600"><Clock className="h-3 w-3" />Open</Badge>;
    case "quoted":
      return <Badge variant="outline" className="gap-1 border-amber-400 text-amber-600"><FileQuestion className="h-3 w-3" />Quoted</Badge>;
    case "converted":
      return <Badge className="gap-1 bg-green-600"><CheckCircle2 className="h-3 w-3" />Converted</Badge>;
    case "lost":
      return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Lost</Badge>;
  }
}

type InterestDraft = EnquiryInterestLine & { key: string; saleRate?: number };

function inventorySalePrice(item: BackendInventoryItem) {
  const selling = Number(item.sellingPrice);
  if (Number.isFinite(selling) && selling > 0) return selling;
  return inventoryOriginUnitPrice(item);
}

function newLineKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function linesFromEnquiry(existing?: SalesEnquiry | null): InterestDraft[] {
  const stored = Array.isArray(existing?.interestLines) ? existing.interestLines : [];
  if (stored.length) {
    return stored.map((line) => ({
      key: newLineKey(),
      source: line.source === "inventory" ? "inventory" : "custom",
      inventoryItemId: line.inventoryItemId ?? null,
      description: line.description || "",
      sku: line.sku ?? null,
      quantity: Number(line.quantity) > 0 ? Number(line.quantity) : 1,
      unitPrice: Number(line.unitPrice) >= 0 ? Number(line.unitPrice) : 0,
    }));
  }
  if (!existing?.productInterest?.trim()) return [];
  const quantity = Number(existing.quantity) > 0 ? Number(existing.quantity) : 1;
  const budget = Number(existing.estimatedBudget) || 0;
  return [
    {
      key: newLineKey(),
      source: "custom",
      inventoryItemId: null,
      description: existing.productInterest.trim(),
      sku: null,
      quantity,
      unitPrice: budget > 0 ? budget / quantity : 0,
    },
  ];
}

function lineAmount(line: InterestDraft) {
  return Math.max(0, Number(line.quantity) || 0) * Math.max(0, Number(line.unitPrice) || 0);
}

// ── Create / Edit Form ────────────────────────────────────────────────────────

interface EnquiryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing?: SalesEnquiry | null;
  onSuccess: () => void;
}

const BLANK = {
  customerName: "",
  contactPerson: "",
  phone: "",
  email: "",
  productInterest: "",
  quantity: 1,
  estimatedBudget: "",
  source: "walk-in",
  priority: "medium" as "low" | "medium" | "high",
  status: "open" as EnquiryStatus,
  notes: "",
  assignedTo: "",
  followUpDate: "",
};

function EnquiryFormDialog({ open, onOpenChange, existing, onSuccess }: EnquiryFormDialogProps) {
  const { hasRole } = useAuth();
  const canAddClient = hasRole(CUSTOMER_WRITE_ROLES);
  const [form, setForm] = useState(
    existing
      ? {
          customerName: existing.customerName || "",
          contactPerson: existing.contactPerson || "",
          phone: existing.phone || "",
          email: existing.email || "",
          productInterest: existing.productInterest || "",
          quantity: Number(existing.quantity) || 1,
          estimatedBudget: existing.estimatedBudget ? String(existing.estimatedBudget) : "",
          source: existing.source || "walk-in",
          priority: existing.priority || "medium",
          status: existing.status || "open",
          notes: existing.notes || "",
          assignedTo: existing.assignedTo || "",
          followUpDate: existing.followUpDate ? existing.followUpDate.slice(0, 10) : "",
        }
      : { ...BLANK },
  );
  const [lines, setLines] = useState<InterestDraft[]>(() => linesFromEnquiry(existing));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);
  const [itemSearch, setItemSearch] = useState("");
  const [customName, setCustomName] = useState("");
  const [customQty, setCustomQty] = useState(1);
  const [customPrice, setCustomPrice] = useState("");
  const debouncedItemSearch = useDebouncedValue(itemSearch);
  const [customerId, setCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [extraClients, setExtraClients] = useState<BackendCustomer[]>([]);
  const [addClientSeed, setAddClientSeed] = useState("");

  const openAddClient = (seed = customerSearch) => {
    setAddClientSeed(seed.trim());
    setCustomerOpen(false);
    setAddClientOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    setCustomerId("");
    setCustomerSearch("");
    setCustomerOpen(false);
    setExtraClients([]);
  }, [open, existing?.id]);

  const inventoryQuery = useQuery({
    queryKey: ["inventory", "sales-enquiry", debouncedItemSearch],
    queryFn: () =>
      api.listInventory({
        status: "active",
        limit: 50,
        page: 1,
        search: debouncedItemSearch || undefined,
        sortBy: "name",
        sortOrder: "asc",
      }),
    enabled: open,
  });

  const selectedInventoryIds = useMemo(
    () => new Set(lines.map((line) => line.inventoryItemId).filter(Boolean) as string[]),
    [lines],
  );
  const interestTotal = useMemo(() => lines.reduce((sum, line) => sum + lineAmount(line), 0), [lines]);

  const addInventoryLine = (item: BackendInventoryItem) => {
    const saleRate = inventorySalePrice(item);
    setLines((prev) => {
      if (prev.some((line) => line.inventoryItemId === item.id)) return prev;
      return [
        ...prev,
        {
          key: newLineKey(),
          source: "inventory",
          inventoryItemId: item.id,
          description: item.name,
          sku: item.sku,
          quantity: 1,
          unitPrice: saleRate,
          saleRate,
        },
      ];
    });
    setErrors((prev) => {
      if (!prev.interestLines) return prev;
      const next = { ...prev };
      delete next.interestLines;
      return next;
    });
  };

  const addCustomLine = () => {
    const description = customName.trim();
    if (!description) {
      setErrors((prev) => ({ ...prev, customName: "Enter a product name" }));
      return;
    }
    setLines((prev) => [
      ...prev,
      {
        key: newLineKey(),
        source: "custom",
        inventoryItemId: null,
        description,
        sku: null,
        quantity: Math.max(1, Number(customQty) || 1),
        unitPrice: Math.max(0, Number(customPrice) || 0),
      },
    ]);
    setCustomName("");
    setCustomQty(1);
    setCustomPrice("");
    setErrors((prev) => {
      const next = { ...prev };
      delete next.customName;
      delete next.interestLines;
      return next;
    });
  };

  const updateLine = (key: string, patch: Partial<InterestDraft>) => {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

  const clientsQuery = useQuery({
    queryKey: ["customers", "sales-enquiry-form"],
    queryFn: () =>
      api.listCustomers({
        status: "active",
        limit: 200,
        page: 1,
      }),
    enabled: open,
  });

  const clients = useMemo(() => {
    const rows = [...(clientsQuery.data?.data ?? [])];
    for (const extra of extraClients) {
      if (!rows.some((row) => row.id === extra.id)) rows.unshift(extra);
    }
    return rows;
  }, [clientsQuery.data?.data, extraClients]);

  const selectedClient = useMemo(() => {
    if (customerId) return clients.find((c) => c.id === customerId) ?? null;
    if (!form.customerName.trim()) return null;
    return clients.find((c) => c.name.toLowerCase() === form.customerName.trim().toLowerCase()) ?? null;
  }, [clients, customerId, form.customerName]);

  useEffect(() => {
    if (!open || customerId || !existing?.customerName || !clients.length) return;
    const match = clients.find(
      (c) => c.name.toLowerCase() === existing.customerName.trim().toLowerCase(),
    );
    if (match) setCustomerId(match.id);
  }, [open, existing?.customerName, clients, customerId]);

  const applyClient = (client: BackendCustomer) => {
    setCustomerId(client.id);
    setForm((p) => ({
      ...p,
      customerName: client.name || "",
      contactPerson: client.contactPerson || p.contactPerson,
      phone: client.phone || p.phone,
      email: client.email || p.email,
    }));
    setErrors((prev) => {
      if (!prev.customerName) return prev;
      const next = { ...prev };
      delete next.customerName;
      return next;
    });
  };

  const set =
    (field: keyof typeof BLANK) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.customerName.trim()) errs.customerName = "Client required";
    const ready = lines.filter((line) => line.description.trim() && Number(line.quantity) > 0);
    if (!ready.length) errs.interestLines = "Add at least one inventory or custom product";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const ready = lines.filter((line) => line.description.trim() && Number(line.quantity) > 0);
      const payload = {
        customerName: form.customerName,
        contactPerson: form.contactPerson,
        phone: form.phone,
        email: form.email,
        source: form.source,
        priority: form.priority,
        status: form.status,
        notes: form.notes,
        assignedTo: form.assignedTo,
        followUpDate: form.followUpDate,
        interestLines: ready.map((line) => ({
          source: line.source,
          inventoryItemId: line.source === "inventory" ? line.inventoryItemId : null,
          description: line.description.trim(),
          sku: line.sku ?? null,
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice) || 0,
        })),
      };
      if (existing) {
        await api.put(`/sales-enquiries/${existing.id}`, payload);
        toast.success("Enquiry updated");
      } else {
        await api.post("/sales-enquiries", payload);
        toast.success("Enquiry created");
      }
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      toast.apiError(err, { fallback: "Failed to save enquiry" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && addClientOpen) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="sm:max-w-2xl max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => {
          if (addClientOpen || (e.target as HTMLElement | null)?.closest?.("[data-radix-popper-content-wrapper]")) {
            e.preventDefault();
          }
        }}
        onPointerDownOutside={(e) => {
          if (addClientOpen || (e.target as HTMLElement | null)?.closest?.("[data-radix-popper-content-wrapper]")) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileQuestion className="h-5 w-5 text-primary" />
            {existing ? "Edit Sales Enquiry" : "New Sales Enquiry"}
          </DialogTitle>
          <DialogDescription>
            Record a new inbound sales lead or enquiry from a prospective client.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label className={cn(errors.customerName ? "text-destructive" : "")}>
              Client <RequiredMark />
            </Label>
            <Popover modal open={customerOpen} onOpenChange={setCustomerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={customerOpen}
                  className={cn(
                    "h-10 w-full justify-between font-normal",
                    errors.customerName ? "border-destructive" : "",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2 truncate">
                    <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                    {selectedClient ? (
                      <span className="truncate font-medium text-foreground">{selectedClient.name}</span>
                    ) : form.customerName ? (
                      <span className="truncate font-medium text-foreground">{form.customerName}</span>
                    ) : clientsQuery.isLoading ? (
                      <span className="text-muted-foreground">Loading clients…</span>
                    ) : (
                      <span className="text-muted-foreground">Select or add a client…</span>
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
                    placeholder="Search client by name, phone or reference…"
                    value={customerSearch}
                    onValueChange={setCustomerSearch}
                  />
                  <CommandList className="max-h-60">
                    <CommandEmpty>
                      {clientsQuery.isLoading ? (
                        "Loading clients…"
                      ) : canAddClient ? (
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-2 py-2.5 text-sm text-primary hover:bg-accent"
                          onClick={() => openAddClient()}
                        >
                          <UserPlus className="h-4 w-4 shrink-0" />
                          + Add new customer
                          {customerSearch.trim() ? (
                            <span className="truncate text-muted-foreground">“{customerSearch.trim()}”</span>
                          ) : null}
                        </button>
                      ) : (
                        "No client found."
                      )}
                    </CommandEmpty>
                    {canAddClient ? (
                      <>
                        <CommandGroup>
                          <CommandItem
                            value="__add_new_customer__ add new customer"
                            onSelect={() => openAddClient()}
                            className="py-2.5 text-primary"
                          >
                            <UserPlus className="mr-2 h-4 w-4 shrink-0" />
                            <span className="font-medium">+ Add new customer</span>
                          </CommandItem>
                        </CommandGroup>
                        <CommandSeparator />
                      </>
                    ) : null}
                    <CommandGroup heading={clients.length ? "Select customer" : undefined}>
                      {clients.map((client) => (
                        <CommandItem
                          key={client.id}
                          value={`${client.reference} ${client.name} ${client.phone} ${client.city} ${client.type}`}
                          onSelect={() => {
                            applyClient(client);
                            setCustomerOpen(false);
                            setCustomerSearch("");
                          }}
                          className="py-2.5"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4 shrink-0",
                              client.id === (selectedClient?.id ?? customerId) ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate font-medium">{client.name}</span>
                              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                                {client.reference}
                              </span>
                            </div>
                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                              {client.phone || client.city || client.type || "Client"}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">Select an existing customer, or add a new one.</p>
            {errors.customerName && <p className="text-xs text-destructive">{errors.customerName}</p>}
          </div>

          <div className="space-y-1">
            <Label>Contact Person</Label>
            <Input value={form.contactPerson} onChange={set("contactPerson")} placeholder="Dr. John / Purchase Manager" />
          </div>

          <div className="space-y-1">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={set("phone")} placeholder="+91 98765 43210" />
          </div>

          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={set("email")} placeholder="purchase@hospital.com" />
          </div>

          <div className="sm:col-span-2 space-y-3">
            <div>
              <Label className={errors.interestLines ? "text-destructive" : ""}>
                Product / Service Interest <span className="text-destructive">*</span>
              </Label>
              <p className="text-xs text-muted-foreground">
                Select one or more inventory products, and add custom products that are not in stock yet. Quantity and expected price are set on each line.
              </p>
            </div>

            <Popover modal open={itemOpen} onOpenChange={setItemOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={itemOpen}
                  className="h-10 w-full justify-between font-normal"
                >
                  <span className="flex min-w-0 items-center gap-2 truncate">
                    <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                    {selectedInventoryIds.size > 0 ? (
                      <span className="truncate font-medium text-foreground">
                        {selectedInventoryIds.size} inventory product{selectedInventoryIds.size === 1 ? "" : "s"} selected
                      </span>
                    ) : inventoryQuery.isLoading ? (
                      <span className="text-muted-foreground">Loading inventory…</span>
                    ) : (
                      <span className="text-muted-foreground">Select inventory products…</span>
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
                    placeholder="Search by name or SKU…"
                    value={itemSearch}
                    onValueChange={setItemSearch}
                  />
                  <CommandList className="max-h-60">
                    <CommandEmpty>
                      {inventoryQuery.isLoading ? "Searching inventory…" : "No matching inventory products."}
                    </CommandEmpty>
                    <CommandGroup heading="Inventory products">
                      {(inventoryQuery.data?.data ?? []).map((item) => {
                        const selected = selectedInventoryIds.has(item.id);
                        const stock = item.available ?? Math.max(0, item.inStock - item.reserved);
                        return (
                          <CommandItem
                            key={item.id}
                            value={`${item.name} ${item.sku}`}
                            onSelect={() => {
                              if (selected) {
                                setLines((prev) => prev.filter((line) => line.inventoryItemId !== item.id));
                                return;
                              }
                              addInventoryLine(item);
                            }}
                            className="py-2.5"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4 shrink-0",
                                selected ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <ProductThumb fileId={productImageFileId(item)} name={item.name} size="sm" className="mr-2" />
                            <div className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{item.name}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {item.sku} · {stock > 0 ? `${stock} in stock` : "Out of stock"}
                              </span>
                            </div>
                            <span className="ml-2 shrink-0 text-sm font-medium">
                              {formatCurrency(inventoryOriginUnitPrice(item))}
                            </span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <div className="grid gap-2 rounded-lg border bg-muted/30 p-3 sm:grid-cols-[1fr_5rem_7rem_auto] sm:items-end">
              <div className="space-y-1">
                <Label className={errors.customName ? "text-destructive" : ""}>Custom product</Label>
                <Input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Name not in inventory"
                  className={errors.customName ? "border-destructive" : ""}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomLine();
                    }
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label>Qty</Label>
                <Input
                  type="number"
                  min={1}
                  value={customQty}
                  onChange={(e) => setCustomQty(Math.max(1, Number(e.target.value) || 1))}
                />
              </div>
              <div className="space-y-1">
                <Label>Price</Label>
                <Input
                  type="number"
                  min={0}
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  placeholder="0"
                />
              </div>
              <Button type="button" variant="outline" onClick={addCustomLine} className="gap-1">
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
            {errors.customName ? <p className="text-xs text-destructive">{errors.customName}</p> : null}

            {lines.length === 0 ? (
              <p className={cn("text-xs", errors.interestLines ? "text-destructive" : "text-muted-foreground")}>
                {errors.interestLines || "No products added yet."}
              </p>
            ) : (
              <div className="space-y-2">
                {lines.map((line) => {
                  const belowSaleRate =
                    line.source === "inventory" &&
                    Number(line.saleRate) > 0 &&
                    Number(line.unitPrice) < Number(line.saleRate);
                  return (
                  <div key={line.key} className="space-y-2 rounded-lg border p-3">
                  <div className="grid gap-2 sm:grid-cols-[1fr_5.5rem_7rem_auto] sm:items-center">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                            line.source === "inventory"
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                              : "bg-sky-500/10 text-sky-700 dark:text-sky-300",
                          )}
                        >
                          {line.source === "inventory" ? "Inventory" : "Custom"}
                        </span>
                        {line.sku ? (
                          <span className="truncate font-mono text-[11px] text-muted-foreground">{line.sku}</span>
                        ) : null}
                      </div>
                      {line.source === "custom" ? (
                        <Input
                          className="mt-1 h-8"
                          value={line.description}
                          onChange={(e) => updateLine(line.key, { description: e.target.value })}
                        />
                      ) : (
                        <div className="mt-1 flex min-w-0 items-center gap-2">
                          <ProductThumb
                            fileId={productImageFileId(
                              (inventoryQuery.data?.data ?? []).find((item) => item.id === line.inventoryItemId),
                            )}
                            name={line.description}
                            size="xs"
                          />
                          <p className="truncate text-sm font-medium">{line.description}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-8 w-7"
                        onClick={() => updateLine(line.key, { quantity: Math.max(1, Number(line.quantity) - 1) })}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Input
                        className="h-8 px-1 text-center"
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) => updateLine(line.key, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-8 w-7"
                        onClick={() => updateLine(line.key, { quantity: Number(line.quantity) + 1 })}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Sale price</span>
                      <Input
                        className={cn("h-8", belowSaleRate ? "border-amber-500" : "")}
                        type="number"
                        min={0}
                        value={line.unitPrice}
                        onChange={(e) => updateLine(line.key, { unitPrice: Math.max(0, Number(e.target.value) || 0) })}
                      />
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => setLines((prev) => prev.filter((row) => row.key !== line.key))}
                      aria-label={`Remove ${line.description}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {belowSaleRate ? (
                    <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        Below sale rate. Item sale price is {formatCurrency(line.saleRate)}. This price is under the selling price.
                      </span>
                    </p>
                  ) : null}
                  </div>
                  );
                })}
                <p className="text-right text-sm text-muted-foreground">
                  Expected total <span className="font-medium text-foreground">{formatCurrency(interestTotal)}</span>
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label>Lead Source</Label>
            <Select value={form.source} onValueChange={(v) => setForm((p) => ({ ...p, source: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["walk-in", "phone", "email", "whatsapp", "referral", "website", "trade-show", "other"].map((s) => (
                  <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Priority</Label>
            <Select
              value={form.priority}
              onValueChange={(v) => setForm((p) => ({ ...p, priority: v as typeof form.priority }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Assigned To (Sales Rep)</Label>
            <Input value={form.assignedTo} onChange={set("assignedTo")} placeholder="Sales rep name" />
          </div>

          <div className="space-y-1">
            <Label>Follow-up Date</Label>
            <Input type="date" value={form.followUpDate} onChange={set("followUpDate")} />
          </div>

          <div className="space-y-1">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => setForm((p) => ({ ...p, status: v as EnquiryStatus }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="quoted">Quoted</SelectItem>
                <SelectItem value="converted">Converted to Order</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-2 space-y-1">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={set("notes")} rows={2} placeholder="Any additional context..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {existing ? "Update Enquiry" : "Create Enquiry"}
          </Button>
        </DialogFooter>
      </DialogContent>

      {canAddClient ? (
        <QuickAddCustomerDialog
          open={addClientOpen}
          onOpenChange={(next) => {
            setAddClientOpen(next);
            if (!next) setAddClientSeed("");
          }}
          initialName={addClientSeed}
          onCreated={(client) => {
            setExtraClients((prev) => [client, ...prev.filter((row) => row.id !== client.id)]);
            applyClient(client);
            setCustomerSearch("");
            setAddClientSeed("");
          }}
        />
      ) : null}
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SalesEnquiries() {
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canCreate = hasRole(["admin", "sales", "coordinator"]);
  const [searchParams, setSearchParams] = useSearchParams();
  const board = searchParams.get("board") === "history" ? "history" : "activity";
  const [search, setSearch] = useState("");
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<EnquiryStatus | "all">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SalesEnquiry | null>(null);

  const { data: enquiries = [], isLoading, isError, error, refetch: refetchQuery } = useQuery<SalesEnquiry[]>({
    queryKey: ["sales-enquiries"],
    queryFn: async () => {
      const res = await api.get<SalesEnquiry[]>("/sales-enquiries");
      return res.data;
    },
  });

  const boardEnquiries =
    board === "history"
      ? enquiries
      : enquiries.filter((enquiry) =>
          isInActivity(enquiry.status, enquiry.updatedAt || enquiry.createdAt, ["converted", "lost"]),
        );

  const filtered = boardEnquiries.filter((e) => {
    const matchSearch =
      !search ||
      e.customerName.toLowerCase().includes(search.toLowerCase()) ||
      e.productInterest.toLowerCase().includes(search.toLowerCase()) ||
      e.reference.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || e.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    open: boardEnquiries.filter((e) => e.status === "open").length,
    quoted: boardEnquiries.filter((e) => e.status === "quoted").length,
    converted: boardEnquiries.filter((e) => e.status === "converted").length,
    lost: boardEnquiries.filter((e) => e.status === "lost").length,
  };

  const refetch = () => queryClient.invalidateQueries({ queryKey: ["sales-enquiries"] });

  const convertToQuotation = async (enq: SalesEnquiry) => {
    if (enq.convertedEstimateId) {
      navigate(`/app/sales/quotations/${enq.convertedEstimateId}`);
      return;
    }
    setConvertingId(enq.id);
    try {
      const estimate = await api.convertSalesEnquiryToQuotation(enq.id);
      toast({ title: "Sales quotation created", description: estimate.reference });
      await refetch();
      navigate(`/app/sales/quotations/${estimate.id}`);
    } catch (err) {
      toast.apiError(err, { fallback: "Could not create quotation" });
    } finally {
      setConvertingId(null);
    }
  };

  return (
    <RoleGuard roles={["admin", "sales", "coordinator", "billing"]}>
      <div className="space-y-5">
        <PageHeader
          title="Enquiry"
          subtitle="Enquiry activity is current work. History lists every lead, converted and unconverted."
          icon={<FileQuestion className="h-6 w-6" />}
          actions={
            canCreate ? (
              <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
                <Plus className="mr-1.5 h-4 w-4" />
                New Enquiry
              </Button>
            ) : undefined
          }
        />

        <div className="flex flex-wrap items-center gap-2">
          <SalesPipelineTabs current="enquiry" />
          <ActivityHistoryTabs
            value={board}
            activityLabel="Enquiry activity"
            onChange={(next) => {
              const params = new URLSearchParams(searchParams);
              if (next === "activity") params.delete("board");
              else params.set("board", "history");
              setSearchParams(params, { replace: true });
              setStatusFilter("all");
            }}
          />
        </div>

        <p className="text-sm text-muted-foreground">
          {board === "history"
            ? "Every enquiry is listed here, converted and unconverted."
            : "Open and quoted leads, plus sales converted in the last 2 days."}
        </p>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Open", count: stats.open, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30" },
            { label: "Quoted", count: stats.quoted, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30" },
            { label: "Converted", count: stats.converted, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/30" },
            { label: "Lost", count: stats.lost, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/30" },
          ].map((s) => (
            <Card
              key={s.label}
              className={`cursor-pointer border-border transition-all hover:shadow-sm ${s.bg}`}
              onClick={() => setStatusFilter(s.label.toLowerCase() as EnquiryStatus)}
            >
              <CardContent className="pt-4 pb-3">
                <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.count}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by customer, product, reference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="quoted">Quoted</SelectItem>
              <SelectItem value="converted">Converted</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <p className="text-sm font-medium text-destructive">
                {error instanceof ApiError ? error.message : "Unable to load sales enquiries"}
              </p>
              <Button variant="outline" size="sm" onClick={() => void refetchQuery()}>
                Try again
              </Button>
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <FileQuestion className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="font-medium text-muted-foreground">
                {board === "history" ? "No history yet" : "No enquiry activity"}
              </p>
              {canCreate && (
                <Button className="mt-4" onClick={() => { setEditing(null); setFormOpen(true); }}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Create first enquiry
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((enq) => (
              <Card
                key={enq.id}
                className="cursor-pointer transition-all hover:shadow-sm hover:border-primary/40"
                onClick={() => { setEditing(enq); setFormOpen(true); }}
              >
                <CardContent className="py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{enq.reference}</span>
                        {statusBadge(enq.status)}
                        <Badge
                          variant="outline"
                          className={
                            enq.priority === "high"
                              ? "border-red-400 text-red-600"
                              : enq.priority === "medium"
                                ? "border-amber-400 text-amber-600"
                                : "border-muted-foreground text-muted-foreground"
                          }
                        >
                          {enq.priority}
                        </Badge>
                      </div>
                      <p className="mt-1 font-semibold">{enq.customerName}</p>
                      <p className="text-sm text-muted-foreground truncate">{enq.productInterest}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-4 text-xs text-muted-foreground">
                      <div className="text-right">
                        {enq.followUpDate && (
                          <p>
                            Follow-up: <span className="font-medium">{formatDate(enq.followUpDate)}</span>
                          </p>
                        )}
                        <p>Created: {formatDate(enq.createdAt)}</p>
                      </div>
                      {canCreate && enq.status !== "lost" ? (
                        <Button
                          size="sm"
                          variant={enq.convertedEstimateId ? "outline" : "default"}
                          disabled={convertingId === enq.id}
                          onClick={(ev) => { ev.stopPropagation(); void convertToQuotation(enq); }}
                        >
                          {convertingId === enq.id ? (
                            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                          ) : null}
                          {enq.convertedEstimateId ? "View quote" : "Create quotation"}
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1"
                        onClick={(ev) => { ev.stopPropagation(); setEditing(enq); setFormOpen(true); }}
                      >
                        Edit <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {formOpen && (
          <EnquiryFormDialog
            key={editing?.id ?? "new"}
            open={formOpen}
            onOpenChange={setFormOpen}
            existing={editing}
            onSuccess={refetch}
          />
        )}
      </div>
    </RoleGuard>
  );
}
