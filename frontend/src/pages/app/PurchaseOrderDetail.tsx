import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Loader2, PackageCheck } from "lucide-react";
import {
  DetailInfoGrid,
  DetailSection,
  RecordDetailLayout,
} from "@/components/shared/RecordDetailLayout";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError, type BackendPurchaseOrder } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";

export default function PurchaseOrderDetail() {
  const { id = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [order, setOrder] = useState<BackendPurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receiptRef, setReceiptRef] = useState("");
  const [receiptNotes, setReceiptNotes] = useState("");
  const [received, setReceived] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const tab = searchParams.get("tab") ?? "overview";

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setOrder(await api.getPurchaseOrder(id));
    } catch (err) {
      setOrder(null);
      setError(err instanceof ApiError && err.status === 404 ? null : "Please try again.");
      if (!(err instanceof ApiError && err.status === 404)) {
        toast.apiError(err, { fallback: "Failed to load purchase order" });
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const receive = async () => {
    if (!order) return;
    const receiptLines = Object.entries(received)
      .filter(([, quantity]) => quantity > 0)
      .map(([purchaseOrderLineId, quantity]) => ({ purchaseOrderLineId, quantity }));
    setSaving(true);
    try {
      await api.receivePurchaseOrder(order.id, {
        reference: receiptRef,
        notes: receiptNotes || undefined,
        lines: receiptLines,
      });
      setReceiveOpen(false);
      setReceiptRef("");
      setReceiptNotes("");
      setReceived({});
      toast({ title: "Purchase receipt posted", description: "Inventory quantities were updated." });
      await load();
    } catch (err) {
      toast.apiError(err, { fallback: "Receive failed" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <RoleGuard roles={["admin", "inventory"]}>
      <RecordDetailLayout
        backTo="/app/purchase-orders"
        backLabel="Back to Purchase Orders"
        title={order?.reference ?? "Purchase order"}
        subtitle={order ? `${order.supplier} · Expected ${formatDate(order.expectedDate)}` : undefined}
        status={order?.status}
        meta={order ? [
          { label: "Lines", value: String(order.items) },
          { label: "Total", value: formatCurrency(order.total) },
          { label: "Created", value: formatDate(order.createdAt) },
        ] : undefined}
        loading={loading}
        error={error}
        notFound={!loading && !error && !order}
        notFoundTitle="Purchase order not found"
        notFoundDescription="The requested purchase order could not be found."
        onRetry={() => void load()}
        actions={order && order.lineItems?.length && order.status !== "received" && order.status !== "cancelled" ? (
          <Button onClick={() => setReceiveOpen(true)}>
            <PackageCheck className="mr-1 h-4 w-4" /> Receive items
          </Button>
        ) : undefined}
        activeTab={tab}
        onTabChange={(value) => setSearchParams(value === "overview" ? {} : { tab: value })}
        tabs={order ? [
          {
            id: "overview",
            label: "Overview",
            content: (
              <div className="space-y-4">
                <DetailSection title="Order details">
                  <DetailInfoGrid
                    items={[
                      { label: "Supplier", value: order.supplier },
                      { label: "Expected", value: formatDate(order.expectedDate) },
                      { label: "Status", value: order.status },
                      { label: "Total", value: formatCurrency(order.total) },
                      { label: "Created", value: formatDate(order.createdAt) },
                      { label: "Updated", value: formatDate(order.updatedAt) },
                    ]}
                  />
                </DetailSection>
              </div>
            ),
          },
          {
            id: "lines",
            label: "Line items",
            content: (
              <DetailSection title="Line items">
                {!order.lineItems?.length ? (
                  <p className="text-sm text-muted-foreground">Line details are unavailable for this legacy purchase order.</p>
                ) : (
                  <div className="space-y-2">
                    {order.lineItems.map((line) => (
                      <div key={line.id} className="grid grid-cols-[1fr_auto] gap-3 rounded-lg border p-3 text-sm">
                        <div>
                          <p className="font-medium">{line.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {line.sku} · {line.quantityReceived}/{line.quantityOrdered} received · {formatCurrency(line.unitCost)} ea
                          </p>
                        </div>
                        <span className="font-semibold">{formatCurrency(line.lineTotal)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </DetailSection>
            ),
          },
          {
            id: "receipts",
            label: "Receipts",
            content: (
              <DetailSection title="Receipts">
                {!order.receipts?.length ? (
                  <p className="text-sm text-muted-foreground">No receipts posted yet.</p>
                ) : (
                  <div className="space-y-2">
                    {order.receipts.map((receipt) => (
                      <div key={receipt.id} className="rounded-lg border p-3 text-sm">
                        <p className="font-medium">{receipt.reference}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(receipt.receivedAt)}
                          {receipt.notes ? ` — ${receipt.notes}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </DetailSection>
            ),
          },
        ] : undefined}
        sidebar={order ? (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Summary</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Status</span><StatusBadge status={order.status} /></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-semibold">{formatCurrency(order.total)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Lines</span><span>{order.items}</span></div>
            </CardContent>
          </Card>
        ) : undefined}
      />

      <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Receive {order?.reference}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label>Receipt reference</Label>
              <Input value={receiptRef} onChange={(e) => setReceiptRef(e.target.value)} placeholder="GRN-2026-001" />
            </div>
            {order?.lineItems?.map((line) => {
              const outstanding = line.quantityOrdered - line.quantityReceived;
              return (
                <div key={line.id} className="grid grid-cols-[1fr_120px] items-end gap-3">
                  <div>
                    <p className="text-sm font-medium">{line.description}</p>
                    <p className="text-xs text-muted-foreground">{outstanding} outstanding</p>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={outstanding}
                    value={received[line.id] ?? 0}
                    onChange={(e) => setReceived({ ...received, [line.id]: Number(e.target.value) })}
                  />
                </div>
              );
            })}
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea value={receiptNotes} onChange={(e) => setReceiptNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveOpen(false)}>Cancel</Button>
            <Button onClick={() => void receive()} disabled={saving || !receiptRef || !Object.values(received).some((q) => q > 0)}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Post receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleGuard>
  );
}
