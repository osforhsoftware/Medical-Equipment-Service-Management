import { useCallback, useEffect, useState } from "react";
import { Camera, Video, FileCheck, ClipboardCheck, Loader2, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { ApiError } from "@/lib/api";
import { useBranch } from "@/context/BranchContext";
import { api, type BackendServiceRequest, type BackendInspectionReport } from "@/lib/api";
import { formatServiceStatus } from "@/lib/format";
import { toast } from "@/hooks/use-toast";

const SEVERITY_COLORS: Record<string, string> = {
  low: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export default function Inspections() {
  const { branchId } = useBranch();
  const [requests, setRequests] = useState<BackendServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<BackendServiceRequest | null>(null);
  const [existingReport, setExistingReport] = useState<BackendInspectionReport | null>(null);

  const [findings, setFindings] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [saving, setSaving] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listServiceRequests({ branchId });
      setRequests(
        data.filter((r) => ["new", "inspection", "estimate"].includes(formatServiceStatus(r.status))),
      );
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to load inspections";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const startInspection = async (task: BackendServiceRequest) => {
    setActive(task);
    setFindings("");
    setRecommendation("");
    setSeverity("medium");
    setExistingReport(null);

    // Advance to inspection status if still new
    if (formatServiceStatus(task.status) === "new") {
      try {
        await api.updateServiceRequest(task.id, { status: "inspection" });
        await loadRequests();
      } catch {
        /* continue */
      }
    }

    // Load existing report if any
    setLoadingReport(true);
    try {
      const report = await api.getInspectionReport(task.id);
      if (report) {
        setExistingReport(report);
        setFindings(report.findings);
        setRecommendation(report.recommendation);
        setSeverity(report.severity);
      }
    } catch {
      /* no report yet */
    } finally {
      setLoadingReport(false);
    }
  };

  const submitReport = async () => {
    if (!active) return;
    if (findings.trim().length < 10) {
      toast({ title: "Findings required", description: "Enter at least 10 characters of findings.", variant: "destructive" });
      return;
    }
    if (!recommendation.trim()) {
      toast({ title: "Recommendation required", description: "Please provide a recommendation.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await api.saveInspectionReport(active.id, {
        findings: findings.trim(),
        recommendation: recommendation.trim(),
        severity,
      });
      toast({
        title: "Inspection report saved",
        description: "Request advanced to the Estimate stage.",
      });
      setActive(null);
      await loadRequests();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Unable to submit inspection";
      toast({ title: "Save failed", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <RoleGuard roles={["admin", "coordinator", "inspector"]}>
      <div className="space-y-6">
        <PageHeader
          title="Inspections"
          description="Capture findings, severity, and recommendations. Submitting advances the request to Estimate."
        />

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading inspection tasks…
          </div>
        ) : requests.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No requests awaiting inspection.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {requests.map((t) => {
              const report = t.inspectionReport;
              const allEquip = t.equipmentItems?.length
                ? t.equipmentItems.map((e) => e.equipmentName).join(", ")
                : (t.equipmentName ?? "No equipment");
              return (
                <Card key={t.id} className="flex flex-col shadow-card">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base line-clamp-1">{allEquip}</CardTitle>
                      <StatusBadge status={formatServiceStatus(t.status) === "new" ? "inspection" : formatServiceStatus(t.status)} />
                    </div>
                    <p className="text-xs text-muted-foreground">{t.reference} · {t.customerName}</p>
                    {t.assignedName && (
                      <p className="text-xs text-muted-foreground">Assigned: <strong>{t.assignedName}</strong></p>
                    )}
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col justify-between gap-4">
                    <p className="text-sm text-muted-foreground line-clamp-2">{t.description}</p>
                    {report && (
                      <div className="rounded-lg bg-muted/50 p-2.5 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${SEVERITY_COLORS[report.severity] ?? ""}`}>
                            {report.severity.toUpperCase()}
                          </span>
                          <span className="text-xs text-muted-foreground">Report filed</span>
                        </div>
                        <p className="text-xs line-clamp-2">{report.findings}</p>
                      </div>
                    )}
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <button
                          type="button"
                          onClick={() => toast({ title: "Camera", description: "Photo capture coming soon." })}
                          className="inline-flex items-center gap-1 hover:text-primary transition-colors"
                        >
                          <Camera className="h-3.5 w-3.5" /> Add Photos
                        </button>
                        <button
                          type="button"
                          onClick={() => toast({ title: "Video", description: "Video capture coming soon." })}
                          className="inline-flex items-center gap-1 hover:text-primary transition-colors"
                        >
                          <Video className="h-3.5 w-3.5" /> Add Videos
                        </button>
                      </div>
                      <Button variant="outline" className="w-full" onClick={() => void startInspection(t)}>
                        <ClipboardCheck className="mr-1 h-4 w-4" />
                        {report ? "Update Report" : "Conduct Inspection"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Inspection Report</DialogTitle>
            <DialogDescription>
              {active?.reference} · {active?.equipmentItems?.length
                ? active.equipmentItems.map((e) => e.equipmentName).join(", ")
                : (active?.equipmentName ?? "")}
            </DialogDescription>
          </DialogHeader>

          {loadingReport ? (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading existing report…
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {existingReport && (
                <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-700 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Updating existing report filed by <strong className="mx-0.5">{existingReport.reportedBy}</strong>
                </div>
              )}

              <div className="grid gap-2">
                <Label>Severity Level</Label>
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-blue-500 inline-block" /> Low
                      </span>
                    </SelectItem>
                    <SelectItem value="medium">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-yellow-500 inline-block" /> Medium
                      </span>
                    </SelectItem>
                    <SelectItem value="high">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-orange-500 inline-block" /> High
                      </span>
                    </SelectItem>
                    <SelectItem value="critical">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-red-500 inline-block" /> Critical
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Findings & Observations <span className="text-destructive">*</span></Label>
                <Textarea
                  value={findings}
                  onChange={(e) => setFindings(e.target.value)}
                  rows={4}
                  placeholder="Describe what was found during inspection — condition, faults, measurements…"
                />
                <p className="text-xs text-muted-foreground">{findings.length}/500 characters (min 10)</p>
              </div>

              <div className="grid gap-2">
                <Label>Recommendation <span className="text-destructive">*</span></Label>
                <Textarea
                  value={recommendation}
                  onChange={(e) => setRecommendation(e.target.value)}
                  rows={3}
                  placeholder="What action do you recommend? E.g. replace compressor, calibrate sensor…"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setActive(null)}>Cancel</Button>
            <Button
              className="bg-gradient-primary text-primary-foreground hover:opacity-90"
              onClick={submitReport}
              disabled={saving || loadingReport}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileCheck className="mr-1 h-4 w-4" />}
              {existingReport ? "Update Report" : "Submit Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleGuard>
  );
}
