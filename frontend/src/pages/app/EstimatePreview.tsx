import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, Download, Loader2, Printer } from "lucide-react";
import { ProfessionalDocument } from "@/components/shared/ProfessionalDocument";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { ESTIMATE_READ_ROLES } from "@/config/roles";
import { Button } from "@/components/ui/button";
import { ApiError, api, type BackendEstimate } from "@/lib/api";
import { estimateToDocumentLines } from "@/lib/estimates";
import { toast } from "@/lib/toast";

export default function EstimatePreview() {
  const { id = "" } = useParams();
  const location = useLocation();
  const isPortal = location.pathname.startsWith("/portal");
  const [estimate, setEstimate] = useState<BackendEstimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pdfBusy, setPdfBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      if (isPortal) {
        const portal = await api.getCustomerPortal();
        const match = portal.estimates.find((item) => item.id === id);
        setEstimate(match ? await api.getEstimate(id).catch(() => match) : null);
      } else {
        setEstimate(await api.getEstimate(id));
      }
    } catch (err) {
      setEstimate(null);
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

  const backTo = isPortal ? (estimate ? `/portal/estimates/${estimate.id}` : "/portal/estimates") : (estimate ? `/app/estimates/${estimate.id}` : "/app/estimates");

  const downloadPdf = async () => {
    if (!estimate) return;
    if (isPortal) {
      window.print();
      return;
    }
    setPdfBusy(true);
    try {
      const doc = await api.generateDocument("estimate", estimate.id);
      if (doc.file?.id) window.open(api.fileDownloadUrl(doc.file.id), "_blank");
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to generate PDF" });
    } finally {
      setPdfBusy(false);
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
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">Estimate Preview</h1>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-1 h-4 w-4" /> Print
          </Button>
          <Button variant="outline" size="sm" disabled={!estimate || pdfBusy} onClick={() => void downloadPdf()}>
            {pdfBusy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />} PDF
          </Button>
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
          <Button className="mt-4" variant="outline" onClick={() => void load()}>Retry</Button>
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
            equipmentName={estimate.equipmentName}
            issueDate={estimate.createdAt}
            validOrDueLabel="Valid until"
            validOrDueDate={estimate.validUntil}
            ticketRef={estimate.requestRef}
            lines={estimateToDocumentLines(estimate)}
            discount={Number(estimate.discount ?? 0)}
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
