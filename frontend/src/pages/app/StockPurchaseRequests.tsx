import { useCallback, useEffect, useState } from "react";
import { Loader2, ShoppingCart } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { ApiError, api, type BackendStockPurchaseRequest } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { defaultDatePlusDays, formatDate } from "@/lib/format";
import { toast } from "@/hooks/use-toast";

export default function StockPurchaseRequests() {
  const { user } = useAuth();
  const canConvert = user?.role === "admin" || user?.role === "inventory";
  const [rows, setRows] = useState<BackendStockPurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<BackendStockPurchaseRequest | null>(null);
  const [expectedDate, setExpectedDate] = useState(defaultDatePlusDays(7));
  const [unitCost, setUnitCost] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await api.listStockPurchaseRequests());
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof ApiError ? err.message : "Failed to load requests",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const convert = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.convertStockPurchaseRequest(selected.id, {
        expectedDate,
        unitCost: unitCost ? Number(unitCost) : undefined,
      });
      toast({ title: "Converted to purchase order" });
      setSelected(null);
      await load();
    } catch (err) {
      toast({
        title: "Convert failed",
        description: err instanceof ApiError ? err.message : "Unable to convert",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<BackendStockPurchaseRequest>[] = [
    {
      key: "inventoryItem",
      header: "Item",
      render: (r) => (
        <div>
          <p className="font-medium">{r.inventoryItem?.name ?? r.inventoryItemId}</p>
          <p className="font-mono text-xs text-muted-foreground">{r.inventoryItem?.sku}</p>
        </div>
      ),
    },
    { key: "quantity", header: "Qty", render: (r) => <span>{r.quantity}</span> },
    {
      key: "status",
      header: "Status",
      render: (r) => <Badge variant={r.status === "open" ? "default" : "secondary"}>{r.status}</Badge>,
    },
    { key: "note", header: "Note", render: (r) => <span className="text-sm text-muted-foreground">{r.note ?? "—"}</span> },
    { key: "createdAt", header: "Requested", render: (r) => <span className="text-sm">{formatDate(r.createdAt)}</span> },
    {
      key: "actions" as keyof BackendStockPurchaseRequest,
      header: "",
      render: (r) =>
        canConvert && r.status === "open" ? (
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              setUnitCost(String(r.inventoryItem?.unitCost ?? ""));
              setSelected(r);
            }}
          >
            Convert to PO
          </Button>
        ) : null,
    },
  ];

  return (
    <RoleGuard roles={["admin", "inventory", "inspector", "engineer"]}>
      <div className="space-y-6">
        <PageHeader
          title="Stock Purchase Requests"
          description="Shortage requests raised by inspectors/engineers. Inventory staff converts them into purchase orders."
        />
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : (
          <DataTable
            data={rows}
            columns={columns}
            searchKeys={["note"]}
            emptyMessage="No stock purchase requests."
          />
        )}

        <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" /> Convert to Purchase Order
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <p className="text-sm text-muted-foreground">
                {selected?.inventoryItem?.name} × {selected?.quantity}
              </p>
              <div className="grid gap-2">
                <Label>Expected date</Label>
                <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Unit cost</Label>
                <Input type="number" min={0} value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelected(null)}>
                Cancel
              </Button>
              <Button disabled={saving} onClick={() => void convert()}>
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
