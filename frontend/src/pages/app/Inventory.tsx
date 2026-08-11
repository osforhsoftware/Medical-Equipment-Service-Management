import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { RoleGuard } from "@/components/auth/RoleGuard";
import { ApiError, api, type BackendInventoryItem } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { formatCurrency, formatCurrencyShort } from "@/lib/format";
import { INVENTORY_CATEGORY_OPTIONS } from "@/lib/fixedOptions";
import { toast } from "@/lib/toast";

const UOM = ["pcs", "box", "meter", "set", "kit"];

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
  const { user } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "inventory";
  const [items, setItems] = useState<BackendInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [addedCategories, setAddedCategories] = useState<string[]>([]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await api.listInventory());
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof ApiError ? err.message : "Failed to load inventory",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const lowStock = items.filter((i) => i.inStock <= i.reorderLevel).length;
  const reserved = items.reduce((s, i) => s + i.reserved, 0);
  const totalValue = items.reduce((s, i) => s + i.inStock * Number(i.unitCost), 0);

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
          <StatCard label="Total SKUs" value={String(items.length)} icon={Boxes} accent="primary" />
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
            filters={[{ label: "Category", options: categoryFilterOptions, predicate: (i, v) => i.category === v }]}
            onRowClick={(item) => navigate(`/app/inventory/${item.id}`)}
          />
        )}

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
                  <Select
                    value={form.category}
                    onValueChange={(v) =>
                      setForm({ ...form, category: v, categoryOther: v === "Other" ? form.categoryOther : "" })
                    }
                  >
                    <SelectTrigger>
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
                </div>
              </div>
              {form.category === "Other" && (
                <div className="grid gap-2 rounded-lg border border-dashed border-border p-3">
                  <Label htmlFor="inventory-category-other">Add new category</Label>
                  <div className="flex gap-2">
                    <Input
                      id="inventory-category-other"
                      value={form.categoryOther}
                      onChange={(e) => setForm({ ...form, categoryOther: e.target.value })}
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
                </div>
              )}
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
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
              <Button
                onClick={() => void saveItem()}
                disabled={saving || !form.sku.trim() || !form.name.trim() || !resolvedCategory}
              >
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
