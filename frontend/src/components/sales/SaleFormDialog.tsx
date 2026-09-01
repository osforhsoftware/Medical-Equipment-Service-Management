import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Loader2, Minus, Plus, Trash2, UserPlus, X } from "lucide-react";
import { QuickAddCustomerDialog } from "@/components/sales/QuickAddCustomerDialog";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { api, type BackendCustomer, type BackendInventoryItem, type BackendSalesOrder } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type DraftLine = {
  key: string;
  inventoryItemId?: string | null;
  type: string;
  description: string;
  sku?: string | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
};

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sellingPrice(item: BackendInventoryItem) {
  return Number(item.sellingPrice ?? item.unitCost ?? 0);
}

function availableStock(item: BackendInventoryItem) {
  return item.available ?? Math.max(0, item.inStock - item.reserved);
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
      type: line.type,
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
  const [customerId, setCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [extraCustomers, setExtraCustomers] = useState<BackendCustomer[]>([]);
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCustomerId(initial?.customerId ?? "");
    setNotes(initial?.notes ?? "");
    setLines(linesFromOrder(initial));
    setCustomerSearch("");
    setItemSearch("");
    setCustomerOpen(false);
    setItemOpen(false);
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
    queryKey: ["inventory", "sale-form"],
    queryFn: () =>
      api.listInventory({
        limit: 200,
        page: 1,
      }),
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

  const inventory = inventoryQuery.data?.data ?? [];
  const selectedCustomer = customers.find((c) => c.id === customerId);
  const selectedInventoryIds = useMemo(
    () => new Set(lines.map((line) => line.inventoryItemId).filter(Boolean) as string[]),
    [lines],
  );

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

  const addCustomItem = () => {
    setLines((prev) => [
      ...prev,
      {
        key: newKey(),
        type: "other",
        description: "",
        sku: "",
        quantity: 1,
        unitPrice: 0,
        discount: 0,
        taxRate: 0,
      },
    ]);
    setItemOpen(false);
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
      toast({ title: "Add a sold item", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        customerId,
        notes: notes.trim() || null,
        lines: ready.map((line) => ({
          inventoryItemId: line.inventoryItemId ?? null,
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
      toast.success(mode === "edit" ? "Sale updated" : "Sale recorded", {
        description: `${saved.reference} · ${formatCurrency(saved.total)}`,
      });
      onOpenChange(false);
      onSaved(saved);
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to save sale" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={closeForm}>
        <DialogContent
          className="sm:max-w-2xl"
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
          <DialogHeader>
            <DialogTitle>{mode === "edit" ? "Edit sale" : "New sale"}</DialogTitle>
            <DialogDescription>
              Choose a customer, pick one or more items, then set quantity and sale price.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-1">
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <Label>
                  Customer
                  <RequiredMark />
                </Label>
                <Button type="button" size="sm" variant="ghost" onClick={() => setAddCustomerOpen(true)}>
                  <UserPlus className="h-4 w-4" />
                  Add customer
                </Button>
              </div>
              <Popover modal open={customerOpen} onOpenChange={setCustomerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={customerOpen}
                    className="h-10 w-full justify-between font-normal"
                  >
                    <span className="truncate">
                      {selectedCustomer
                        ? selectedCustomer.name
                        : customersQuery.isLoading
                          ? "Loading customers…"
                          : "Select customer"}
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
                      placeholder="Search customer…"
                      value={customerSearch}
                      onValueChange={setCustomerSearch}
                    />
                    <CommandList>
                      <CommandEmpty>
                        {customersQuery.isLoading ? "Loading…" : "No customer found."}
                      </CommandEmpty>
                      <CommandGroup>
                        {customers.map((customer) => (
                          <CommandItem
                            key={customer.id}
                            value={`${customer.name} ${customer.phone} ${customer.city} ${customer.type}`}
                            onSelect={() => {
                              setCustomerId(customer.id);
                              setCustomerOpen(false);
                              setCustomerSearch("");
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                customer.id === customerId ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate">{customer.name}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {customer.phone || customer.city || customer.type}
                              </span>
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <Label>
                  Items
                  <RequiredMark />
                </Label>
                <Button type="button" size="sm" variant="ghost" onClick={addCustomItem}>
                  <Plus className="h-4 w-4" />
                  Custom item
                </Button>
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
                    <span className="truncate">
                      {selectedInventoryIds.size
                        ? `${selectedInventoryIds.size} item${selectedInventoryIds.size === 1 ? "" : "s"} selected`
                        : inventoryQuery.isLoading
                          ? "Loading items…"
                          : "Select items"}
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
                      placeholder="Search spare, accessory, or package…"
                      value={itemSearch}
                      onValueChange={setItemSearch}
                    />
                    <CommandList>
                      <CommandEmpty>
                        {inventoryQuery.isLoading ? "Loading…" : "No stock matches."}
                      </CommandEmpty>
                      <CommandGroup>
                        {inventory.map((item) => {
                          const selected = selectedInventoryIds.has(item.id);
                          return (
                            <CommandItem
                              key={item.id}
                              value={`${item.name} ${item.sku ?? ""}`}
                              onSelect={() => toggleInventory(item)}
                            >
                              <Check className={cn("mr-2 h-4 w-4", selected ? "opacity-100" : "opacity-0")} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate">{item.name}</span>
                                <span className="block truncate font-mono text-[11px] text-muted-foreground">
                                  {item.sku}
                                </span>
                              </span>
                              <span className="ml-2 shrink-0 text-right text-xs">
                                <span className="block font-medium">{formatCurrency(sellingPrice(item))}</span>
                                <span className="text-muted-foreground">{availableStock(item)} in stock</span>
                              </span>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {lines.some((line) => line.inventoryItemId) ? (
                <div className="flex flex-wrap gap-1.5">
                  {lines
                    .filter((line) => line.inventoryItemId)
                    .map((line) => (
                      <Badge key={line.key} variant="secondary" className="gap-1 pr-1">
                        {line.description || "Item"}
                        <button
                          type="button"
                          className="rounded-sm p-0.5 hover:bg-muted"
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

            <div className="grid gap-2">
              <Label>Quantity & sale price</Label>
              {lines.length === 0 ? (
                <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                  Select items above, or add a custom item.
                </p>
              ) : (
                <div className="space-y-2">
                  {lines.map((line) => (
                    <div
                      key={line.key}
                      className="grid gap-2 rounded-lg border bg-muted/20 p-2.5 sm:grid-cols-[minmax(0,1fr)_auto_minmax(6.5rem,7.5rem)_auto_auto] sm:items-end"
                    >
                      <div className="grid gap-1">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Item</p>
                        <Input
                          value={line.description}
                          onChange={(e) => updateLine(line.key, { description: e.target.value })}
                          placeholder="Item name"
                        />
                      </div>
                      <div className="grid gap-1">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Qty</p>
                        <div className="flex w-[8.5rem] items-center gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-10 w-8 shrink-0"
                            onClick={() =>
                              updateLine(line.key, { quantity: Math.max(1, Number(line.quantity) - 1) })
                            }
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                          <Input
                            className="h-10 min-w-0 flex-1 px-1 text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            type="number"
                            min={1}
                            value={line.quantity}
                            onChange={(e) =>
                              updateLine(line.key, { quantity: Number(e.target.value) || 0 })
                            }
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-10 w-8 shrink-0"
                            onClick={() =>
                              updateLine(line.key, { quantity: Number(line.quantity) + 1 })
                            }
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid gap-1">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Sale price</p>
                        <Input
                          className="h-10 px-2 text-right tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          type="number"
                          min={0}
                          step="0.01"
                          value={line.unitPrice}
                          onChange={(e) =>
                            updateLine(line.key, { unitPrice: Number(e.target.value) || 0 })
                          }
                        />
                      </div>
                      <p className="flex h-10 items-center whitespace-nowrap text-sm font-semibold sm:justify-end">
                        {formatCurrency(lineTotal(line))}
                      </p>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => setLines((prev) => prev.filter((row) => row.key !== line.key))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="sale-notes">Notes</Label>
              <Textarea
                id="sale-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional — serial numbers, delivery hint, anything the team should remember"
              />
            </div>
          </div>

          <DialogFooter className="items-center gap-3 sm:justify-between">
            <div className="mr-auto text-left">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">This sale</p>
              <p className="text-lg font-semibold">{formatCurrency(totals.total)}</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => closeForm(false)}>
                Cancel
              </Button>
              <Button type="button" variant="brand" disabled={saving} onClick={() => void save()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {mode === "edit" ? "Save changes" : "Record sale"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuickAddCustomerDialog
        open={addCustomerOpen}
        onOpenChange={setAddCustomerOpen}
        onCreated={(customer) => {
          setExtraCustomers((prev) => [customer, ...prev.filter((row) => row.id !== customer.id)]);
          setCustomerId(customer.id);
        }}
      />
    </>
  );
}
