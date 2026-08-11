import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Loader2, ShoppingCart } from "lucide-react";
import {
  DetailInfoGrid,
  DetailSection,
  RecordDetailLayout,
} from "@/components/shared/RecordDetailLayout";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { ApiError, api, type BackendStockPurchaseRequest } from "@/lib/api";
import { defaultDatePlusDays, formatCurrency, formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";

export default function StockPurchaseRequestDetail() {
  const { id = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const canConvert = user?.role === "admin" || user?.role === "inventory";
  const [request, setRequest] = useState<BackendStockPurchaseRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [convertOpen, setConvertOpen] = useState(false);
  const [expectedDate, setExpectedDate] = useState(defaultDatePlusDays(7));
  const [unitCost, setUnitCost] = useState("");
  const [saving, setSaving] = useState(false);
  const tab = searchParams.get("tab") ?? "overview";

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const record = await api.getStockPurchaseRequest(id);
      setRequest(record);
      setUnitCost(String(record.inventoryItem?.unitCost ?? ""));
    } catch (err) {
      setRequest(null);
      setError(err instanceof ApiError && err.status === 404 ? null : "Please try again.");
      if (!(err instanceof ApiError && err.status === 404)) {
        toast.apiError(err, { fallback: "Failed to load request" });
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const convert = async () => {
    if (!request) return;
    setSaving(true);
    try {
      const result = await api.convertStockPurchaseRequest(request.id, {
        expectedDate,
        unitCost: unitCost ? Number(unitCost) : undefined,
      });
      toast({ title: "Converted to purchase order" });
      setConvertOpen(false);
      await load();
      if (result.purchaseOrder?.id) {
        // stay on page; user can open PO via link after reload
      }
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to convert" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <RoleGuard roles={["admin", "inventory", "inspector", "engineer"]}>
      <RecordDetailLayout
        backTo="/app/stock-purchase-requests"
        backLabel="Back to Stock Purchase Requests"
        title={request?.inventoryItem?.name ?? "Stock purchase request"}
        subtitle={request ? (
          <>
            {request.inventoryItem?.sku ?? request.inventoryItemId}
            {" · "}Qty {request.quantity}
          </>
        ) : undefined}
        meta={request ? [
          { label: "Status", value: request.status },
          { label: "Requested", value: formatDate(request.createdAt) },
        ] : undefined}
        loading={loading}
        error={error}
        notFound={!loading && !error && !request}
        notFoundTitle="Request not found"
        notFoundDescription="The requested stock purchase request could not be found."
        onRetry={() => void load()}
        actions={canConvert && request?.status === "open" ? (
          <Button onClick={() => setConvertOpen(true)}>
            <ShoppingCart className="mr-1 h-4 w-4" /> Convert to PO
          </Button>
        ) : undefined}
        activeTab={tab}
        onTabChange={(value) => setSearchParams(value === "overview" ? {} : { tab: value })}
        tabs={request ? [
          {
            id: "overview",
            label: "Overview",
            content: (
              <div className="space-y-4">
                <DetailSection title="Request details">
                  <DetailInfoGrid
                    items={[
                      { label: "Item", value: request.inventoryItem?.name ?? request.inventoryItemId },
                      { label: "SKU", value: request.inventoryItem?.sku ?? "—" },
                      { label: "Quantity", value: String(request.quantity) },
                      { label: "Status", value: request.status },
                      { label: "Requested by", value: request.requestedBy },
                      { label: "Requested on", value: formatDate(request.createdAt) },
                      { label: "Unit cost", value: formatCurrency(request.inventoryItem?.unitCost ?? 0) },
                      {
                        label: "Linked job",
                        value: request.jobId ? (
                          <Link className="text-primary hover:underline normal-case" to={`/app/jobs/${request.jobId}`}>View job</Link>
                        ) : "—",
                      },
                      {
                        label: "Linked ticket",
                        value: request.serviceRequestId ? (
                          <Link className="text-primary hover:underline normal-case" to={`/app/service-tickets/${request.serviceRequestId}`}>View ticket</Link>
                        ) : "—",
                      },
                      {
                        label: "Purchase order",
                        value: request.purchaseOrderId ? (
                          <Link className="text-primary hover:underline normal-case" to={`/app/purchase-orders/${request.purchaseOrderId}`}>View PO</Link>
                        ) : "—",
                      },
                    ]}
                  />
                </DetailSection>
                {request.note ? (
                  <DetailSection title="Reason / note">
                    <p className="text-sm text-muted-foreground">{request.note}</p>
                  </DetailSection>
                ) : null}
              </div>
            ),
          },
        ] : undefined}
        sidebar={request ? (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Status</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Badge variant={request.status === "open" ? "default" : "secondary"}>{request.status}</Badge>
              {request.inventoryItemId ? (
                <Button asChild variant="outline" className="w-full" size="sm">
                  <Link to={`/app/inventory/${request.inventoryItemId}`}>View inventory item</Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : undefined}
      />

      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" /> Convert to Purchase Order
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <p className="text-sm text-muted-foreground">
              {request?.inventoryItem?.name} × {request?.quantity}
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
            <Button variant="outline" onClick={() => setConvertOpen(false)}>Cancel</Button>
            <Button disabled={saving} onClick={() => void convert()}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create PO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleGuard>
  );
}
