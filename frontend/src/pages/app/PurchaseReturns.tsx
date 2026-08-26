import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Plus, Undo2 } from "lucide-react";
import { FormFieldError } from "@/components/shared/FormFieldError";
import { RequiredMark } from "@/components/shared/RequiredMark";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useFormValidation } from "@/hooks/useFormValidation";
import { fieldAria, fieldErrorClass, fieldRules, type FieldErrors } from "@/lib/formValidation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { api, type BackendPurchaseOrder, type BackendPurchaseReturn } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";

const RETURN_REASONS = [
  { value: "damaged", label: "Damaged" },
  { value: "excess", label: "Excess / over-supplied" },
  { value: "wrong_item", label: "Wrong item" },
  { value: "quality", label: "Quality issue" },
  { value: "other", label: "Other" },
] as const;

const headerSchema = z.object({
  purchaseOrderId: fieldRules.selectRequired("a purchase order"),
  reason: fieldRules.selectRequired("a reason"),
});

function returnableQty(line: { quantityReceived: number; quantityReturned?: number }) {
  return Math.max(0, line.quantityReceived - (line.quantityReturned ?? 0));
}

function validateQuantities(quantities: Record<string, number>, order: BackendPurchaseOrder | null): FieldErrors {
  if (!order?.lineItems?.length) return { quantities: "Select a received purchase order first." };
  if (!Object.values(quantities).some((qty) => qty > 0)) {
    return { quantities: "Enter a quantity to return for at least one line." };
  }
  return {};
}

