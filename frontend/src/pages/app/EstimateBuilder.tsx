import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { EstimateItemsTable } from "@/components/estimates/EstimateItemsTable";
import { EstimateSummary } from "@/components/estimates/EstimateSummary";
import { EstimateWorkflowSteps } from "@/components/estimates/EstimateWorkflowSteps";
import { FormFieldError } from "@/components/shared/FormFieldError";
import { RequiredMark } from "@/components/shared/RequiredMark";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useFormValidation } from "@/hooks/useFormValidation";
import { fieldAria, fieldErrorClass, fieldRules, type FieldErrors } from "@/lib/formValidation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RoleGuard } from "@/components/auth/RoleGuard";
import {
  ApiError,
  api,
  type BackendCatalogItem,
  type BackendEstimate,
  type BackendCustomer,
  type BackendInventoryItem,
  type BackendServiceRequest,
  type EstimateLineInput,
} from "@/lib/api";
import { estimateStatusLabel, newEstimateLine, summarizeLines, workflowStepIndex } from "@/lib/estimates";
import { useSettings } from "@/context/SettingsContext";
import { defaultDatePlusDays, formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";

const estimateSchema = z.object({
  validUntil: fieldRules.requiredString("Valid until"),
});

function validateEstimateLines(lines: EstimateLineInput[]): FieldErrors {
  if (lines.some((line) => !line.description.trim() || line.quantity <= 0)) {
    return { lines: "Each line needs a description and quantity greater than 0." };
  }
  return {};
}

export default function EstimateBuilder() {
  const { ticketId } = useParams<{ ticketId?: string }>();
  const [searchParams] = useSearchParams();
  const customerIdParam = searchParams.get("customerId") ?? "";
  const equipmentIdParam = searchParams.get("equipmentId") ?? "";
  const navigate = useNavigate();
  const { settings } = useSettings();
  const taxDefault = settings?.defaultTaxRate ?? 0;

  const [ticket, setTicket] = useState<BackendServiceRequest | null>(null);
  const [party, setParty] = useState<BackendCustomer | null>(null);
  const [equipmentLabel, setEquipmentLabel] = useState("Sales quotation");
  const [estimate, setEstimate] = useState<BackendEstimate | null>(null);
  const [catalog, setCatalog] = useState<BackendCatalogItem[]>([]);
  const [inventory, setInventory] = useState<BackendInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [validUntil, setValidUntil] = useState(defaultDatePlusDays(14));
  const [discount, setDiscount] = useState(0);
  const [terms, setTerms] = useState("Payment due as agreed. Parts are subject to availability.");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<EstimateLineInput[]>([newEstimateLine(taxDefault)]);
  const formRef = useRef<HTMLDivElement>(null);
  const {
    errors,
    shouldShow,
    validateAll,
    handleBlur,
    handleChange,
    applyApiErrors,
    reset: resetValidation,
  } = useFormValidation<{ validUntil: string; lines: EstimateLineInput[] }>({
    fieldOrder: ["lines", "validUntil"],
    schema: estimateSchema,
    validate: (values) => validateEstimateLines(values.lines),
  });

  const load = useCallback(async () => {
    if (!ticketId && !customerIdParam) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [services, stockResult] = await Promise.all([
        api.listServiceCatalog(),
        api.listInventory({ limit: 100, page: 1 }),
      ]);
      const stock = stockResult.data;
      setCatalog(services.filter((s) => s.isActive));
      setInventory(stock);

      if (!ticketId && customerIdParam) {
        const [customer, equipmentList] = await Promise.all([
          api.getCustomer(customerIdParam),
          api.listEquipment({ customerId: customerIdParam, limit: 100, page: 1 }).then((r) => r.data).catch(() => []),
        ]);
        setTicket(null);
        setParty(customer);
        const matched = equipmentList.find((item) => item.id === equipmentIdParam);
        setEquipmentLabel(matched?.name ?? "Sales quotation");
        setEstimate(null);
        return;
      }

      const [sr, estimatesResult] = await Promise.all([
        api.getServiceRequest(ticketId!),
        api.listEstimates({ limit: 100, page: 1 }),
      ]);
      setTicket(sr);
      setParty(null);
      const estimates = estimatesResult.data;

      const existing = estimates.find((e) => e.serviceRequestId === ticketId || e.requestRef === sr.reference);
      const report = await api.getInspectionReport(ticketId!).catch(() => null);
      const partsReqs = (report?.recommendations ?? []).filter(
        (r) => r.inventoryItemId || r.type === "part" || r.title.toLowerCase().includes("inventory"),
      );

      if (existing) {
        const full = await api.getEstimate(existing.id);
        setEstimate(full);
        setValidUntil(full.validUntil?.slice(0, 10) || defaultDatePlusDays(14));
        setDiscount(Number(full.discount) || 0);
        setTerms(full.terms || "Payment due as agreed. Parts are subject to availability.");
        setNotes(full.notes || "");
        if (full.lineItems?.length) {
          setLines(
            full.lineItems.map((line) => ({
              type: line.type as EstimateLineInput["type"],
              description: line.description,
              catalogItemId: line.catalogItemId,
              inventoryItemId: line.inventoryItemId,
              partNumber: line.partNumber,
              quantity: Number(line.quantity),
              unitPrice: Number(line.unitPrice),
              taxRate: Number(line.taxRate),
              discount: Number(line.discount),
            })),
          );
        } else if (partsReqs.length) {
          setLines(
            partsReqs.map((r) => {
              const item = stock.find((i) => i.id === r.inventoryItemId);
              const delivery =
                item?.deliveryChargeType === "perUnit"
                  ? Number(item.deliveryCharge ?? 0) * Number(r.quantity)
                  : Number(item?.deliveryCharge ?? 0);
              return newEstimateLine(taxDefault, {
                type: "part",
                description: r.title,
                inventoryItemId: r.inventoryItemId,
                quantity: Number(r.quantity) || 1,
                unitPrice: Number(item?.sellingPrice ?? r.estimatedCost ?? item?.unitCost ?? 0) + delivery,
              });
            }),
          );
        }
      } else if (partsReqs.length) {
        setLines(
          partsReqs.map((r) => {
            const item = stock.find((i) => i.id === r.inventoryItemId);
            return newEstimateLine(taxDefault, {
              type: "part",
              description: r.title || item?.name || "Part",
              inventoryItemId: r.inventoryItemId,
              quantity: Number(r.quantity) || 1,
              unitPrice: Number(item?.sellingPrice ?? r.estimatedCost ?? item?.unitCost ?? 0),
            });
          }),
        );
      }
    } catch (err) {
      toast({
        title: "Unable to load estimate builder",
        description: err instanceof ApiError ? err.message : "Request failed",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [ticketId, customerIdParam, equipmentIdParam, taxDefault]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => summarizeLines(lines, discount), [lines, discount]);
  const formValues = useMemo(() => ({ validUntil, lines }), [validUntil, lines]);
  const inspection = ticket?.inspectionReport;
  const step = workflowStepIndex(estimate?.status, lines.some((l) => l.description.trim()), Boolean(validUntil));

  const persist = async (sendForApproval: boolean, thenPreview = false) => {
    if (!ticket && !party) return null;
    if (!validateAll(formValues, undefined, formRef.current)) return null;
    setSaving(true);
    try {
      const laborCost = lines.filter((l) => l.type !== "part").reduce((s, l) => s + l.quantity * l.unitPrice, 0);
      const partsCost = lines.filter((l) => l.type === "part").reduce((s, l) => s + l.quantity * l.unitPrice, 0);
      let target = estimate;
      if (!target) {
        target = await api.createEstimate({
          ...(ticketId && ticket
            ? { serviceRequestId: ticketId }
            : { customerId: party!.id, equipmentId: equipmentIdParam || undefined }),
          laborCost,
          partsCost,
          validUntil,
          status: "draft",
        });
      }
      const revised = await api.createEstimateRevision(target.id, {
        lines,
        discount,
        terms,
        notes,
        sendForApproval,
        status: sendForApproval ? "pendingAdminApproval" : "draft",
      });
      setEstimate(revised);
      toast({
        title: sendForApproval ? "Sent for approval" : thenPreview ? "Estimate saved" : "Draft saved",
      });
      resetValidation();
      if (sendForApproval) navigate(`/app/estimates/${revised.id}`);
      else if (thenPreview) navigate(`/app/estimates/${revised.id}/preview`);
      return revised;
    } catch (err) {
      if (!applyApiErrors(err, formRef.current)) {
        toast({
          title: "Save failed",
          description: err instanceof ApiError ? err.message : "Unable to save",
          variant: "destructive",
        });
      }
      return null;
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-40 animate-pulse rounded-lg bg-muted" />
        <div className="h-24 animate-pulse rounded-lg border bg-card" />
        <div className="h-64 animate-pulse rounded-lg border bg-card" />
      </div>
    );
  }

  return (
    <RoleGuard roles={["admin", "coordinator", "estimator"]}>
      <div className="space-y-5 pb-24">
        <div className="sticky top-0 z-20 -mx-1 space-y-3 border-b border-border bg-background/95 px-1 py-3 backdrop-blur">
          <Button variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground" asChild>
            <Link to={party && !ticket ? "/app/sales" : "/app/estimates"}>
              <ArrowLeft className="mr-1 h-4 w-4" /> {party && !ticket ? "Back to Sales" : "Back to Estimates"}
            </Link>
          </Button>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="page-title">Estimate Builder</h1>
                {estimate ? <StatusBadge status={estimate.status} label={estimateStatusLabel(estimate.status)} /> : null}
              </div>
              <p className="mt-1 font-mono text-sm">{estimate?.reference ?? "New estimate"}</p>
              <p className="text-sm text-muted-foreground">
                {ticket
                  ? `${ticket.customerName} · ${ticket.equipmentName ?? "Equipment"} · ${ticket.reference}`
                  : `${party?.name ?? "Customer"} · ${equipmentLabel}`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={saving} onClick={() => void persist(false)}>
                Save Draft
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => void persist(false, true)}
              >
                Preview
              </Button>
              <Button type="button" disabled={saving} onClick={() => setConfirmSend(true)}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send quotation
              </Button>
            </div>
          </div>
          <EstimateWorkflowSteps current={step} />
        </div>

        {inspection ? (
          <section className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
            <h2 className="section-title mb-3">Inspection Findings</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Equipment condition</p>
                <p className="mt-1 whitespace-pre-line text-muted-foreground">{inspection.findings || "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Recommended work</p>
                <p className="mt-1 whitespace-pre-line text-muted-foreground">{inspection.recommendation || "—"}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Inspector {inspection.reportedBy} · {formatDate(inspection.reportedAt)}
              </p>
              {ticketId ? (
                <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
                  <Link to={`/app/inspections/${ticketId}/report`}>View full inspection report</Link>
                </Button>
              ) : null}
            </div>
          </section>
        ) : null}

        {shouldShow("lines") && <FormFieldError field="lines" message={errors.lines} />}

        <div data-field="lines">
          <EstimateItemsTable
            mode="edit"
            lines={lines}
            taxDefault={taxDefault}
            catalog={catalog}
            inventory={inventory}
            invalid={shouldShow("lines")}
            onChange={(next) => {
              setLines(next);
              handleChange("lines", { validUntil, lines: next });
            }}
          />
        </div>

        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void persist(false);
          }}
        >
          <div ref={formRef} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section className="space-y-4 rounded-lg border border-border bg-card p-4">
              <h2 className="section-title">Commercial Details</h2>
              <div className="grid gap-2" data-field="validUntil">
                <Label htmlFor="valid-until" className={shouldShow("validUntil") ? "text-destructive" : undefined}>
                  Valid until
                  <RequiredMark />
                </Label>
                <Input
                  id="valid-until"
                  name="validUntil"
                  type="date"
                  value={validUntil}
                  className={fieldErrorClass(shouldShow("validUntil"))}
                  {...fieldAria("validUntil", shouldShow("validUntil") ? errors.validUntil : null)}
                  onChange={(e) => {
                    setValidUntil(e.target.value);
                    handleChange("validUntil", { validUntil: e.target.value, lines });
                  }}
                  onBlur={() => handleBlur("validUntil", formValues)}
                />
                {shouldShow("validUntil") && <FormFieldError field="validUntil" message={errors.validUntil} />}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="discount">Discount</Label>
                <Input id="discount" type="number" min={0} value={discount} onChange={(e) => setDiscount(Number(e.target.value) || 0)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="terms">Payment terms</Label>
                <Textarea id="terms" value={terms} onChange={(e) => setTerms(e.target.value)} rows={3} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">Internal notes</Label>
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
              </div>
            </section>
            <div className="lg:sticky lg:top-36">
              <EstimateSummary {...totals} />
            </div>
          </div>
        </form>

        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-4 py-3 no-print lg:hidden">
          <div className="mx-auto flex max-w-[1600px] gap-2">
            <Button className="flex-1" variant="outline" disabled={saving} onClick={() => void persist(false)}>
              Save Draft
            </Button>
            <Button className="flex-1" disabled={saving} onClick={() => setConfirmSend(true)}>
              Send for Approval
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={confirmSend} onOpenChange={setConfirmSend}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send this estimate for approval?</AlertDialogTitle>
            <AlertDialogDescription>
              The estimate will move to pending approval and can no longer be edited until a decision is made.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmSend(false);
                void persist(true);
              }}
            >
              Send for Approval
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RoleGuard>
  );
}
