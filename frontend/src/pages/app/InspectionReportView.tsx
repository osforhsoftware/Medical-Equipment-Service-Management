import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Download, FilePenLine, Loader2, Printer } from "lucide-react";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { InspectionReportDocument } from "@/components/inspections/InspectionReportDocument";
import { InspectionReportPanel } from "@/components/inspections/InspectionReportPanel";
import { useInspectionReportEditor } from "@/components/inspections/useInspectionReportEditor";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import {
  downloadInspectionReportPdf,
  loadInspectionReportBundle,
  type InspectionReportBundle,
} from "@/lib/inspectionReport";
import { toast } from "@/lib/toast";

const EDIT_ROLES = ["admin", "coordinator", "inspector"] as const;

export default function InspectionReportView() {
  const { id = "" } = useParams();
  const { hasRole } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [bundle, setBundle] = useState<InspectionReportBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setBundle(await loadInspectionReportBundle(id));
    } catch (err) {
      setBundle(null);
      if (err instanceof ApiError && err.status === 404) {
        setError(null);
      } else if (err instanceof Error && err.message === "Inspection report not found") {
        setError(null);
      } else {
        setError("Unable to load inspection report.");
        toast.apiError(err, { fallback: "Failed to load inspection report" });
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

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

  const editor = useInspectionReportEditor(load);
  const request = bundle?.request ?? null;
  const report = bundle?.report ?? null;
  const canEdit =
    hasRole([...EDIT_ROLES]) &&
    Boolean(request) &&
    ["new", "inspection", "estimate"].includes(request!.status);

  const downloadPdf = async () => {
    if (!request) return;
    setPdfBusy(true);
    try {
      await downloadInspectionReportPdf(request.id);
      toast({ title: "PDF ready", description: "Inspection report PDF opened in a new tab." });
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to generate inspection report PDF" });
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <RoleGuard roles={["admin", "coordinator", "inspector", "estimator", "billing"]}>
      <div className="print-preview-page min-h-[70vh] space-y-4">
        <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground" asChild>
            <Link to={`/app/inspections/${id}`}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Back to inspection
            </Link>
          </Button>
          {report ? (
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold">Inspection Report — Full Details</h1>
              {canEdit ? (
                <Button variant="outline" size="sm" onClick={() => void editor.startInspection(request!)}>
                  <FilePenLine className="mr-1 h-4 w-4" /> Edit Inspection
                </Button>
              ) : null}
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="mr-1 h-4 w-4" /> Print
              </Button>
              <Button variant="brand" size="sm" disabled={pdfBusy} onClick={() => void downloadPdf()}>
                {pdfBusy ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-1 h-4 w-4" />
                )}
                Download PDF
              </Button>
            </div>
          ) : null}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading inspection report…
          </div>
        ) : error ? (
          <div className="rounded-lg border border-border bg-card p-10 text-center">
            <p className="font-medium">{error}</p>
            <Button className="mt-4" variant="outline" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        ) : !bundle || !report ? (
          <div className="rounded-lg border border-border bg-card p-10 text-center">
            <p className="font-medium">No inspection information available.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {request
                ? "An inspection report has not been filed for this ticket yet."
                : "This inspection could not be found."}
            </p>
            {request && canEdit ? (
              <Button className="mt-4" variant="brand" onClick={() => void editor.startInspection(request)}>
                <FilePenLine className="mr-1.5 h-4 w-4" />
                Conduct inspection
              </Button>
            ) : (
              <Button className="mt-4" variant="outline" asChild>
                <Link to="/app/inspections">Back to inspections</Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="print-area mx-auto w-full max-w-[210mm] border border-border bg-white p-4 shadow-sm print:mx-0 print:max-w-none print:border-0 print:p-0 print:shadow-none sm:p-6">
            <InspectionReportDocument
              request={bundle.request}
              report={bundle.report}
              customer={bundle.customer}
              equipment={bundle.equipment}
            />
          </div>
        )}
      </div>

      <InspectionReportPanel
        open={!!editor.active}
        onClose={editor.closePanel}
        active={editor.active}
        existingReport={editor.existingReport}
        loadingReport={editor.loadingReport}
        saving={editor.saving}
        onSubmit={() => void editor.submitReport()}
        findings={editor.findings}
        setFindings={editor.setFindings}
        recommendation={editor.recommendation}
        setRecommendation={editor.setRecommendation}
        workDetails={editor.workDetails}
        setWorkDetails={editor.setWorkDetails}
        severity={editor.severity}
        setSeverity={editor.setSeverity}
        machineImages={editor.machineImages}
        setMachineImages={editor.setMachineImages}
        setMachineImage={editor.setMachineImage}
        imageCaptions={editor.imageCaptions}
        setImageCaptions={editor.setImageCaptions}
        newImagePreviews={editor.newImagePreviews}
      />
    </RoleGuard>
  );
}
