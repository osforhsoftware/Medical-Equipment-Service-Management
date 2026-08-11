import { useCallback, useEffect, useState } from "react";
import { Building, Loader2, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, type BackendOfficeAsset, type OfficeAssetInput } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";

const blank: OfficeAssetInput = { assetTag: "", name: "", category: "", serialNumber: "", purchaseDate: "", purchaseCost: 0, notes: "" };

export default function OfficeAssets() {
  const [assets, setAssets] = useState<BackendOfficeAsset[]>([]);
  const [form, setForm] = useState<OfficeAssetInput>(blank);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setAssets(await api.listOfficeAssets()); }
    catch (error) { toast.apiError(error, { fallback: "Request failed" }); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await api.createOfficeAsset({ ...form, purchaseDate: form.purchaseDate || null, serialNumber: form.serialNumber || null, notes: form.notes || null });
      setOpen(false); setForm(blank); await load(); toast({ title: "Office asset created" });
    } catch (error) { toast.apiError(error, { fallback: "Request failed" }); }
    finally { setSaving(false); }
  };

  const columns: Column<BackendOfficeAsset>[] = [
    { key: "assetTag", header: "Asset", render: (asset) => <div className="flex items-center gap-2"><Building className="h-4 w-4 text-primary" /><div><p className="font-medium">{asset.name}</p><p className="font-mono text-xs text-muted-foreground">{asset.assetTag}</p></div></div> },
    { key: "category", header: "Category", render: (asset) => <span>{asset.category}</span> },
    { key: "serialNumber", header: "Serial", render: (asset) => <span className="font-mono text-xs">{asset.serialNumber || "—"}</span> },
    { key: "purchaseDate", header: "Purchased", render: (asset) => <span>{asset.purchaseDate ? formatDate(asset.purchaseDate) : "—"}</span> },
    { key: "purchaseCost", header: "Cost", render: (asset) => <span>{formatCurrency(asset.purchaseCost)}</span> },
    { key: "status", header: "Status", render: (asset) => <StatusBadge status={asset.status} /> },
  ];

  return <div className="space-y-6">
    <PageHeader title="Office Assets" description="Internal equipment and acquisition details." actions={<Button variant="brand" onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" /> Add asset</Button>} />
    {loading ? <div className="flex justify-center gap-2 py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading assets…</div> : <DataTable data={assets} columns={columns} searchKeys={["assetTag", "name", "category", "serialNumber"]} searchPlaceholder="Search assets…" emptyMessage="No office assets recorded." />}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Add office asset</DialogTitle></DialogHeader><div className="grid gap-3 py-2">
      <div className="grid grid-cols-2 gap-3"><Field label="Asset tag"><Input value={form.assetTag} onChange={(e) => setForm({ ...form, assetTag: e.target.value })} /></Field><Field label="Category"><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field></div>
      <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
      <Field label="Serial number"><Input value={form.serialNumber ?? ""} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3"><Field label="Purchase date"><Input type="date" value={form.purchaseDate ?? ""} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} /></Field><Field label="Purchase cost"><Input type="number" min={0} value={form.purchaseCost} onChange={(e) => setForm({ ...form, purchaseCost: Number(e.target.value) })} /></Field></div>
      <Field label="Notes"><Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
    </div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} disabled={saving || !form.assetTag.trim() || !form.name.trim() || !form.category.trim()}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="grid gap-2"><Label>{label}</Label>{children}</div>; }
