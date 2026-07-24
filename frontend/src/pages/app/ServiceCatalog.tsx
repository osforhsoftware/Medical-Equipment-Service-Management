import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Wrench } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api, type BackendCatalogItem, type CatalogItemInput } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { toast } from "@/hooks/use-toast";

const blank: CatalogItemInput = {
  code: "",
  name: "",
  description: "",
  category: "",
  unit: "service",
  unitPrice: 0,
  taxRate: 0,
  isActive: true,
};

export default function ServiceCatalog() {
  const [items, setItems] = useState<BackendCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<BackendCatalogItem | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CatalogItemInput>(blank);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await api.listServiceCatalog());
    } catch (error) {
      toast({ title: "Unable to load service catalog", description: error instanceof ApiError ? error.message : "Request failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const edit = (item?: BackendCatalogItem) => {
    setEditing(item ?? null);
    setForm(item ? {
      branchId: item.branchId,
      code: item.code,
      name: item.name,
      description: item.description,
      category: item.category,
      unit: item.unit,
      unitPrice: Number(item.unitPrice),
      taxRate: Number(item.taxRate),
      isActive: item.isActive,
    } : blank);
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (editing) await api.updateServiceCatalogItem(editing.id, form);
      else await api.createServiceCatalogItem(form);
      setOpen(false);
      await load();
      toast({ title: editing ? "Service updated" : "Service created" });
    } catch (error) {
      toast({ title: "Save failed", description: error instanceof ApiError ? error.message : "Request failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<BackendCatalogItem>[] = [
    { key: "code", header: "Code", render: (item) => <span className="font-mono text-xs">{item.code}</span> },
    { key: "name", header: "Service", render: (item) => <div><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.category}</p></div> },
    { key: "unit", header: "Unit", render: (item) => <span className="text-sm">{item.unit}</span> },
    { key: "unitPrice", header: "Rate", render: (item) => <span className="font-medium">{formatCurrency(item.unitPrice)}</span> },
    { key: "taxRate", header: "Tax", render: (item) => <span>{Number(item.taxRate)}%</span> },
    { key: "isActive", header: "Status", render: (item) => <StatusBadge status={item.isActive ? "active" : "inactive"} /> },
    { key: "actions" as keyof BackendCatalogItem, header: "", render: (item) => <Button size="sm" variant="ghost" onClick={(event) => { event.stopPropagation(); edit(item); }}><Pencil className="h-4 w-4" /></Button> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Service Catalog" description="Reusable services, labor rates and tax defaults for estimates." actions={<Button variant="brand" onClick={() => edit()}><Plus className="mr-1 h-4 w-4" /> Add service</Button>} />
      {loading ? <div className="flex justify-center gap-2 py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading catalog…</div> : (
        <DataTable data={items} columns={columns} searchKeys={["code", "name", "category"]} searchPlaceholder="Search services…" emptyMessage="No catalog services yet." />
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Wrench className="h-5 w-5" /> {editing ? "Edit service" : "Add service"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Code"><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
              <Field label="Category"><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
            </div>
            <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Description"><Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Unit"><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></Field>
              <Field label="Rate"><Input type="number" min={0} value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: Number(e.target.value) })} /></Field>
              <Field label="Tax %"><Input type="number" min={0} max={100} value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: Number(e.target.value) })} /></Field>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3"><Label>Active</Label><Switch checked={form.isActive} onCheckedChange={(isActive) => setForm({ ...form, isActive })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} disabled={saving || !form.code.trim() || !form.name.trim() || !form.category.trim()}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-2"><Label>{label}</Label>{children}</div>;
}
