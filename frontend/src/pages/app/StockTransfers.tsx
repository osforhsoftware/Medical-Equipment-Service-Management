import { useCallback, useEffect, useState } from "react";
import { Plus, ArrowLeftRight, Loader2 } from "lucide-react";
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
import { api, type BackendBranch, type BackendStockTransfer } from "@/lib/api";
import { formatDate, formatTransferStatus } from "@/lib/format";
import { toast } from "@/hooks/use-toast";

export default function StockTransfers() {
  const [transfers, setTransfers] = useState<BackendStockTransfer[]>([]);
  const [branches, setBranches] = useState<BackendBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<BackendStockTransfer | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    fromBranch: "",
    toBranch: "",
    items: "1",
    status: "pending",
  });

  const loadTransfers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listStockTransfers();
      setTransfers(data);
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

  const branchNames = branches.map((b) => b.name);

  const openCreate = () => {
    setForm({
      fromBranch: branchNames[0] ?? "",
      toBranch: branchNames[1] ?? branchNames[0] ?? "",
      items: "1",
      status: "pending",
    });
    setDialogOpen(true);
  };

  const saveTransfer = async () => {
    if (!form.fromBranch || !form.toBranch || form.fromBranch === form.toBranch) {
      toast({ title: "Invalid route", description: "Select different from and to branches.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await api.createStockTransfer({
        fromBranch: form.fromBranch,
        toBranch: form.toBranch,
        items: Number(form.items) || 1,
        status: form.status,
      });
      toast({ title: "Transfer created", description: "Stock transfer saved to the database." });
      setDialogOpen(false);
      await loadTransfers();
    } catch (err) {
      const message = err instanceof ApiError ? err.errors?.join(", ") || err.message : "Unable to save transfer";
      toast({ title: "Save failed", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<BackendStockTransfer>[] = [
    { key: "reference", header: "Transfer", render: (t) => <span className="font-mono text-sm font-medium">{t.reference}</span> },
    {
      key: "route",
      header: "Route",
      render: (t) => (
        <span className="inline-flex items-center gap-2 text-sm">
          {t.fromBranch} <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground" /> {t.toBranch}
        </span>
      ),
    },
    { key: "items", header: "Items", render: (t) => <span className="font-medium">{t.items}</span> },
    { key: "createdAt", header: "Created", render: (t) => <span className="text-sm text-muted-foreground">{formatDate(t.createdAt)}</span> },
    { key: "status", header: "Status", render: (t) => <StatusBadge status={formatTransferStatus(t.status)} /> },
  ];

  return (
    <RoleGuard roles={["admin", "inventory"]}>
      <div className="space-y-6">
        <PageHeader
          title="Stock Transfers"
          description="Move parts between branches."
          actions={
            <Button onClick={openCreate} disabled={branchNames.length < 2} className="bg-gradient-primary text-primary-foreground hover:opacity-90">
              <Plus className="mr-1 h-4 w-4" /> New Transfer
            </Button>
          }
        />

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading transfers…
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
                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <Info label="Items" value={String(selected.items)} />
                  <Info label="Created" value={formatDate(selected.createdAt)} />
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>New Stock Transfer</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>From branch</Label>
                  <Select value={form.fromBranch} onValueChange={(v) => setForm({ ...form, fromBranch: v })}>
                    <SelectTrigger><SelectValue placeholder="From" /></SelectTrigger>
                    <SelectContent>
                      {branchNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>To branch</Label>
                  <Select value={form.toBranch} onValueChange={(v) => setForm({ ...form, toBranch: v })}>
                    <SelectTrigger><SelectValue placeholder="To" /></SelectTrigger>
                    <SelectContent>
                      {branchNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="items">Item count</Label>
                  <Input id="items" type="number" min={1} value={form.items} onChange={(e) => setForm({ ...form, items: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="inTransit">In Transit</SelectItem>
                      <SelectItem value="received">Received</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={saveTransfer} disabled={saving}>
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
