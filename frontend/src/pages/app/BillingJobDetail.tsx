import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, FileText, Loader2, ShieldCheck } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BillingServiceContext,
  InfoRow,
  Section,
  VerificationChecklist,
} from "@/components/billing/billing-ui";
import { ApiError, api, type BillingJobContext } from "@/lib/api";
import { defaultDatePlusDays, formatCurrency, formatDateTime } from "@/lib/format";
import { toast } from "@/lib/toast";

export default function BillingJobDetail() {
  const { jobId = "" } = useParams();
  const navigate = useNavigate();
  const [context, setContext] = useState<BillingJobContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dueAt, setDueAt] = useState(defaultDatePlusDays(30));

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

  const verifyJob = async () => {
    setSaving(true);
    try {
      await api.verifyBillingJob(jobId);
      await load();
      toast({ title: "Billing verification complete" });
    } catch (error) {
      toast.apiError(error, { fallback: "Request failed" });
    } finally { setSaving(false); }
  };

  const generateInvoice = async () => {
    setSaving(true);
    try {
      const invoice = await api.createInvoiceFromJob(jobId, new Date(dueAt).toISOString(), "INR");
      toast({ title: "Invoice generated" });
      navigate(`/app/billing/invoices/${invoice.id}`);
    } catch (error) {
      toast.apiError(error, { fallback: "Request failed" });
    } finally { setSaving(false); }
  };

  const invoice = context?.invoice ?? null;

  return (
    <RoleGuard roles={["admin", "billing"]}>
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/app/billing"><ArrowLeft className="mr-1 h-4 w-4" /> Back to queue</Link>
          </Button>
        </div>

        <PageHeader
          title={context ? `Billing review — ${context.job.reference}` : "Billing review"}
          description="Verify completed service work and generate the invoice from operational records."
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
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Service context</CardTitle></CardHeader>
              <CardContent><BillingServiceContext context={context} /></CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle className="text-base">Billing verification</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <VerificationChecklist items={context.verification.items} />
                  {!context.job.billingVerifiedAt && context.verification.allPassed ? (
                    <Button className="w-full" onClick={verifyJob} disabled={saving}>
                      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                      Confirm billing verification
                    </Button>
                  ) : null}
                  {context.job.billingVerifiedAt ? (
                    <p className="text-xs text-success">
                      Verified by {context.job.billingVerifiedBy} · {formatDateTime(context.job.billingVerifiedAt)}
                    </p>
                  ) : null}
                </CardContent>
              </Card>

              {!invoice && context.job.billingVerifiedAt ? (
                <Card>
                  <CardHeader><CardTitle className="text-base">Generate invoice</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <InfoRow label="Estimate total" value={formatCurrency(context.costs.estimateAmount)} />
                    <InfoRow label="Parts cost" value={formatCurrency(context.costs.partsCost)} />
                    <InfoRow label="Labour" value={formatCurrency(context.costs.labourCharges)} />
                    <div className="grid gap-2">
                      <Label>Payment due date</Label>
                      <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
                    </div>
                    <Button className="w-full" onClick={generateInvoice} disabled={saving || !dueAt}>
                      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                      Generate invoice from job
                    </Button>
                  </CardContent>
                </Card>
              ) : null}

              {invoice ? (
                <Card>
                  <CardHeader><CardTitle className="text-base">Invoice created</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <InfoRow label="Reference" value={invoice.reference} />
                    <InfoRow label="Status" value={<StatusBadge status={invoice.status} />} />
                    <InfoRow label="Total" value={formatCurrency(invoice.total)} />
                    <Button asChild className="w-full">
                      <Link to={`/app/billing/invoices/${invoice.id}`}>Continue to invoice & print</Link>
                    </Button>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
