import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, PackageCheck, Undo2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { InventoryStageNav } from "@/components/inventory/InventoryStageNav";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatCard } from "@/components/shared/StatCard";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InventoryProductSelect } from "@/components/shared/InventoryProductSelect";
import { api, type BackendStockReservation } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";

type ReservationRow = BackendStockReservation & {
  itemLabel: string;
  purposeLabel: string;
  remaining: number;
};

function remainingOf(row: BackendStockReservation) {
  return Math.max(0, row.quantity - row.consumed - row.released);
}

function purposeOf(row: BackendStockReservation) {
  if (row.purpose?.trim()) return row.purpose.trim();
  if (row.salesOrder?.reference) return `Sales order ${row.salesOrder.reference}`;
  if (row.estimate?.reference) return `Estimate ${row.estimate.reference}`;
  if (row.job?.reference) return `Job ${row.job.reference}`;
  return "Allocated stock";
}

function statusLabel(status: string) {
  if (status === "active") return "Reserved";
  if (status === "shortage") return "Partial";
  if (status === "consumed") return "Issued";
  if (status === "released") return "Released";
  if (status === "closed") return "Closed";
  return status;
}

function isOpen(status: string) {
  return status === "active" || status === "shortage";
}

export default function StockReservations() {
  const queryClient = useQueryClient();
  const rowsQuery = useQuery({
    queryKey: ["stock-reservations"],
    queryFn: () => api.listStockReservations(),
  });
  const inventoryQuery = useQuery({
    queryKey: ["inventory", "options"],
    queryFn: () => api.listInventory({ limit: 100, page: 1, status: "active" }).then((r) => r.data),
    staleTime: 60_000,
  });

  const [filter, setFilter] = useState<"open" | "issued" | "released" | "all">("open");
  const [reserveOpen, setReserveOpen] = useState(false);
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [purpose, setPurpose] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionRow, setActionRow] = useState<ReservationRow | null>(null);
  const [action, setAction] = useState<"consume" | "release">("consume");
  const [actionQty, setActionQty] = useState("1");

  const inventory = inventoryQuery.data ?? [];
  const selected = inventory.find((item) => item.id === itemId);
  const selectedAvailable = selected ? (selected.available ?? Math.max(0, selected.inStock - selected.reserved)) : 0;
  const typedReserve = Number(quantity);
  const pendingReserve = Number.isInteger(typedReserve) && typedReserve > 0 ? typedReserve : 0;
  const reservedPreview = selected ? selected.reserved + pendingReserve : 0;
  const availablePreview = selected ? Math.max(0, selected.inStock - reservedPreview) : 0;

  const rows = useMemo<ReservationRow[]>(() => {
    return (rowsQuery.data ?? []).map((row) => ({
      ...row,
      itemLabel: row.inventoryItem ? `${row.inventoryItem.sku} · ${row.inventoryItem.name}` : row.inventoryItemId,
      purposeLabel: purposeOf(row),
      remaining: remainingOf(row),
    }));
  }, [rowsQuery.data]);

  const visible = useMemo(() => {
    if (filter === "open") return rows.filter((row) => isOpen(row.status) && row.remaining > 0);
    if (filter === "issued") return rows.filter((row) => row.status === "consumed" || row.consumed > 0);
    if (filter === "released") return rows.filter((row) => row.status === "released" || row.released > 0);
    return rows;
  }, [rows, filter]);

  const unitsReserved = rows.filter((row) => isOpen(row.status)).reduce((sum, row) => sum + row.remaining, 0);
  const unitsIssued = rows.reduce((sum, row) => sum + row.consumed, 0);
  const openCount = rows.filter((row) => isOpen(row.status) && row.remaining > 0).length;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["stock-reservations"] });
    await queryClient.invalidateQueries({ queryKey: ["inventory"] });
    await queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
  };

  const reserveStock = async () => {
    const qty = Number(quantity);
    if (!itemId) {
      toast.error("Select a part to reserve");
      return;
    }
    if (!(qty > 0) || !Number.isInteger(qty)) {
      toast.error("Quantity must be a whole number greater than 0");
      return;
    }
    if (qty > selectedAvailable) {
      toast.error(`Only ${selectedAvailable} available to reserve`);
      return;
    }
    if (!purpose.trim()) {
      toast.error("Enter what this stock is reserved for");
      return;
    }
    setSaving(true);
    try {
      await api.createStockReservation({ inventoryItemId: itemId, quantity: qty, purpose: purpose.trim() });
      toast({
        title: "Stock reserved",
        description: `${qty} held for ${purpose.trim()}. On-hand stock is unchanged.`,
      });
      setReserveOpen(false);
      setItemId("");
      setQuantity("1");
      setPurpose("");
      await refresh();
    } catch (error) {
      toast.apiError(error, { fallback: "Unable to reserve stock" });
    } finally {
      setSaving(false);
    }
  };

  const submitAction = async () => {
    if (!actionRow) return;
    const qty = Number(actionQty);
    if (!(qty > 0) || !Number.isInteger(qty)) {
      toast.error("Quantity must be a whole number greater than 0");
      return;
    }
    if (qty > actionRow.remaining) {
      toast.error(`Only ${actionRow.remaining} left on this reservation`);
      return;
    }
    setSaving(true);
    try {
      await api.actOnStockReservation(actionRow.id, { action, quantity: qty });
      toast({
        title: action === "consume" ? "Reserved stock issued" : "Reservation released",
        description: action === "consume"
          ? `${qty} deducted from physical stock.`
          : `${qty} returned to available stock. On-hand quantity is unchanged.`,
      });
      setActionRow(null);
      await refresh();
    } catch (error) {
      toast.apiError(error, { fallback: "Unable to update reservation" });
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<ReservationRow>[] = useMemo(() => [
    {
      key: "itemLabel",
      header: "Item",
      render: (row) => (
        <div>
          <p className="font-medium">{row.inventoryItem?.name ?? "Item"}</p>
          <p className="font-mono text-xs text-muted-foreground">{row.inventoryItem?.sku ?? row.inventoryItemId}</p>
        </div>
      ),
    },
    {
      key: "purposeLabel",
      header: "Purpose",
      render: (row) => <span className="text-sm">{row.purposeLabel}</span>,
    },
    {
      key: "quantity",
      header: "Reserved",
      render: (row) => <span className="font-medium">{row.quantity}</span>,
    },
    {
      key: "remaining",
      header: "Still held",
      render: (row) => <span>{row.remaining}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <Badge variant="secondary">{statusLabel(row.status)}</Badge>,
    },
    {
      key: "createdAt",
      header: "When",
      render: (row) => <span className="text-sm text-muted-foreground">{formatDate(row.createdAt)}</span>,
    },
    {
      key: "id",
      header: "",
      className: "w-[1%] whitespace-nowrap text-right",
      render: (row) => isOpen(row.status) && row.remaining > 0 ? (
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setAction("release");
              setActionQty(String(row.remaining));
              setActionRow(row);
            }}
          >
            <Undo2 className="mr-1 h-3.5 w-3.5" /> Release
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setAction("consume");
              setActionQty(String(row.remaining));
              setActionRow(row);
            }}
          >
            <PackageCheck className="mr-1 h-3.5 w-3.5" /> Issue
          </Button>
        </div>
      ) : null,
    },
  ], []);

  return (
    <RoleGuard roles={["admin", "inventory"]}>
      <div className="space-y-6">
        <PageHeader
          title="Stock reserve"
          description="Hold stock for an order or purpose. Physical stock stays on hand until you issue it. Available to sell is on hand minus reserved."
          actions={
            <Button variant="brand" onClick={() => setReserveOpen(true)}>
              <Lock className="mr-1 h-4 w-4" /> Reserve stock
            </Button>
          }
        />
        <InventoryStageNav stage="reserve" />

        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Open reservations" value={String(openCount)} icon={Lock} accent="accent" />
          <StatCard label="Units still held" value={String(unitsReserved)} icon={Lock} accent="primary" />
          <StatCard label="Units issued from holds" value={String(unitsIssued)} icon={PackageCheck} accent="success" />
        </div>

        <div className="rounded-xl border bg-card px-4 py-3 text-sm">
          <p className="font-medium">On hand − Reserved = Available</p>
          <p className="mt-1 text-muted-foreground">
            Example: 100 on hand, reserve 20 for an order. You still have 100 physically, and 80 are available to sell. Issuing the order deducts those 20 from physical stock.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {([
            ["open", "Open"],
            ["issued", "Issued"],
            ["released", "Released"],
            ["all", "All"],
          ] as const).map(([id, label]) => (
            <Button
              key={id}
              size="sm"
              variant={filter === id ? "default" : "outline"}
              onClick={() => setFilter(id)}
            >
              {label}
            </Button>
          ))}
        </div>

        <DataTable
          data={visible}
          columns={columns}
          searchKeys={["itemLabel", "purposeLabel", "status"]}
          emptyMessage="No stock reservations."
          emptyHint="Reserve stock for an order. It stays on the shelf until you issue or release it."
          loading={rowsQuery.isLoading}
          error={rowsQuery.error as Error | null}
          onRetry={() => void rowsQuery.refetch()}
        />

        <Dialog open={reserveOpen} onOpenChange={(open) => { if (!saving) setReserveOpen(open); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reserve stock</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <p className="text-sm text-muted-foreground">
                This allocates units so they cannot be sold elsewhere. On-hand quantity does not change.
              </p>
              <div className="grid gap-2">
                <Label>Part</Label>
                <InventoryProductSelect
                  items={inventory}
                  value={itemId}
                  onValueChange={(id) => setItemId(id)}
                  placeholder="Select inventory item"
                />
              </div>
              {selected ? (
                <div className="grid grid-cols-3 gap-2 rounded-lg border px-3 py-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">On hand</p>
                    <p className="font-semibold">{selected.inStock}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Reserved</p>
                    <p className="font-semibold">{reservedPreview}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Available</p>
                    <p className="font-semibold">{availablePreview}</p>
                  </div>
                </div>
              ) : null}
              <div className="grid gap-2">
                <Label htmlFor="reserve-qty">Quantity to reserve</Label>
                <Input id="reserve-qty" type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reserve-purpose">Purpose</Label>
                <Textarea
                  id="reserve-purpose"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="Customer order, job, or other allocation"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" disabled={saving} onClick={() => setReserveOpen(false)}>Cancel</Button>
              <Button disabled={saving} onClick={() => void reserveStock()}>
                {saving ? "Reserving…" : "Reserve"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(actionRow)} onOpenChange={(open) => { if (!open && !saving) setActionRow(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{action === "consume" ? "Issue reserved stock" : "Release reservation"}</DialogTitle>
            </DialogHeader>
            {actionRow ? (
              <div className="grid gap-3 py-2">
                <p className="text-sm text-muted-foreground">
                  {action === "consume"
                    ? "Issuing deducts these units from physical stock. Use this when the order is shipped."
                    : "Releasing puts these units back on the shelf. Physical stock does not change."}
                </p>
                <p className="text-sm font-medium">{actionRow.itemLabel}</p>
                <p className="text-xs text-muted-foreground">{actionRow.purposeLabel} · {actionRow.remaining} still held</p>
                <div className="grid gap-2">
                  <Label htmlFor="action-qty">Quantity</Label>
                  <Input
                    id="action-qty"
                    type="number"
                    min={1}
                    max={actionRow.remaining}
                    value={actionQty}
                    onChange={(e) => setActionQty(e.target.value)}
                  />
                </div>
              </div>
            ) : null}
            <DialogFooter>
              <Button variant="outline" disabled={saving} onClick={() => setActionRow(null)}>Cancel</Button>
              <Button disabled={saving} onClick={() => void submitAction()}>
                {saving ? "Saving…" : action === "consume" ? "Issue" : "Release"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RoleGuard>
  );
}
