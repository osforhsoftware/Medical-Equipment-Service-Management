import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, PackageCheck, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { ApiError } from "@/lib/api";
import { useBranch } from "@/context/BranchContext";
import { api, type BackendBranch, type BackendInventoryItem } from "@/lib/api";
import { formatCurrency, formatCurrencyShort } from "@/lib/format";
import { AlertTriangle, Boxes, Lock } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const CATEGORIES = ["Modules", "Sensors", "Consumables", "Boards", "Tools", "Other"];

export default function Inventory() {
  const { branchId } = useBranch();
  const [items, setItems] = useState<BackendInventoryItem[]>([]);
  const [branches, setBranches] = useState<BackendBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<BackendInventoryItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    sku: "",
    name: "",
    category: "Modules",
    branchId: "",
    inStock: "0",
    reserved: "0",
    reorderLevel: "5",
    unitCost: "0",
    supplier: "",
  });

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listInventory(branchId);
      setItems(data);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to load inventory";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    void api.listBranches().then(setBranches).catch(() => setBranches([]));
  }, []);

  const lowStock = items.filter((i) => i.inStock <= i.reorderLevel).length;
  const reserved = items.reduce((s, i) => s + i.reserved, 0);
  const totalValue = items.reduce((s, i) => s + i.inStock * Number(i.unitCost), 0);

  const categoryOptions = useMemo(() => {
    const fromData = [...new Set(items.map((i) => i.category))];
    return [...new Set([...CATEGORIES, ...fromData])].map((c) => ({ label: c, value: c }));
  }, [items]);

  const openCreate = () => {
    setForm({
      sku: "",
      name: "",
      category: "Modules",
      branchId: branchId !== "all" ? branchId : branches[0]?.id ?? "",
      inStock: "0",
      reserved: "0",
      reorderLevel: "5",
      unitCost: "0",
      supplier: "",
    });
    setDialogOpen(true);
  };

  const saveItem = async () => {
    setSaving(true);
    try {
      await api.createInventoryItem({
        sku: form.sku.trim(),
        name: form.name.trim(),
        category: form.category,
        branchId: form.branchId,
        inStock: Number(form.inStock) || 0,
        reserved: Number(form.reserved) || 0,
        reorderLevel: Number(form.reorderLevel) || 0,
        unitCost: Number(form.unitCost) || 0,
        supplier: form.supplier.trim(),
      });
      toast({ title: "Item added", description: `${form.name.trim()} was saved to inventory.` });
      setDialogOpen(false);
      await loadItems();
    } catch (err) {
      const message = err instanceof ApiError ? err.errors?.join(", ") || err.message : "Unable to save item";
      toast({ title: "Save failed", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<BackendInventoryItem>[] = [
    {
      key: "name",
      header: "Item",
      render: (i) => (
        <div>
          <p className="font-medium">{i.name}</p>
          <p className="font-mono text-xs text-muted-foreground">{i.sku} · {i.category}</p>
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
    { key: "reorderLevel", header: "Reorder At", render: (i) => <span className="text-sm text-muted-foreground">{i.reorderLevel}</span> },
    { key: "unitCost", header: "Unit Cost", render: (i) => <span className="text-sm">{formatCurrency(i.unitCost)}</span> },
    { key: "supplier", header: "Supplier", render: (i) => <span className="text-sm text-muted-foreground">{i.supplier}</span> },
  ];

  return (
    <RoleGuard roles={["admin", "inventory", "engineer"]}>
      <div className="space-y-6">
        <PageHeader
          title="Inventory"
          description="Spare parts with reservation system — reserve before deduct."
          actions={
            <Button onClick={openCreate} disabled={branches.length === 0} variant="brand">
              <Plus className="mr-1 h-4 w-4" /> Add Item
            </Button>
          }
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="SKUs in Branch" value={String(items.length)} icon={Boxes} accent="primary" />
          <StatCard label="Reserved Units" value={String(reserved)} icon={Lock} accent="accent" />
          <StatCard label="Stock Value" value={formatCurrencyShort(totalValue)} icon={PackageCheck} accent="success" />
        </div>
        {lowStock > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning-foreground">
            <AlertTriangle className="h-4 w-4" /> {lowStock} item(s) at or below reorder level — create purchase orders to replenish.
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading inventory…
          </div>
        ) : (
          <DataTable
            data={items}
            columns={columns}
            searchKeys={["name", "sku", "category", "supplier"]}
            searchPlaceholder="Search parts…"
            emptyMessage="No inventory items yet. Add your first spare part."
            filters={[{ label: "Category", options: categoryOptions, predicate: (i, v) => i.category === v }]}
            onRowClick={setSelected}
          />
        )}

        <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
          <SheetContent className="sm:max-w-md">
            {selected && (
              <>
                <SheetHeader>
                  <SheetTitle>{selected.name}</SheetTitle>
                  <SheetDescription>{selected.sku} · {selected.category}</SheetDescription>
                </SheetHeader>
                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <Info label="In stock" value={String(selected.inStock)} />
                  <Info label="Reserved" value={String(selected.reserved)} />
                  <Info label="Reorder at" value={String(selected.reorderLevel)} />
                  <Info label="Unit cost" value={formatCurrency(selected.unitCost)} />
                  <Info label="Supplier" value={selected.supplier} />
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>Add Inventory Item</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="sku">SKU</Label>
                  <Input id="sku" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="font-mono" />
                </div>
                <div className="grid gap-2">
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="item-name">Name</Label>
                <Input id="item-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Branch</Label>
                <Select value={form.branchId} onValueChange={(v) => setForm({ ...form, branchId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="in-stock">In stock</Label>
                  <Input id="in-stock" type="number" min={0} value={form.inStock} onChange={(e) => setForm({ ...form, inStock: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="reorder">Reorder at</Label>
                  <Input id="reorder" type="number" min={0} value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cost">Unit cost</Label>
                  <Input id="cost" type="number" min={0} value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="supplier">Supplier</Label>
                <Input id="supplier" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={saveItem} disabled={saving || !form.branchId || !form.sku.trim() || !form.name.trim()}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save item
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
