import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Minus, Package, Plus, Search, Sparkles, Trash2, UserPlus } from "lucide-react";
import { QuickAddCustomerDialog } from "@/components/sales/QuickAddCustomerDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
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

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
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

export function SalePad({
  mode,
  initial,
  onSaved,
}: {
  mode: "create" | "edit";
  initial?: BackendSalesOrder;
  onSaved: (order: BackendSalesOrder) => void;
}) {
  const [customerId, setCustomerId] = useState(initial?.customerId ?? "");
  const [customerSearch, setCustomerSearch] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [lines, setLines] = useState<DraftLine[]>(
    () =>
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
      })) ?? [],
  );
  const [extraCustomers, setExtraCustomers] = useState<BackendCustomer[]>([]);
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const debouncedCustomer = useDebouncedValue(customerSearch, 250);
  const debouncedItem = useDebouncedValue(itemSearch, 250);

  const customersQuery = useQuery({
    queryKey: ["customers", "sale-pad", debouncedCustomer],
    queryFn: () =>
      api.listCustomers({
        search: debouncedCustomer || undefined,
        status: "active",
        limit: 100,
        page: 1,
      }),
  });

  const inventoryQuery = useQuery({
    queryKey: ["inventory", "sale-pad", debouncedItem],
    queryFn: () =>
      api.listInventory({
        search: debouncedItem || undefined,
        limit: 100,
        page: 1,
      }),
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

  const totals = useMemo(() => {
    const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
    const discount = lines.reduce((sum, line) => sum + (line.discount || 0), 0);
    const tax = lines.reduce((sum, line) => sum + (lineNet(line) * (line.taxRate || 0)) / 100, 0);
    return { subtotal, discount, tax, total: subtotal - discount + tax };
  }, [lines]);

  const addInventory = (item: BackendInventoryItem) => {
    const existing = lines.find((line) => line.inventoryItemId === item.id);
    if (existing) {
      setLines((prev) =>
        prev.map((line) =>
          line.key === existing.key ? { ...line, quantity: line.quantity + 1 } : line,
        ),
      );
      return;
    }
    setLines((prev) => [
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
    ]);
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
  };

  const updateLine = (key: string, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
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
      onSaved(saved);
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to save sale" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50 via-card to-teal-50 p-4 shadow-sm dark:border-amber-900/40 dark:from-amber-950/30 dark:via-card dark:to-teal-950/20 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
              <Sparkles className="h-3.5 w-3.5" /> Sales counter
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">
              {mode === "edit" ? "Tweak this sale" : "Ring up a sale"}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Not a quotation — pick anyone, drop sold items, set the sale price.
            </p>
          </div>
          {selectedCustomer ? (
            <div className="rounded-full border border-amber-300/80 bg-white/80 px-3 py-1 text-sm font-medium dark:bg-background/70">
              Selling to {selectedCustomer.name}
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)]">
        <section className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Who’s buying?</h3>
            <Button size="sm" variant="outline" onClick={() => setAddCustomerOpen(true)}>
              <UserPlus className="h-4 w-4" /> Add customer
            </Button>
          </div>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              placeholder="Search every customer…"
            />
          </div>
          <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">
            {customersQuery.isLoading ? (
              <p className="col-span-full flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading customers…
              </p>
            ) : customers.length === 0 ? (
              <p className="col-span-full text-sm text-muted-foreground">
                No matches. Add a customer from this counter.
              </p>
            ) : (
              customers.map((customer: BackendCustomer) => {
                const active = customer.id === customerId;
                return (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => setCustomerId(customer.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition",
                      active
                        ? "border-amber-400 bg-amber-50 shadow-sm dark:bg-amber-950/40"
                        : "hover:border-amber-200 hover:bg-muted/40",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                        active ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {initials(customer.name)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{customer.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {customer.phone || customer.city || customer.type}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Tap stock to sell</h3>
            <Button size="sm" variant="ghost" onClick={addCustomItem}>
              <Plus className="h-4 w-4" /> Custom item
            </Button>
          </div>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              placeholder="Find a spare, accessory, or package…"
            />
          </div>
          <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">
            {inventoryQuery.isLoading ? (
              <p className="col-span-full flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading items…
              </p>
            ) : inventory.length === 0 ? (
              <p className="col-span-full text-sm text-muted-foreground">No stock matches. Add a custom sold item.</p>
            ) : (
              inventory.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => addInventory(item)}
                  className="rounded-xl border px-3 py-2 text-left transition hover:-translate-y-0.5 hover:border-teal-300 hover:bg-teal-50/60 dark:hover:bg-teal-950/30"
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{item.name}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">{item.sku}</span>
                    </span>
                    <Package className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                  </span>
                  <span className="mt-1 flex items-center justify-between text-xs">
                    <span className="font-semibold">{formatCurrency(sellingPrice(item))}</span>
                    <span className="text-muted-foreground">{availableStock(item)} in stock</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border bg-card p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Sold items</h3>
          <p className="text-xs text-muted-foreground">Edit qty and sale price on the fly</p>
        </div>
        {lines.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            Empty tray. Tap a product or add a custom item.
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {lines.map((line, index) => (
              <div
                key={line.key}
                className="grid gap-2 rounded-xl border bg-muted/20 p-3 sm:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,0.7fr))_auto] sm:items-end"
              >
                <div>
                  <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                    Item {index + 1}
                  </p>
                  <Input
                    value={line.description}
                    onChange={(e) => updateLine(line.key, { description: e.target.value })}
                    placeholder="What did they buy?"
                  />
                </div>
                <div>
                  <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Qty</p>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-9 w-9"
                      onClick={() =>
                        updateLine(line.key, { quantity: Math.max(1, Number(line.quantity) - 1) })
                      }
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <Input
                      className="text-center"
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) => updateLine(line.key, { quantity: Number(e.target.value) || 0 })}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-9 w-9"
                      onClick={() => updateLine(line.key, { quantity: Number(line.quantity) + 1 })}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Sale price</p>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.unitPrice}
                    onChange={(e) => updateLine(line.key, { unitPrice: Number(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Line</p>
                  <p className="flex h-9 items-center font-semibold">{formatCurrency(lineTotal(line))}</p>
                </div>
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

        <Textarea
          className="mt-4"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional note — serial numbers, delivery hint, anything the team should remember"
        />
      </section>

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-card/95 px-4 py-3 shadow-lg backdrop-blur dark:border-amber-900/50">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">This sale</p>
          <p className="text-xl font-semibold">{formatCurrency(totals.total)}</p>
        </div>
        <Button variant="brand" size="lg" disabled={saving} onClick={() => void save()}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {mode === "edit" ? "Save changes" : "Record sale"}
        </Button>
      </div>

      <QuickAddCustomerDialog
        open={addCustomerOpen}
        onOpenChange={setAddCustomerOpen}
        onCreated={(customer) => {
          setExtraCustomers((prev) => [customer, ...prev.filter((row) => row.id !== customer.id)]);
          setCustomerId(customer.id);
        }}
      />
    </div>
  );
}
