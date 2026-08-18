import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { Loader2, ShoppingCart } from "lucide-react";
import { FormFieldError } from "@/components/shared/FormFieldError";
import { RequiredMark } from "@/components/shared/RequiredMark";
import { useFormValidation } from "@/hooks/useFormValidation";
import { fieldAria, fieldErrorClass, fieldRules } from "@/lib/formValidation";
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

const convertSchema = z.object({
  expectedDate: fieldRules.requiredString("Expected date"),
  unitCost: z.string().refine((v) => !v.trim() || (!Number.isNaN(Number(v)) && Number(v) >= 0), "Unit cost cannot be negative."),
});

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
  const convertRef = useRef<HTMLDivElement>(null);
  const {
    errors,
    shouldShow,
    validateAll,
    handleBlur,
    handleChange,
    applyApiErrors,
    reset: resetValidation,
  } = useFormValidation({
    fieldOrder: ["expectedDate", "unitCost"],
    schema: convertSchema,
  });

  const formValues = () => ({ expectedDate, unitCost });

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
    if (!validateAll(formValues(), undefined, convertRef.current)) return;
    setSaving(true);
    try {
      await api.convertStockPurchaseRequest(request.id, {
        expectedDate,
        unitCost: unitCost ? Number(unitCost) : undefined,
      });
      toast({ title: "Converted to purchase order" });
      setConvertOpen(false);
      resetValidation();
      await load();
    } catch (err) {
      if (!applyApiErrors(err, convertRef.current)) {
        toast.apiError(err, { fallback: "Unable to convert" });
      }
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
          <Button onClick={() => { resetValidation(); setConvertOpen(true); }}>
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

      <Dialog open={convertOpen} onOpenChange={(open) => { if (!open) resetValidation(); setConvertOpen(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" /> Convert to Purchase Order
            </DialogTitle>
          </DialogHeader>
          <form noValidate onSubmit={(e) => { e.preventDefault(); void convert(); }}>
            <div ref={convertRef} className="grid gap-3 py-2">
              <p className="text-sm text-muted-foreground">
                {request?.inventoryItem?.name} × {request?.quantity}
              </p>
              <div className="grid gap-2" data-field="expectedDate">
                <Label htmlFor="spr-detail-expected" className={shouldShow("expectedDate") ? "text-destructive" : undefined}>
                  Expected date
                  <RequiredMark />
                </Label>
                <Input
                  id="spr-detail-expected"
                  name="expectedDate"
                  type="date"
                  value={expectedDate}
                  className={fieldErrorClass(shouldShow("expectedDate"))}
                  {...fieldAria("expectedDate", shouldShow("expectedDate") ? errors.expectedDate : null)}
                  onChange={(e) => {
                    setExpectedDate(e.target.value);
                    handleChange("expectedDate", { expectedDate: e.target.value, unitCost });
                  }}
                  onBlur={() => handleBlur("expectedDate", formValues())}
                />
                {shouldShow("expectedDate") && <FormFieldError field="expectedDate" message={errors.expectedDate} />}
              </div>
              <div className="grid gap-2" data-field="unitCost">
                <Label htmlFor="spr-detail-unit-cost" className={shouldShow("unitCost") ? "text-destructive" : undefined}>Unit cost</Label>
                <Input
                  id="spr-detail-unit-cost"
                  name="unitCost"
                  type="number"
                  min={0}
                  value={unitCost}
                  className={fieldErrorClass(shouldShow("unitCost"))}
                  {...fieldAria("unitCost", shouldShow("unitCost") ? errors.unitCost : null)}
                  onChange={(e) => {
                    setUnitCost(e.target.value);
                    handleChange("unitCost", { expectedDate, unitCost: e.target.value });
                  }}
                  onBlur={() => handleBlur("unitCost", formValues())}
                />
                {shouldShow("unitCost") && <FormFieldError field="unitCost" message={errors.unitCost} />}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConvertOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create PO
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </RoleGuard>
  );
}
