import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Download, Loader2, Mail, MessageCircle, Printer } from "lucide-react";
import { ProfessionalDocument } from "@/components/shared/ProfessionalDocument";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { ESTIMATE_READ_ROLES } from "@/config/roles";
import { Button } from "@/components/ui/button";
import { ApiError, api, type BackendCustomer, type BackendEstimate } from "@/lib/api";
import { shareEstimate, type EstimateShareChannel } from "@/lib/estimateShare";
import { estimateLevelDiscount, estimateToDocumentLines } from "@/lib/estimates";
import { formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";

export default function EstimatePreview() {
  const { id = "" } = useParams();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isPortal = location.pathname.startsWith("/portal");
  const [estimate, setEstimate] = useState<BackendEstimate | null>(null);
  const [customer, setCustomer] = useState<BackendCustomer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [shareBusy, setShareBusy] = useState<EstimateShareChannel | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      let next: BackendEstimate | null = null;
      if (isPortal) {
        const portal = await api.getCustomerPortal();
        const match = portal.estimates.find((item) => item.id === id);
        next = match ? await api.getEstimate(id).catch(() => match) : null;
      } else {
        next = await api.getEstimate(id);
      }
      setEstimate(next);
      setCustomer(null);
      if (next?.customerId) {
        try {
          setCustomer(await api.getCustomer(next.customerId));
        } catch {
          setCustomer(null);
        }
      }
    } catch (err) {
      setEstimate(null);
      setCustomer(null);
      setError(err instanceof ApiError && err.status === 404 ? null : "Unable to load this document.");
      if (!(err instanceof ApiError && err.status === 404)) {
        toast.apiError(err, { fallback: "Failed to load estimate" });
      }
    } finally {
      setLoading(false);
    }
  }, [id, isPortal]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (searchParams.get("print") === "1") {
      const next = new URLSearchParams(searchParams);
      next.delete("print");
      setSearchParams(next, { replace: true });
      window.setTimeout(() => window.print(), 300);
    }
  }, [searchParams, setSearchParams]);

  const backTo = isPortal
    ? estimate
      ? `/portal/estimates/${estimate.id}`
      : "/portal/estimates"
    : estimate
      ? `/app/estimates/${estimate.id}`
      : "/app/estimates";

  const downloadPdf = async () => {
    if (!estimate) return;
    if (isPortal) {
      window.print();
      return;
    }
    setPdfBusy(true);
    try {
      const doc = await api.generateDocument("estimate", estimate.id);
      if (doc.file?.id) {
        window.open(api.fileDownloadUrl(doc.file.id), "_blank");
        toast({ title: "PDF ready", description: "Estimate PDF opened in a new tab." });
      }
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to generate PDF" });
    } finally {
      setPdfBusy(false);
    }
  };

  const sendEstimate = async (channel: EstimateShareChannel) => {
    if (!estimate || isPortal) return;
    setShareBusy(channel);
    try {
      const result = await shareEstimate({ channel, estimate, customer });
      if (!result.opened && !result.sharedNatively && !result.downloaded) {
        return;
      }
      toast.success(channel === "whatsapp" ? "WhatsApp opened" : "Gmail/Email opened", {
        description: result.sharedNatively
          ? "Native share was used when available. Otherwise attach the downloaded PDF."
          : "PDF downloaded — attach it in the message window that opened.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to send estimate";
      toast.error(message);
    } finally {
      setShareBusy(null);
    }
  };

  const body = (
    <div className="print-preview-page min-h-[70vh] space-y-4">
      <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground" asChild>
          <Link to={backTo}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold">Estimate Preview</h1>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-1 h-4 w-4" /> Print
          </Button>
          <Button
            variant="brand"
            size="sm"
            disabled={!estimate || pdfBusy || Boolean(shareBusy)}
            onClick={() => void downloadPdf()}
          >
            {pdfBusy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
            Download PDF
          </Button>
          {!isPortal && estimate ? (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={Boolean(shareBusy) || pdfBusy}
                onClick={() => void sendEstimate("whatsapp")}
                className="gap-1.5 border-emerald-500/40 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
              >
                {shareBusy === "whatsapp" ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <MessageCircle className="mr-1 h-4 w-4" />
                )}
                Send via WhatsApp
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={Boolean(shareBusy) || pdfBusy}
                onClick={() => void sendEstimate("email")}
                className="gap-1.5 border-red-500/40 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                {shareBusy === "email" ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="mr-1 h-4 w-4" />
                )}
                Send via Gmail/Email
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading document…
        </div>
      ) : error ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center">
          <p className="font-medium">Unable to load estimate</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <Button className="mt-4" variant="outline" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      ) : !estimate ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center">
          <p className="font-medium">Estimate not found</p>
          <Button className="mt-4" variant="outline" asChild>
            <Link to={isPortal ? "/portal/estimates" : "/app/estimates"}>Back to estimates</Link>
          </Button>
        </div>
      ) : (
        <div className="print-area mx-auto w-full max-w-[210mm] border border-border bg-white shadow-sm print:mx-0 print:max-w-none print:border-0 print:shadow-none">
          <ProfessionalDocument
            kind="Estimate"
            reference={estimate.reference}
            customerName={estimate.customerName}
            customerAddress={
              customer
                ? [customer.address, customer.city, customer.country].filter(Boolean).join(", ")
                : undefined
            }
            customerPhone={customer?.phone || undefined}
            customerEmail={customer?.email || undefined}
            equipmentName={estimate.equipmentName}
            issueDate={estimate.sentAt ?? estimate.createdAt}
            validOrDueLabel="Valid until"
            validOrDueDate={estimate.validUntil}
            ticketRef={estimate.requestRef}
            detailsHeading="Project details"
            detailRows={[
              { label: "Equipment", value: estimate.equipmentName },
              { label: "Ticket", value: estimate.requestRef },
              { label: "Currency", value: estimate.currency || "INR" },
              ...(estimate.estimatedCompletion
                ? [{ label: "Est. completion", value: formatDate(estimate.estimatedCompletion) }]
                : []),
              ...(estimate.warranty ? [{ label: "Warranty", value: estimate.warranty }] : []),
              ...(estimate.preparedBy ? [{ label: "Prepared by", value: estimate.preparedBy }] : []),
              { label: "Approval", value: estimate.status },
            ]}
            lines={estimateToDocumentLines(estimate)}
            discount={estimateLevelDiscount(estimate)}
            customerView={Boolean(estimate.serviceRequestId)}
            customerSummary={estimate.customerSummary}
            totalOverride={Number(estimate.total)}
            notes={estimate.notes ?? undefined}
            terms={estimate.terms ?? undefined}
            hideToolbar
            showSignature
          />
        </div>
      )}
    </div>
  );

  if (isPortal) return body;
  return <RoleGuard roles={ESTIMATE_READ_ROLES}>{body}</RoleGuard>;
}
