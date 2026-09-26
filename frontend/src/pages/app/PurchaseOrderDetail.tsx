import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { Loader2, PackageCheck, Undo2 } from "lucide-react";
import { FormFieldError } from "@/components/shared/FormFieldError";
import { RequiredMark } from "@/components/shared/RequiredMark";
import { useFormValidation } from "@/hooks/useFormValidation";
import { fieldAria, fieldErrorClass, fieldRules, type FieldErrors } from "@/lib/formValidation";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError, type BackendPurchaseOrder } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";

const receiveSchema = z.object({
  receiptRef: fieldRules.requiredString("Receipt reference"),
  receiptNotes: fieldRules.optionalString(),
});

function validateReceivedQuantities(received: Record<string, number>): FieldErrors {
  if (!Object.values(received).some((quantity) => quantity > 0)) {
    return { received: "Enter a quantity to receive for at least one line." };
  }
  return {};
}

function returnableQty(line: { quantityReceived: number; quantityReturned?: number }) {
  return Math.max(0, line.quantityReceived - (line.quantityReturned ?? 0));
}

const returnSchema = z.object({
  returnReason: fieldRules.selectRequired("a reason"),
});

function validateReturnQuantities(quantities: Record<string, number>): FieldErrors {
  if (!Object.values(quantities).some((quantity) => quantity > 0)) {
    return { returnQty: "Enter a quantity to return for at least one line." };
  }
  return {};
}

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
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [returnNotes, setReturnNotes] = useState("");
  const [returnQty, setReturnQty] = useState<Record<string, number>>({});
  const [freightCost, setFreightCost] = useState("");
  const [customsCost, setCustomsCost] = useState("");
  const [insuranceCost, setInsuranceCost] = useState("");
  const [supplierReference, setSupplierReference] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [courier, setCourier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [customsInfo, setCustomsInfo] = useState("");
  const [etd, setEtd] = useState("");
  const [eta, setEta] = useState("");
  const [shipmentNotes, setShipmentNotes] = useState("");
  const [savingLanded, setSavingLanded] = useState(false);
  const [savingShipment, setSavingShipment] = useState(false);
  const tab = searchParams.get("tab") ?? "overview";
  const stage = searchParams.get("stage");
  const receiveRef = useRef<HTMLDivElement>(null);
  const returnRef = useRef<HTMLDivElement>(null);
  const stageOpenedRef = useRef<string | null>(null);
  const {
    errors,
    shouldShow,
    validateAll,
    handleBlur,
    handleChange,
    applyApiErrors,
    reset: resetValidation,
  } = useFormValidation<{ receiptRef: string; receiptNotes: string; received: Record<string, number> }>({
    fieldOrder: ["receiptRef", "received"],
    schema: receiveSchema,
    validate: (values) => validateReceivedQuantities(values.received),
  });
  const returnForm = useFormValidation<{ returnReason: string; returnQty: Record<string, number> }>({
    fieldOrder: ["returnReason", "returnQty"],
    schema: returnSchema,
    validate: (values) => validateReturnQuantities(values.returnQty),
  });

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const po = await api.getPurchaseOrder(id);
      setOrder(po);
      setFreightCost(po.freightCost != null ? String(po.freightCost) : "");
      setCustomsCost(po.customsCost != null ? String(po.customsCost) : "");
      setInsuranceCost(po.insuranceCost != null ? String(po.insuranceCost) : "");
      setSupplierReference(po.supplierReference ?? "");
      setCurrency(po.currency || "INR");
      setCourier(po.shipment?.courier ?? "");
      setTrackingNumber(po.shipment?.trackingNumber ?? "");
      setCustomsInfo(po.shipment?.customsInfo ?? "");
      setEtd(po.shipment?.etd ? po.shipment.etd.slice(0, 10) : "");
      setEta(po.shipment?.eta ? po.shipment.eta.slice(0, 10) : "");
      setShipmentNotes(po.shipment?.notes ?? "");
      if (po.shipment?.freightCost != null) {
        setFreightCost(String(po.shipment.freightCost));
      }
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

  useEffect(() => {
    if (!order) return;
    const key = `${order.id}:${stage ?? ""}`;
    if (stageOpenedRef.current === key) return;
    stageOpenedRef.current = key;
    if (stage === "grn" && order.lineItems?.length && order.status !== "received" && order.status !== "cancelled") {
      setReceiveOpen(true);
    }
    if (stage === "customs" || stage === "landed") {
      window.requestAnimationFrame(() => {
        document.getElementById("po-customs-cost")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
    if (stage === "shipment") {
      window.requestAnimationFrame(() => {
        document.getElementById("po-shipment")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [order, stage]);

  const receive = async () => {
    if (!order) return;
    const values = { receiptRef, receiptNotes, received };
    if (!validateAll(values, undefined, receiveRef.current)) return;
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
      resetValidation();
      toast({ title: "Purchase receipt posted", description: "Inventory quantities were updated." });
      await load();
    } catch (err) {
      if (!applyApiErrors(err, receiveRef.current)) {
        toast.apiError(err, { fallback: "Receive failed" });
      }
    } finally {
      setSaving(false);
    }
  };

  const postReturn = async () => {
    if (!order) return;
    if (!returnForm.validateAll({ returnReason, returnQty }, undefined, returnRef.current)) return;
    const lines = Object.entries(returnQty)
      .filter(([, quantity]) => quantity > 0)
      .map(([purchaseOrderLineId, quantity]) => ({ purchaseOrderLineId, quantity }));
    setSaving(true);
    try {
      await api.createPurchaseReturn({
        purchaseOrderId: order.id,
        reason: returnReason as "damaged" | "excess" | "wrong_item" | "quality" | "other",
        notes: returnNotes || undefined,
        lines,
      });
      setReturnOpen(false);
      setReturnReason("");
      setReturnNotes("");
      setReturnQty({});
      returnForm.reset();
      toast({ title: "Purchase return posted", description: "Inventory quantities were reduced." });
      await load();
    } catch (err) {
      if (!returnForm.applyApiErrors(err, returnRef.current)) {
        toast.apiError(err, { fallback: "Return failed" });
      }
    } finally {
      setSaving(false);
    }
  };

  const canReceive = Boolean(order?.lineItems?.length && order.status !== "received" && order.status !== "cancelled");
  const canReturn = Boolean(order?.lineItems?.some((line) => returnableQty(line) > 0));
  const canEditLanded = Boolean(order && order.status !== "received" && order.status !== "cancelled");

  const saveShipment = async () => {
    if (!order) return;
    setSavingShipment(true);
    try {
      await api.upsertPurchaseShipment(order.id, {
        courier: courier.trim() || null,
        trackingNumber: trackingNumber.trim() || null,
        freightCost: freightCost ? Number(freightCost) : null,
        customsInfo: customsInfo.trim() || null,
        etd: etd || null,
        eta: eta || null,
        notes: shipmentNotes.trim() || null,
      });
      toast({ title: "Shipment saved", description: "Freight is included in landed cost on GRN." });
      await load();
    } catch (err) {
      toast.apiError(err, { fallback: "Failed to save shipment" });
    } finally {
      setSavingShipment(false);
    }
  };

  const saveLandedCosts = async () => {
    if (!order) return;
    setSavingLanded(true);
    try {
      await api.updatePurchaseLandedCosts(order.id, {
        freightCost: freightCost ? Number(freightCost) : null,
        customsCost: customsCost ? Number(customsCost) : null,
        insuranceCost: insuranceCost ? Number(insuranceCost) : null,
        supplierReference: supplierReference.trim() || null,
        currency: currency.trim() || "INR",
      });
      toast({ title: "Customs & import costs updated", description: "Landed cost applies when you post a goods receipt." });
      await load();
    } catch (err) {
      toast.apiError(err, { fallback: "Failed to update landed costs" });
    } finally {
      setSavingLanded(false);
    }
  };

  const stageBack =
    stage === "grn" || stage === "shipment" || stage === "customs" || stage === "stock" || stage === "landed"
      ? `/app/purchase-orders?stage=${stage === "landed" ? "customs" : stage}`
      : "/app/purchase-orders";
  const stageBackLabel =
    stage === "grn"
      ? "Back to GRN"
      : stage === "shipment"
        ? "Back to Shipment"
        : stage === "customs" || stage === "landed"
          ? "Back to Customs"
          : stage === "stock"
            ? "Back to Stock"
            : "Back to Purchase";

  return (
    <RoleGuard roles={["admin", "inventory"]}>
      <RecordDetailLayout
        backTo={stageBack}
        backLabel={stageBackLabel}
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
        actions={(canReceive || canReturn) ? (
          <div className="flex gap-2">
            {canReturn ? (
              <Button variant="outline" onClick={() => setReturnOpen(true)}>
                <Undo2 className="mr-1 h-4 w-4" /> Return items
              </Button>
            ) : null}
            {canReceive ? (
              <Button onClick={() => setReceiveOpen(true)}>
                <PackageCheck className="mr-1 h-4 w-4" /> Receive items
              </Button>
            ) : null}
          </div>
        ) : undefined}
        activeTab={tab}
        onTabChange={(value) => {
          const next = new URLSearchParams();
          if (stage) next.set("stage", stage);
          if (value !== "overview") next.set("tab", value);
          setSearchParams(next);
        }}
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
                      { label: "Supplier ref", value: order.supplierReference?.trim() || "—" },
                      { label: "Currency", value: order.currency || "INR" },
                      { label: "Expected", value: formatDate(order.expectedDate) },
                      { label: "Status", value: order.status },
                      { label: "Merchandise total", value: formatCurrency(order.total) },
                      { label: "Landed cost total", value: order.landedCostTotal != null ? formatCurrency(order.landedCostTotal) : "—" },
                      { label: "Created", value: formatDate(order.createdAt) },
                      { label: "Updated", value: formatDate(order.updatedAt) },
                    ]}
                  />
                </DetailSection>

                <DetailSection title="Shipment (freight · courier · tracking · ETD/ETA)">
                  <div id="po-shipment" />
                  <p className="mb-3 text-sm text-muted-foreground">
                    Track inbound logistics. Freight rolls into landed cost = purchase + freight + customs + other import costs.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1">
                      <Label htmlFor="po-courier">Courier</Label>
                      <Input id="po-courier" value={courier} disabled={!canEditLanded} onChange={(e) => setCourier(e.target.value)} placeholder="DHL / FedEx / …" />
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor="po-tracking">Tracking number</Label>
                      <Input id="po-tracking" value={trackingNumber} disabled={!canEditLanded} onChange={(e) => setTrackingNumber(e.target.value)} />
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor="po-etd">ETD</Label>
                      <Input id="po-etd" type="date" value={etd} disabled={!canEditLanded} onChange={(e) => setEtd(e.target.value)} />
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor="po-eta">ETA</Label>
                      <Input id="po-eta" type="date" value={eta} disabled={!canEditLanded} onChange={(e) => setEta(e.target.value)} />
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor="po-ship-freight">Freight cost</Label>
                      <Input id="po-ship-freight" type="number" min={0} step="0.01" value={freightCost} disabled={!canEditLanded} onChange={(e) => setFreightCost(e.target.value)} />
                    </div>
                    <div className="grid gap-1 sm:col-span-2">
                      <Label htmlFor="po-customs-info">Customs information</Label>
                      <Textarea id="po-customs-info" rows={2} value={customsInfo} disabled={!canEditLanded} onChange={(e) => setCustomsInfo(e.target.value)} placeholder="HS code, clearance notes…" />
                    </div>
                    <div className="grid gap-1 sm:col-span-2">
                      <Label htmlFor="po-ship-notes">Notes</Label>
                      <Textarea id="po-ship-notes" rows={2} value={shipmentNotes} disabled={!canEditLanded} onChange={(e) => setShipmentNotes(e.target.value)} />
                    </div>
                  </div>
                  {canEditLanded ? (
                    <Button className="mt-3" size="sm" disabled={savingShipment} onClick={() => void saveShipment()}>
                      {savingShipment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Save shipment
                    </Button>
                  ) : null}
                </DetailSection>

                <DetailSection title="Customs & landed cost">
                  <div id="po-customs-cost" />
                  <p className="mb-3 text-sm text-muted-foreground">
                    Landed cost = purchase cost + freight + customs + other allocated import costs (insurance). On GRN, extras update inventory unit cost.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="grid gap-1">
                      <Label htmlFor="po-supplier-ref">Supplier reference</Label>
                      <Input id="po-supplier-ref" value={supplierReference} disabled={!canEditLanded} onChange={(e) => setSupplierReference(e.target.value)} placeholder="Supplier PO / invoice #" />
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor="po-currency">Currency</Label>
                      <Input id="po-currency" value={currency} disabled={!canEditLanded} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={10} />
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor="po-detail-freight">Freight</Label>
                      <Input id="po-detail-freight" type="number" min={0} step="0.01" value={freightCost} disabled={!canEditLanded} onChange={(e) => setFreightCost(e.target.value)} />
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor="po-detail-customs">Customs</Label>
                      <Input id="po-detail-customs" type="number" min={0} step="0.01" value={customsCost} disabled={!canEditLanded} onChange={(e) => setCustomsCost(e.target.value)} />
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor="po-detail-insurance">Other import (insurance)</Label>
                      <Input id="po-detail-insurance" type="number" min={0} step="0.01" value={insuranceCost} disabled={!canEditLanded} onChange={(e) => setInsuranceCost(e.target.value)} />
                    </div>
                  </div>
                  {canEditLanded ? (
                    <Button className="mt-3" size="sm" disabled={savingLanded} onClick={() => void saveLandedCosts()}>
                      {savingLanded ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Save customs & costs
                    </Button>
                  ) : null}
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
                            {line.sku} · {line.quantityReceived}/{line.quantityOrdered} received · {line.quantityReturned ?? 0} returned · {formatCurrency(line.unitCost)} ea
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
          {
            id: "returns",
            label: "Returns",
            content: (
              <DetailSection title="Returns">
                {!order.purchaseReturns?.length ? (
                  <p className="text-sm text-muted-foreground">No purchase returns posted yet.</p>
                ) : (
                  <div className="space-y-2">
                    {order.purchaseReturns.map((row) => (
                      <div key={row.id} className="rounded-lg border p-3 text-sm">
                        <p className="font-medium">{row.reference}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(row.returnedAt)} · {(row.reason ?? "return").replace("_", " ")}
                          {row.notes ? ` — ${row.notes}` : ""}
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
              <div className="flex justify-between"><span className="text-muted-foreground">Merchandise</span><span className="font-semibold">{formatCurrency(order.total)}</span></div>
              {order.landedCostTotal != null ? (
                <div className="flex justify-between"><span className="text-muted-foreground">Landed total</span><span className="font-semibold">{formatCurrency(order.landedCostTotal)}</span></div>
              ) : null}
              <div className="flex justify-between"><span className="text-muted-foreground">Lines</span><span>{order.items}</span></div>
            </CardContent>
          </Card>
        ) : undefined}
      />

      <Dialog open={receiveOpen} onOpenChange={(open) => { if (!open) resetValidation(); setReceiveOpen(open); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Receive {order?.reference}</DialogTitle></DialogHeader>
          <form noValidate onSubmit={(e) => { e.preventDefault(); void receive(); }}>
          <div ref={receiveRef} className="grid gap-3 py-2">
            <div className="grid gap-2" data-field="receiptRef">
              <Label htmlFor="receipt-ref" className={shouldShow("receiptRef") ? "text-destructive" : undefined}>
                Receipt reference
                <RequiredMark />
              </Label>
              <Input
                id="receipt-ref"
                name="receiptRef"
                value={receiptRef}
                placeholder="GRN-2026-001"
                className={fieldErrorClass(shouldShow("receiptRef"))}
                {...fieldAria("receiptRef", shouldShow("receiptRef") ? errors.receiptRef : null)}
                onChange={(e) => {
                  setReceiptRef(e.target.value);
                  handleChange("receiptRef", { receiptRef: e.target.value, receiptNotes, received });
                }}
                onBlur={() => handleBlur("receiptRef", { receiptRef, receiptNotes, received })}
              />
              {shouldShow("receiptRef") && <FormFieldError field="receiptRef" message={errors.receiptRef} />}
            </div>
            {shouldShow("received") && <FormFieldError field="received" message={errors.received} />}
            {order?.lineItems?.map((line) => {
              const outstanding = line.quantityOrdered - line.quantityReceived;
              return (
                <div key={line.id} className="grid grid-cols-[1fr_120px] items-end gap-3" data-field="received">
                  <div>
                    <p className="text-sm font-medium">{line.description}</p>
                    <p className="text-xs text-muted-foreground">{outstanding} outstanding</p>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={outstanding}
                    value={received[line.id] ?? 0}
                    onChange={(e) => {
                      const next = { ...received, [line.id]: Number(e.target.value) };
                      setReceived(next);
                      handleChange("received", { receiptRef, receiptNotes, received: next });
                    }}
                  />
                </div>
              );
            })}
            <div className="grid gap-2">
              <Label htmlFor="receipt-notes">Notes</Label>
              <Textarea id="receipt-notes" value={receiptNotes} onChange={(e) => setReceiptNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReceiveOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Post receipt
            </Button>
          </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={returnOpen} onOpenChange={(open) => { if (!open) returnForm.reset(); setReturnOpen(open); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Return items from {order?.reference}</DialogTitle></DialogHeader>
          <form noValidate onSubmit={(e) => { e.preventDefault(); void postReturn(); }}>
            <div ref={returnRef} className="grid gap-3 py-2">
              <div className="grid gap-2" data-field="returnReason">
                <Label className={returnForm.shouldShow("returnReason") ? "text-destructive" : undefined}>
                  Reason
                  <RequiredMark />
                </Label>
                <Select value={returnReason} onValueChange={(value) => { setReturnReason(value); returnForm.handleChange("returnReason", { returnReason: value, returnQty }); }}>
                  <SelectTrigger className={fieldErrorClass(returnForm.shouldShow("returnReason"))} {...fieldAria("returnReason", returnForm.shouldShow("returnReason") ? returnForm.errors.returnReason : null)}>
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="damaged">Damaged</SelectItem>
                    <SelectItem value="excess">Excess / over-supplied</SelectItem>
                    <SelectItem value="wrong_item">Wrong item</SelectItem>
                    <SelectItem value="quality">Quality issue</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {returnForm.shouldShow("returnReason") && <FormFieldError field="returnReason" message={returnForm.errors.returnReason} />}
              </div>
              {returnForm.shouldShow("returnQty") && <FormFieldError field="returnQty" message={returnForm.errors.returnQty} />}
              {order?.lineItems?.map((line) => {
                const max = returnableQty(line);
                return (
                  <div key={line.id} className="grid grid-cols-[1fr_120px] items-end gap-3" data-field="returnQty">
                    <div>
                      <p className="text-sm font-medium">{line.description}</p>
                      <p className="text-xs text-muted-foreground">{max} returnable</p>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      max={max}
                      disabled={max === 0}
                      value={returnQty[line.id] ?? 0}
                      onChange={(e) => {
                        const next = { ...returnQty, [line.id]: Number(e.target.value) };
                        setReturnQty(next);
                        returnForm.handleChange("returnQty", { returnReason, returnQty: next });
                      }}
                    />
                  </div>
                );
              })}
              <div className="grid gap-2">
                <Label htmlFor="return-notes">Notes</Label>
                <Textarea id="return-notes" value={returnNotes} onChange={(e) => setReturnNotes(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setReturnOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Post return
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </RoleGuard>
  );
}
