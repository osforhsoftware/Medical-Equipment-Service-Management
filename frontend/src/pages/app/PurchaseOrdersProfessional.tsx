import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { api, type BackendInventoryItem, type BackendPurchaseOrder, type BackendSupplier } from "@/lib/api";
import { defaultDatePlusDays, formatCurrency, formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";

type Line = { inventoryItemId?: string; sku: string; description: string; quantityOrdered: number; unitCost: number; taxRate: number };
const blankLine = (): Line => ({ sku: "", description: "", quantityOrdered: 1, unitCost: 0, taxRate: 0 });

export default function PurchaseOrdersProfessional() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<BackendPurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<BackendSupplier[]>([]);
  const [inventory, setInventory] = useState<BackendInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [expectedDate, setExpectedDate] = useState(defaultDatePlusDays(7));
  const [lines, setLines] = useState<Line[]>([blankLine()]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [poRows, supplierRows, items] = await Promise.all([api.listPurchaseOrders(), api.listSuppliers(), api.listInventory()]);
      setOrders(poRows); setSuppliers(supplierRows); setInventory(items);
    } catch (error) { toast.apiError(error, { fallback: "Request failed" }); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    const supplier = suppliers.find((row) => row.id === supplierId);
    if (!supplier) return;
    setSaving(true);
    try {
      const created = await api.createItemizedPurchaseOrder({ supplierId, supplier: supplier.name, expectedDate, lines });
      setCreateOpen(false); setSupplierId(""); setLines([blankLine()]); setOrders((current) => [created, ...current]); toast({ title: "Itemized purchase order created" });
    } catch (error) { toast.apiError(error, { fallback: "Request failed" }); }
    finally { setSaving(false); }
  };

  const columns: Column<BackendPurchaseOrder>[] = [
    { key: "reference", header: "PO", render: (order) => <div className="flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-primary" /><span className="font-mono font-medium">{order.reference}</span></div> },
    { key: "supplier", header: "Supplier", render: (order) => <span>{order.supplier}</span> },
    { key: "items", header: "Lines", render: (order) => <span>{order.items}</span> },
    { key: "total", header: "Total", render: (order) => <span className="font-semibold">{formatCurrency(order.total)}</span> },
    { key: "expectedDate", header: "Expected", render: (order) => <span>{formatDate(order.expectedDate)}</span> },
    { key: "status", header: "Status", render: (order) => <StatusBadge status={order.status} /> },
  ];

  return <RoleGuard roles={["admin", "inventory"]}><div className="space-y-6">
    <PageHeader title="Purchase Orders" description="Line-item procurement and partial receiving into inventory." actions={<Button variant="brand" onClick={() => setCreateOpen(true)}><Plus className="mr-1 h-4 w-4" /> New PO</Button>} />
    {loading ? <div className="flex justify-center gap-2 py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading purchase orders…</div> : <DataTable data={orders} columns={columns} searchKeys={["reference", "supplier"]} searchPlaceholder="Search purchase orders…" emptyMessage="No purchase orders." onRowClick={(order) => navigate(`/app/purchase-orders/${order.id}`)} />}
    <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>New itemized purchase order</DialogTitle></DialogHeader><div className="grid gap-4 py-2"><div className="grid grid-cols-2 gap-3"><Field label="Supplier"><Select value={supplierId} onValueChange={setSupplierId}><SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger><SelectContent>{suppliers.map((supplier) => <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>)}</SelectContent></Select></Field><Field label="Expected date"><Input type="date" value={expectedDate} onChange={(event) => setExpectedDate(event.target.value)} /></Field></div>
      <div className="space-y-3"><div className="flex justify-between"><Label>PO lines</Label><Button size="sm" variant="outline" onClick={() => setLines((current) => [...current, blankLine()])}><Plus className="mr-1 h-3.5 w-3.5" /> Line</Button></div>{lines.map((line, index) => <div key={index} className="space-y-2 rounded-lg border p-3"><div className="flex gap-2"><Select value={line.inventoryItemId} onValueChange={(id) => { const item = inventory.find((row) => row.id === id); if (!item) return; setLines((current) => current.map((row, i) => i === index ? { ...row, inventoryItemId: item.id, sku: item.sku, description: item.name, unitCost: Number(item.unitCost) } : row)); }}><SelectTrigger><SelectValue placeholder="Link inventory item" /></SelectTrigger><SelectContent>{inventory.map((item) => <SelectItem key={item.id} value={item.id}>{item.sku} · {item.name}</SelectItem>)}</SelectContent></Select><Button size="icon" variant="ghost" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button></div><div className="grid grid-cols-[1fr_2fr] gap-2"><Input placeholder="SKU" value={line.sku} onChange={(event) => setLines((current) => current.map((row, i) => i === index ? { ...row, sku: event.target.value } : row))} /><Input placeholder="Description" value={line.description} onChange={(event) => setLines((current) => current.map((row, i) => i === index ? { ...row, description: event.target.value } : row))} /></div><div className="grid grid-cols-3 gap-2"><Input aria-label="Quantity ordered" type="number" min={1} value={line.quantityOrdered} onChange={(event) => setLines((current) => current.map((row, i) => i === index ? { ...row, quantityOrdered: Number(event.target.value) } : row))} /><Input aria-label="Unit cost" type="number" min={0} value={line.unitCost} onChange={(event) => setLines((current) => current.map((row, i) => i === index ? { ...row, unitCost: Number(event.target.value) } : row))} /><Input aria-label="Tax rate" type="number" min={0} value={line.taxRate} onChange={(event) => setLines((current) => current.map((row, i) => i === index ? { ...row, taxRate: Number(event.target.value) } : row))} /></div><p className="text-xs text-muted-foreground">Quantity · Unit cost · Tax %</p></div>)}</div>
    </div><DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button onClick={create} disabled={saving || !supplierId || lines.some((line) => !line.sku || !line.description || line.quantityOrdered < 1)}>Create PO</Button></DialogFooter></DialogContent></Dialog>
  </div></RoleGuard>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="grid gap-2"><Label>{label}</Label>{children}</div>; }
