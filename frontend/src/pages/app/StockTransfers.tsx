import { useCallback, useEffect, useState } from "react";
import { ArrowLeftRight, Loader2, Plus, Truck } from "lucide-react";
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
import { ApiError, api, type BackendBranch, type BackendInventoryItem, type BackendStockTransfer } from "@/lib/api";
import { useBranch } from "@/context/BranchContext";
import { formatDate, formatTransferStatus } from "@/lib/format";
import { toast } from "@/hooks/use-toast";

export default function StockTransfers() {
  const { branchId } = useBranch();
  const [transfers, setTransfers] = useState<BackendStockTransfer[]>([]);
  const [branches, setBranches] = useState<BackendBranch[]>([]);
  const [inventory, setInventory] = useState<BackendInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<BackendStockTransfer | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    fromBranchId: "",
    toBranchId: "",
    inventoryItemId: "",
    quantity: "1",
  });

  const loadTransfers = useCallback(async () => {
    setLoading(true);
    try {
      setTransfers(await api.listDomainStockTransfers());
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to load stock transfers";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTransfers();
  }, [loadTransfers]);

  useEffect(() => {
    void api.listBranches().then(setBranches).catch(() => setBranches([]));
  }, []);

  useEffect(() => {
    if (!form.fromBranchId) {
      setInventory([]);
      return;
    }
    void api.listInventory(form.fromBranchId).then(setInventory).catch(() => setInventory([]));
  }, [form.fromBranchId]);

  const openCreate = () => {
    const defaultFrom = branchId !== "all" ? branchId : branches[0]?.id ?? "";
    setForm({
      fromBranchId: defaultFrom,
      toBranchId: branches.find((branch) => branch.id !== defaultFrom)?.id ?? "",
      inventoryItemId: "",
      quantity: "1",
    });
    setDialogOpen(true);
  };

  const saveTransfer = async () => {
    if (!form.fromBranchId || !form.toBranchId || !form.inventoryItemId) return;
    setSaving(true);
    try {
      await api.createDomainStockTransfer({
        fromBranchId: form.fromBranchId,
        toBranchId: form.toBranchId,
        lines: [{ inventoryItemId: form.inventoryItemId, quantity: Number(form.quantity) || 1 }],
      });
      toast({ title: "Stock transfer created", description: "Pending transfer ready for dispatch." });
      setDialogOpen(false);
      await loadTransfers();
    } catch (err) {
      const message = err instanceof ApiError ? err.errors?.join(", ") || err.message : "Unable to save transfer";
      toast({ title: "Save failed", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const dispatchTransfer = async (transfer: BackendStockTransfer) => {
    setSaving(true);
    try {
      await api.dispatchStockTransfer(transfer.id);
      toast({ title: "Transfer dispatched", description: "Stock has left the source branch." });
      await loadTransfers();
      setSelected(null);
    } catch (err) {
      toast({ title: "Dispatch failed", description: err instanceof ApiError ? err.message : "Request failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const receiveTransfer = async (transfer: BackendStockTransfer) => {
    setSaving(true);
    try {
      await api.receiveStockTransfer(transfer.id);
      toast({ title: "Transfer received", description: "Destination stock updated." });
      await loadTransfers();
      setSelected(null);
    } catch (err) {
      toast({ title: "Receive failed", description: err instanceof ApiError ? err.message : "Request failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<BackendStockTransfer>[] = [
    {
      key: "reference",
      header: "Transfer",
      render: (t) => (
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="h-4 w-4 text-primary" />
          <span className="font-mono text-sm font-medium">{t.reference}</span>
        </div>
      ),
    },
    { key: "fromBranch", header: "From", render: (t) => <span className="text-sm">{t.fromBranch}</span> },
    { key: "toBranch", header: "To", render: (t) => <span className="text-sm">{t.toBranch}</span> },
    { key: "items", header: "Lines", render: (t) => <span className="font-medium">{t.lineItems?.length ?? t.items}</span> },
    { key: "createdAt", header: "Created", render: (t) => <span className="text-sm text-muted-foreground">{formatDate(t.createdAt)}</span> },
    { key: "status", header: "Status", render: (t) => <StatusBadge status={formatTransferStatus(t.status)} /> },
  ];

  return (
    <RoleGuard roles={["admin", "inventory"]}>
      <div className="space-y-6">
        <PageHeader
          title="Stock Transfers"
          description="Move inventory between branches with dispatch, receive, and stock ledger updates."
          actions={
            <Button onClick={openCreate} variant="brand">
              <Plus className="mr-1 h-4 w-4" /> New Transfer
            </Button>
          }
        />

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading stock transfers…
          </div>
        ) : (
          <DataTable
            data={transfers}
            columns={columns}
            searchKeys={["reference", "fromBranch", "toBranch"]}
            searchPlaceholder="Search transfers…"
            emptyMessage="No stock transfers yet."
            filters={[
              {
                label: "Status",
                options: [
                  { label: "Pending", value: "pending" },
                  { label: "In Transit", value: "in-transit" },
                  { label: "Received", value: "received" },
                ],
                predicate: (t, v) => formatTransferStatus(t.status) === v,
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
                    <StatusBadge status={formatTransferStatus(selected.status)} />
                  </div>
                  <SheetDescription>
                    {selected.fromBranch} → {selected.toBranch}
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-5 space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <Info label="Lines" value={String(selected.lineItems?.length ?? selected.items)} />
                    <Info label="Created" value={formatDate(selected.createdAt)} />
                  </div>
                  <div className="space-y-2">
                    {(selected.lineItems ?? []).map((line) => (
                      <div key={line.id} className="rounded-lg border border-border p-2.5">
                        <p className="font-medium">{line.description}</p>
                        <p className="text-xs text-muted-foreground">{line.sku} · qty {line.quantity}</p>
                      </div>
                    ))}
                  </div>
                  {formatTransferStatus(selected.status) === "pending" ? (
                    <Button className="w-full" disabled={saving} onClick={() => void dispatchTransfer(selected)}>
                      <Truck className="mr-1 h-4 w-4" /> Dispatch Transfer
                    </Button>
                  ) : null}
                  {formatTransferStatus(selected.status) === "in-transit" ? (
                    <Button className="w-full" disabled={saving} onClick={() => void receiveTransfer(selected)}>
                      Receive into Destination
                    </Button>
                  ) : null}
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>New Stock Transfer</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label>From branch</Label>
                <Select value={form.fromBranchId} onValueChange={(v) => setForm({ ...form, fromBranchId: v, inventoryItemId: "" })}>
                  <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>To branch</Label>
                <Select value={form.toBranchId} onValueChange={(v) => setForm({ ...form, toBranchId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
                  <SelectContent>
                    {branches.filter((b) => b.id !== form.fromBranchId).map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Inventory item</Label>
                <Select value={form.inventoryItemId} onValueChange={(v) => setForm({ ...form, inventoryItemId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                  <SelectContent>
                    {inventory.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} ({item.sku}) · {item.inStock - item.reserved} available
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="qty">Quantity</Label>
                <Input id="qty" type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={saveTransfer} disabled={saving || !form.fromBranchId || !form.toBranchId || !form.inventoryItemId}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create transfer
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