export default function PurchaseReturns() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const rowsQuery = useQuery({
    queryKey: ["purchase-returns"],
    queryFn: () => api.listPurchaseReturns(),
  });
  const ordersQuery = useQuery({
    queryKey: ["purchase-orders", "returnable"],
    queryFn: () => api.listPurchaseOrders({ limit: 100, page: 1 }).then((r) => r.data),
  });

  const rows = rowsQuery.data ?? [];
  const returnableOrders = (ordersQuery.data ?? []).filter((order) => order.status === "received" || order.status === "partial");

  const [createOpen, setCreateOpen] = useState(false);
  const [purchaseOrderId, setPurchaseOrderId] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<BackendPurchaseOrder | null>(null);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const {
    errors,
    shouldShow,
    validateAll,
    handleChange,
    applyApiErrors,
    reset: resetValidation,
  } = useFormValidation<{ purchaseOrderId: string; reason: string; quantities: Record<string, number> }>({
    fieldOrder: ["purchaseOrderId", "reason", "quantities"],
    schema: headerSchema,
    validate: (values) => validateQuantities(values.quantities, selectedOrder),
  });

  const formValues = () => ({ purchaseOrderId, reason, quantities });

  const loadOrder = async (id: string) => {
    setPurchaseOrderId(id);
    handleChange("purchaseOrderId", { purchaseOrderId: id, reason, quantities: {} });
    setQuantities({});
    if (!id) {
      setSelectedOrder(null);
      return;
    }
    try {
      const order = await api.getPurchaseOrder(id);
      setSelectedOrder(order);
    } catch (error) {
      setSelectedOrder(null);
      toast.apiError(error, { fallback: "Failed to load purchase order" });
    }
  };

  const create = async () => {
    if (!validateAll(formValues(), undefined, dialogRef.current)) return;
    const lines = Object.entries(quantities)
      .filter(([, quantity]) => quantity > 0)
      .map(([purchaseOrderLineId, quantity]) => ({ purchaseOrderLineId, quantity }));
    setSaving(true);
    try {
      await api.createPurchaseReturn({
        purchaseOrderId,
        reason: reason as "damaged" | "excess" | "wrong_item" | "quality" | "other",
        notes: notes || undefined,
        lines,
      });
      setCreateOpen(false);
      setPurchaseOrderId("");
      setSelectedOrder(null);
      setReason("");
      setNotes("");
      setQuantities({});
      resetValidation();
      await queryClient.invalidateQueries({ queryKey: ["purchase-returns"] });
      toast({ title: "Purchase return posted", description: "Inventory quantities were reduced." });
    } catch (error) {
      if (!applyApiErrors(error, dialogRef.current)) {
        toast.apiError(error, { fallback: "Return failed" });
      }
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<BackendPurchaseReturn>[] = useMemo(() => [
    { key: "reference", header: "Return", render: (row) => <div className="flex items-center gap-2"><Undo2 className="h-4 w-4 text-primary" /><span className="font-mono font-medium">{row.reference}</span></div> },
    { key: "purchaseOrder", header: "PO", render: (row) => <span className="font-mono">{row.purchaseOrder?.reference ?? "—"}</span> },
    { key: "supplier", header: "Supplier", render: (row) => <span>{row.purchaseOrder?.supplier ?? "—"}</span> },
    { key: "items", header: "Lines", render: (row) => <span>{row.items}</span> },
    { key: "total", header: "Value", render: (row) => <span className="font-semibold">{formatCurrency(row.total)}</span> },
    { key: "reason", header: "Reason", render: (row) => <span className="capitalize">{(row.reason ?? "—").replace("_", " ")}</span> },
    { key: "returnedAt", header: "Returned", render: (row) => <span>{formatDate(row.returnedAt)}</span> },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
  ], []);

  return (
    <RoleGuard roles={["admin", "inventory"]}>
      <div className="space-y-6">
        <PageHeader
          title="Purchase Returns"
          description="Return received goods to suppliers and reduce on-hand stock."
          actions={<Button variant="brand" onClick={() => { resetValidation(); setCreateOpen(true); }}><Plus className="mr-1 h-4 w-4" /> New return</Button>}
        />
        <DataTable
          data={rows}
          columns={columns}
          searchKeys={["reference", "reason"]}
          emptyMessage="No purchase returns."
          emptyHint="Return items from a received purchase order."
          loading={rowsQuery.isLoading}
          error={rowsQuery.error as Error | null}
          onRetry={() => void rowsQuery.refetch()}
          onRowClick={(row) => navigate(`/app/purchase-returns/${row.id}`)}
        />
        <Dialog open={createOpen} onOpenChange={(open) => { if (!open) resetValidation(); setCreateOpen(open); }}>
          <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
            <DialogHeader><DialogTitle>New purchase return</DialogTitle></DialogHeader>
            <form noValidate onSubmit={(e) => { e.preventDefault(); void create(); }}>
              <div ref={dialogRef} className="grid gap-4 py-2">
                <div className="grid gap-2" data-field="purchaseOrderId">
                  <Label className={shouldShow("purchaseOrderId") ? "text-destructive" : undefined}>Purchase order<RequiredMark /></Label>
                  <Select value={purchaseOrderId} onValueChange={(value) => void loadOrder(value)}>
                    <SelectTrigger className={fieldErrorClass(shouldShow("purchaseOrderId"))} {...fieldAria("purchaseOrderId", shouldShow("purchaseOrderId") ? errors.purchaseOrderId : null)}>
                      <SelectValue placeholder="Select a received PO" />
                    </SelectTrigger>
                    <SelectContent>
                      {returnableOrders.map((order) => (
                        <SelectItem key={order.id} value={order.id}>{order.reference} · {order.supplier}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {shouldShow("purchaseOrderId") && <FormFieldError field="purchaseOrderId" message={errors.purchaseOrderId} />}
                </div>
                <div className="grid gap-2" data-field="reason">
                  <Label className={shouldShow("reason") ? "text-destructive" : undefined}>Reason<RequiredMark /></Label>
                  <Select value={reason} onValueChange={(value) => { setReason(value); handleChange("reason", { purchaseOrderId, reason: value, quantities }); }}>
                    <SelectTrigger className={fieldErrorClass(shouldShow("reason"))} {...fieldAria("reason", shouldShow("reason") ? errors.reason : null)}>
                      <SelectValue placeholder="Select reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {RETURN_REASONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {shouldShow("reason") && <FormFieldError field="reason" message={errors.reason} />}
                </div>
                {shouldShow("quantities") && <FormFieldError field="quantities" message={errors.quantities} />}
                {selectedOrder?.lineItems?.map((line) => {
                  const max = returnableQty(line);
                  return (
                    <div key={line.id} className="grid grid-cols-[1fr_120px] items-end gap-3" data-field="quantities">
                      <div>
                        <p className="text-sm font-medium">{line.description}</p>
                        <p className="text-xs text-muted-foreground">{line.sku} · {max} returnable</p>
                      </div>
                      <Input
                        type="number"
                        min={0}
                        max={max}
                        disabled={max === 0}
                        value={quantities[line.id] ?? 0}
                        onChange={(event) => {
                          const next = { ...quantities, [line.id]: Number(event.target.value) };
                          setQuantities(next);
                          handleChange("quantities", { purchaseOrderId, reason, quantities: next });
                        }}
                      />
                    </div>
                  );
                })}
                <div className="grid gap-2">
                  <Label htmlFor="return-notes">Notes</Label>
                  <Textarea id="return-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={saving}>Post return</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </RoleGuard>
  );
}
