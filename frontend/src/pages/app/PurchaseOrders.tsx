import { useCallback, useEffect, useState } from "react";
import { Plus, ShoppingCart, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { ApiError } from "@/lib/api";
import { api, type BackendPurchaseOrder } from "@/lib/api";
import { defaultDatePlusDays, formatDate, formatCurrency } from "@/lib/format";
import { toast } from "@/hooks/use-toast";

export default function PurchaseOrders() {
  const [orders, setOrders] = useState<BackendPurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<BackendPurchaseOrder | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    supplier: "",
    items: "1",
    total: "",
    expectedDate: defaultDatePlusDays(7),
    status: "draft",
  });

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listPurchaseOrders();
      setOrders(data);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to load purchase orders";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const saveOrder = async () => {
    setSaving(true);
    try {
      await api.createPurchaseOrder({
        supplier: form.supplier.trim(),
        items: Number(form.items) || 1,
        total: Number(form.total) || 0,
        expectedDate: form.expectedDate,
        status: form.status,
      });
      toast({ title: "Purchase order created", description: "PO saved to the database." });
      setDialogOpen(false);
      setForm({ supplier: "", items: "1", total: "", expectedDate: defaultDatePlusDays(7), status: "draft" });
      await loadOrders();
    } catch (err) {
      const message = err instanceof ApiError ? err.errors?.join(", ") || err.message : "Unable to save PO";
      toast({ title: "Save failed", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<BackendPurchaseOrder>[] = [
    {
      key: "reference",
      header: "PO",
      render: (p) => (
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-primary" />
          <span className="font-mono text-sm font-medium">{p.reference}</span>
        </div>
      ),
    },
    { key: "supplier", header: "Supplier", render: (p) => <span className="text-sm">{p.supplier}</span> },
    { key: "items", header: "Items", render: (p) => <span className="font-medium">{p.items}</span> },
    { key: "total", header: "Total", render: (p) => <span className="font-semibold">{formatCurrency(p.total)}</span> },
    { key: "createdAt", header: "Created", render: (p) => <span className="text-sm text-muted-foreground">{formatDate(p.createdAt)}</span> },
    { key: "expectedDate", header: "Expected", render: (p) => <span className="text-sm text-muted-foreground">{formatDate(p.expectedDate)}</span> },
    { key: "status", header: "Status", render: (p) => <StatusBadge status={p.status} /> },
  ];

  return (
    <RoleGuard roles={["admin", "inventory"]}>
      <div className="space-y-6">
        <PageHeader
          title="Purchase Orders"
          description="Procurement of spare parts and consumables."
          actions={
            <Button onClick={() => setDialogOpen(true)} className="bg-gradient-primary text-primary-foreground hover:opacity-90">
              <Plus className="mr-1 h-4 w-4" /> New PO
            </Button>
          }
        />

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading purchase orders…
          </div>
        ) : (
          <DataTable
            data={orders}
            columns={columns}
            searchKeys={["reference", "supplier"]}
            searchPlaceholder="Search purchase orders…"
            emptyMessage="No purchase orders yet."
            filters={[
              {
                label: "Status",
                options: [
                  { label: "Draft", value: "draft" },
                  { label: "Sent", value: "sent" },
                  { label: "Received", value: "received" },
                  { label: "Partial", value: "partial" },
                  { label: "Cancelled", value: "cancelled" },
                ],
                predicate: (p, v) => p.status === v,
              },
            ]}
            onRowClick={setSelected}
          />
        )}

        <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
          <SheetContent className="sm:max-w-md">
            {selected && (
              <>
                <SheetHeader>
                  <div className="flex items-center gap-2">
                    <SheetTitle>{selected.reference}</SheetTitle>
                    <StatusBadge status={selected.status} />
                  </div>
                  <SheetDescription>{selected.supplier}</SheetDescription>
                </SheetHeader>
                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <Info label="Items" value={String(selected.items)} />
                  <Info label="Total" value={formatCurrency(selected.total)} />
                  <Info label="Expected" value={formatDate(selected.expectedDate)} />
                  <Info label="Created" value={formatDate(selected.createdAt)} />
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>New Purchase Order</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="supplier">Supplier</Label>
                <Input id="supplier" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="items">Line items</Label>
                  <Input id="items" type="number" min={1} value={form.items} onChange={(e) => setForm({ ...form, items: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="total">Total (₹)</Label>
                  <Input id="total" type="number" min={0} value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="expected">Expected date</Label>
                  <Input id="expected" type="date" value={form.expectedDate} onChange={(e) => setForm({ ...form, expectedDate: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["draft", "sent", "received", "partial", "cancelled"].map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={saveOrder} disabled={saving || !form.supplier.trim()}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create PO
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RoleGuard>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
