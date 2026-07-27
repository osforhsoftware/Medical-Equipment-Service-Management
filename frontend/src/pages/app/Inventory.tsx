import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, PackageCheck, Loader2, AlertTriangle, Boxes, Lock } from "lucide-react";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { ApiError, api, type BackendBranch, type BackendInventoryItem } from "@/lib/api";
import { useBranch } from "@/context/BranchContext";
import { useAuth } from "@/context/AuthContext";
import { formatCurrency, formatCurrencyShort } from "@/lib/format";
import { toast } from "@/hooks/use-toast";

const CATEGORIES = ["Modules", "Sensors", "Consumables", "Boards", "Tools", "Other"];
const UOM = ["pcs", "box", "meter", "set", "kit"];

const emptyForm = {
  sku: "",
  name: "",
  category: "Modules",
  description: "",
  branchId: "",
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
  const { branchId } = useBranch();
  const { user } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "inventory";
  const [items, setItems] = useState<BackendInventoryItem[]>([]);
  const [branches, setBranches] = useState<BackendBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<BackendInventoryItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [adjustDelta, setAdjustDelta] = useState("0");
  const [adjustReason, setAdjustReason] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [imageFiles, setImageFiles] = useState<File[]>([]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await api.listInventory(branchId));
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof ApiError ? err.message : "Failed to load inventory",
        variant: "destructive",
      });
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
      ...emptyForm,
      branchId: branchId !== "all" ? branchId : branches[0]?.id ?? "",
    });
    setImageFiles([]);
    setDialogOpen(true);
  };

  const saveItem = async () => {
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
        description: form.description.trim() || null,
        branchId: form.branchId,
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
      await loadItems();
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof ApiError ? err.errors?.join(", ") || err.message : "Unable to save item",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const adjustStock = async () => {
    if (!selected || user?.role !== "admin") return;
    setSaving(true);
    try {
      await api.adjustInventoryStock(selected.id, Number(adjustDelta), adjustReason.trim());
      toast({ title: "Stock adjusted" });
      setAdjustDelta("0");
      setAdjustReason("");
      await loadItems();
      const refreshed = await api.listInventory(branchId);
      setSelected(refreshed.find((i) => i.id === selected.id) ?? null);
    } catch (err) {
      toast({
        title: "Adjustment failed",
        description: err instanceof ApiError ? err.message : "Unable to adjust",
        variant: "destructive",
      });
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
              <Button onClick={openCreate} disabled={branches.length === 0} variant="brand">
                <Plus className="mr-1 h-4 w-4" /> Add Item
              </Button>
            ) : undefined
          }
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="SKUs in Branch" value={String(items.length)} icon={Boxes} accent="primary" />
          <StatCard label="Reserved Units" value={String(reserved)} icon={Lock} accent="accent" />
          <StatCard label="Stock Value" value={formatCurrencyShort(totalValue)} icon={PackageCheck} accent="success" />
        </div>
        {lowStock > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning-foreground">
            <AlertTriangle className="h-4 w-4" /> {lowStock} item(s) at or below reorder level — raise a Stock Purchase Request.
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
            searchPlaceholder="Search inventory items…"
            emptyMessage="No inventory items yet."
            filters={[{ label: "Category", options: categoryOptions, predicate: (i, v) => i.category === v }]}
            onRowClick={setSelected}
          />
        )}

        <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
          <SheetContent className="sm:max-w-md overflow-y-auto">
            {selected && (
              <>
                <SheetHeader>
                  <SheetTitle>{selected.name}</SheetTitle>
                  <SheetDescription>
                    {selected.sku} · {selected.category}
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <Info label="In stock" value={String(selected.inStock)} />
                  <Info label="Reserved" value={String(selected.reserved)} />
                  <Info label="Reorder at" value={String(selected.reorderLevel)} />
                  <Info label="UoM" value={selected.unitOfMeasure ?? "pcs"} />
                  <Info label="Unit cost" value={formatCurrency(selected.unitCost)} />
                  <Info label="Selling price" value={formatCurrency(selected.sellingPrice ?? 0)} />
                  <Info label="Delivery" value={`${formatCurrency(selected.deliveryCharge ?? 0)} (${selected.deliveryChargeType ?? "flat"})`} />
                  <Info label="Supplier" value={selected.supplier} />
                </div>
                {selected.description && <p className="mt-4 text-sm text-muted-foreground">{selected.description}</p>}
                {user?.role === "admin" && (
                  <div className="mt-6 space-y-3 rounded-lg border border-border p-3">
                    <p className="text-sm font-medium">Force stock adjustment</p>
                    <Input type="number" value={adjustDelta} onChange={(e) => setAdjustDelta(e.target.value)} placeholder="Delta (+/-)" />
                    <Input value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="Reason (required)" />
                    <Button size="sm" disabled={saving || !adjustReason.trim() || Number(adjustDelta) === 0} onClick={() => void adjustStock()}>
                      Apply adjustment
                    </Button>
                  </div>
                )}
              </>
            )}
          </SheetContent>
        </Sheet>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Inventory Item</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>SKU / Part Number</Label>
                  <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="font-mono" />
                </div>
                <div className="grid gap-2">
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Branch</Label>
                  <Select value={form.branchId} onValueChange={(v) => setForm({ ...form, branchId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label>Qty on hand</Label>
                  <Input type="number" min={0} value={form.inStock} onChange={(e) => setForm({ ...form, inStock: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Reorder threshold</Label>
                  <Input type="number" min={0} value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Cost price</Label>
                  <Input type="number" min={0} value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label>Selling price</Label>
                  <Input type="number" min={0} value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Delivery charge</Label>
                  <Input type="number" min={0} value={form.deliveryCharge} onChange={(e) => setForm({ ...form, deliveryCharge: e.target.value })} />
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
                <Label>Supplier</Label>
                <Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Product images</Label>
                <Input type="file" accept="image/*" multiple onChange={(e) => setImageFiles(Array.from(e.target.files ?? []))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void saveItem()} disabled={saving || !form.branchId || !form.sku.trim() || !form.name.trim()}>
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
