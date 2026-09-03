import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, FileText, Loader2 } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { SERVICE_BILLING_ROLES } from "@/config/roles";
import { Button } from "@/components/ui/button";
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
import { defaultDatePlusDays, formatCurrency } from "@/lib/format";
import { toast } from "@/lib/toast";

export default function BillingJobDetail() {
  const { jobId = "" } = useParams();
  const navigate = useNavigate();
  const [context, setContext] = useState<BillingJobContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dueAt, setDueAt] = useState(defaultDatePlusDays(30));
  const [additionalLines, setAdditionalLines] = useState<InvoiceLineInput[]>([]);
  const [inventory, setInventory] = useState<BackendInventoryItem[]>([]);
  const [catalog, setCatalog] = useState<BackendCatalogItem[]>([]);

  const load = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    try {
      setContext(await api.getBillingJobContext(jobId));
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
      api.listInventory({ limit: 100, page: 1 }).then((res) => setInventory(res.data)).catch(() => setInventory([])),
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

  const generateInvoice = async () => {
    setSaving(true);
    try {
      const invoice = await api.createInvoiceFromJob(
        jobId,
        new Date(dueAt).toISOString(),
        "INR",
        additionalLines.filter((line) => line.description.trim()),
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
          description="Review the estimate and engineer extras, add any remaining charges, then generate the final invoice."
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
