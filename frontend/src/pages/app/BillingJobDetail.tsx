import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, FileText, Loader2, ShieldCheck } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { SERVICE_BILLING_ROLES } from "@/config/roles";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  BillingEngineerExtras,
  BillingEstimateDetails,
  BillingJobFacts,
  BillingServiceNotes,
  ChargeBreakdown,
  InfoRow,
} from "@/components/billing/billing-ui";
import { InvoiceLineEditor } from "@/components/billing/InvoiceLineEditor";
import {
  ApiError,
  api,
  type BackendCatalogItem,
  type BackendInventoryItem,
  type BillingJobContext,
  type InvoiceLineInput,
} from "@/lib/api";
import { extraLineTotal, lineAmount, summarizeChargeGroups } from "@/lib/billingCharges";
import { defaultDatePlusDays, formatCurrency, formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";

function toDateInput(value: string | null | undefined) {
  if (!value) return "";
  return value.slice(0, 10);
}

function warrantyDisplay(noWarranty: boolean | undefined, start: string | null | undefined, end: string | null | undefined) {
  if (noWarranty) return "No warranty";
  if (end) return formatDate(end);
  if (start) return formatDate(start);
  return "—";
}

export default function BillingJobDetail() {
  const { jobId = "" } = useParams();
  const navigate = useNavigate();
  const [context, setContext] = useState<BillingJobContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [warrantySaving, setWarrantySaving] = useState(false);
  const [dueAt, setDueAt] = useState(defaultDatePlusDays(30));
  const [additionalLines, setAdditionalLines] = useState<InvoiceLineInput[]>([]);
  const [inventory, setInventory] = useState<BackendInventoryItem[]>([]);
  const [catalog, setCatalog] = useState<BackendCatalogItem[]>([]);
  const [warrantyForm, setWarrantyForm] = useState({
    serviceWarrantyStart: "",
    serviceWarrantyEnd: "",
    noServiceWarranty: false,
  });

  const load = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    try {
      const next = await api.getBillingJobContext(jobId);
      setContext(next);
      const equipment = next.job.equipment;
      setWarrantyForm({
        serviceWarrantyStart: toDateInput(equipment?.serviceWarrantyStart),
        serviceWarrantyEnd: toDateInput(equipment?.serviceWarrantyEnd),
        noServiceWarranty: Boolean(equipment?.noServiceWarranty),
      });
    } catch (error) {
      toast({
        title: "Unable to load billing job",
        description: error instanceof ApiError ? error.message : "Request failed",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    void Promise.all([
      api.listInventory({ limit: 100, page: 1, status: "active" }).then((res) => setInventory(res.data)).catch(() => setInventory([])),
      api.listServiceCatalog().then(setCatalog).catch(() => setCatalog([])),
    ]);
  }, []);

  const charges = useMemo(() => {
    const estimateLines = (context?.job.estimate?.lineItems ?? []).map((line) => ({
      type: line.type,
      quantity: Number(line.quantity),
      unitPrice: Number(line.unitPrice),
      discount: Number(line.discount),
      taxRate: Number(line.taxRate),
      lineTotal: Number(line.lineTotal),
    }));
    const extraLines = (context?.job.extras ?? [])
      .filter((extra) => extra.status === "approved")
      .map((extra) => ({
        type: extra.type || "product",
        quantity: Number(extra.quantity),
        unitPrice: Number(extra.unitPrice),
        taxRate: Number(extra.taxRate),
        lineTotal: extraLineTotal(extra),
      }));
    const billingLines = additionalLines
      .filter((line) => line.description.trim())
      .map((line) => ({
        type: line.type || "other",
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discount: line.discount,
        taxRate: line.taxRate,
        lineTotal: lineAmount(line),
      }));
    return summarizeChargeGroups([...estimateLines, ...extraLines, ...billingLines]);
  }, [context, additionalLines]);

  const equipment = context?.job.equipment ?? null;
  const equipmentWarrantyPayload = warrantyForm.noServiceWarranty
    ? {
        noServiceWarranty: true,
        serviceWarrantyStart: null,
        serviceWarrantyEnd: null,
      }
    : {
        noServiceWarranty: false,
        serviceWarrantyStart: warrantyForm.serviceWarrantyStart || null,
        serviceWarrantyEnd: warrantyForm.serviceWarrantyEnd || null,
      };

  const saveWarranty = async () => {
    if (!equipment) {
      toast.error("No equipment is linked to this job.");
      return;
    }
    setWarrantySaving(true);
    try {
      const updated = await api.updateEquipment(equipment.id, equipmentWarrantyPayload);
      setContext((prev) =>
        prev
          ? {
              ...prev,
              job: {
                ...prev.job,
                equipment: updated,
              },
            }
          : prev,
      );
      toast.success(
        warrantyForm.noServiceWarranty ? "Marked as no service warranty" : "Service warranty updated",
      );
      await load();
    } catch (error) {
      toast.apiError(error, { fallback: "Unable to update service warranty" });
    } finally {
      setWarrantySaving(false);
    }
  };

  const generateInvoice = async () => {
    setSaving(true);
    try {
      if (equipment) {
        await api.updateEquipment(equipment.id, equipmentWarrantyPayload).catch(() => undefined);
      }
      const invoice = await api.createInvoiceFromJob(
        jobId,
        new Date(dueAt).toISOString(),
        "INR",
        additionalLines.filter((line) => line.description.trim()),
        equipment ? equipmentWarrantyPayload : undefined,
      );
      toast({ title: "Final invoice generated", description: `Amount ${formatCurrency(invoice.total)}` });
      navigate(`/app/billing/invoices/${invoice.id}`);
    } catch (error) {
      toast.apiError(error, { fallback: "Request failed" });
    } finally { setSaving(false); }
  };

  const invoice = context?.invoice ?? null;

  return (
    <RoleGuard roles={SERVICE_BILLING_ROLES}>
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/app/billing"><ArrowLeft className="mr-1 h-4 w-4" /> Back to queue</Link>
          </Button>
        </div>

        <PageHeader
          title={context ? `Billing review — ${context.job.reference}` : "Billing review"}
          description="Review the estimate and engineer extras, update service warranty if needed, then generate the final invoice."
          actions={
            invoice ? (
              <Button variant="outline" asChild>
                <Link to={`/app/billing/invoices/${invoice.id}`}>Open invoice & print</Link>
              </Button>
            ) : null
          }
        />

        {loading ? (
          <div className="flex justify-center py-20 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : !context ? (
          <p className="text-center text-muted-foreground">Job not found.</p>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-base">Estimate details</CardTitle></CardHeader>
                <CardContent><BillingEstimateDetails context={context} /></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Service engineer added items</CardTitle></CardHeader>
                <CardContent><BillingEngineerExtras context={context} /></CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Service context</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <BillingJobFacts context={context} />
                <Collapsible>
                  <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-md px-1 py-1 text-left text-sm font-medium text-primary hover:underline">
                    Job notes, parts & timeline
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4">
                    <BillingServiceNotes context={context} />
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-4 w-4" />
                  Service warranty
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!equipment ? (
                  <p className="text-sm text-muted-foreground">
                    No equipment record is linked to this job. Service warranty can still be maintained later from Equipment.
                  </p>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <InfoRow label="Equipment" value={equipment.name} />
                      <InfoRow
                        label="Machine warranty"
                        value={warrantyDisplay(equipment.noMachineWarranty, equipment.warrantyStart, equipment.warrantyEnd)}
                      />
                      <InfoRow
                        label="Service warranty"
                        value={warrantyDisplay(equipment.noServiceWarranty, equipment.serviceWarrantyStart, equipment.serviceWarrantyEnd)}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Machine warranty is the manufacturer period. Set service warranty for this job, or choose No warranty.
                    </p>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={warrantyForm.noServiceWarranty}
                        disabled={Boolean(invoice)}
                        onCheckedChange={(checked) => {
                          const noServiceWarranty = checked === true;
                          setWarrantyForm((prev) => ({
                            ...prev,
                            noServiceWarranty,
                            serviceWarrantyStart: noServiceWarranty ? "" : prev.serviceWarrantyStart,
                            serviceWarrantyEnd: noServiceWarranty ? "" : prev.serviceWarrantyEnd,
                          }));
                        }}
                      />
                      <span>No service warranty</span>
                    </label>
                    {!warrantyForm.noServiceWarranty ? (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                          <Label htmlFor="billing-service-warranty-start">Service warranty start</Label>
                          <Input
                            id="billing-service-warranty-start"
                            type="date"
                            disabled={Boolean(invoice)}
                            value={warrantyForm.serviceWarrantyStart}
                            onChange={(e) => setWarrantyForm((prev) => ({ ...prev, serviceWarrantyStart: e.target.value }))}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="billing-service-warranty-end">Service warranty end</Label>
                          <Input
                            id="billing-service-warranty-end"
                            type="date"
                            disabled={Boolean(invoice)}
                            value={warrantyForm.serviceWarrantyEnd}
                            onChange={(e) => setWarrantyForm((prev) => ({ ...prev, serviceWarrantyEnd: e.target.value }))}
                          />
                        </div>
                      </div>
                    ) : null}
                    <Button variant="outline" disabled={warrantySaving || Boolean(invoice)} onClick={() => void saveWarranty()}>
                      {warrantySaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {warrantyForm.noServiceWarranty ? "Save no warranty" : "Save service warranty"}
                    </Button>
                  </>
                )}
                {context.verification?.items?.length ? (
                  <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Billing checklist</p>
                    <ul className="grid gap-1 sm:grid-cols-2">
                      {context.verification.items.map((item) => (
                        <li key={item.key} className="flex items-center gap-2 text-sm">
                          <StatusBadge status={item.passed ? "completed" : "pending"} />
                          <span>{item.label}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {!invoice ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Final invoice / bill</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
                    <InvoiceLineEditor
                      title="Add products & services"
                      lines={additionalLines}
                      inventory={inventory}
                      catalog={catalog}
                      onChange={setAdditionalLines}
                    />
                    <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4 xl:sticky xl:top-4">
                      <ChargeBreakdown groups={charges.groups} total={charges.total} />
                      <div className="grid gap-2">
                        <Label htmlFor="invoice-due-at">Payment due date</Label>
                        <Input
                          id="invoice-due-at"
                          type="date"
                          value={dueAt}
                          onChange={(e) => setDueAt(e.target.value)}
                        />
                      </div>
                      <Button className="w-full" onClick={() => void generateInvoice()} disabled={saving || !dueAt}>
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                        Generate final bill
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader><CardTitle className="text-base">Invoice created</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <InfoRow label="Reference" value={invoice.reference} />
                  <InfoRow label="Status" value={<StatusBadge status={invoice.status} />} />
                  <InfoRow label="Final amount" value={formatCurrency(invoice.total)} />
                  <Button asChild>
                    <Link to={`/app/billing/invoices/${invoice.id}`}>Continue to print & download</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
