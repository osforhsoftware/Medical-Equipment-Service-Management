import { useCallback, useEffect, useState } from "react";
import { Camera, FileCheck, ClipboardCheck, Loader2, AlertTriangle, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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

export default function Inspections() {
  const { branchId } = useBranch();
  const [requests, setRequests] = useState<BackendServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<BackendServiceRequest | null>(null);
  const [existingReport, setExistingReport] = useState<BackendInspectionReport | null>(null);

  const [findings, setFindings] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [workDetails, setWorkDetails] = useState("");
  const [machineImage, setMachineImage] = useState<File | null>(null);
  const [machineImages, setMachineImages] = useState<File[]>([]);
  const [inventory, setInventory] = useState<import("@/lib/api").BackendInventoryItem[]>([]);
  const [recommendedItems, setRecommendedItems] = useState([
    {
      title: "",
      description: "",
      priority: "medium" as "low" | "medium" | "high" | "critical",
      kind: "inventory" as "service" | "inventory",
      inventoryItemId: "",
      quantity: "1",
    },
  ]);
  const [severity, setSeverity] = useState("medium");
  const [saving, setSaving] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => {
    void api.listInventory().then(setInventory).catch(() => setInventory([]));
  }, []);


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
    setWorkDetails("");
    setMachineImage(null);
    setRecommendedItems([{ title: "", description: "", priority: "medium", kind: "inventory", inventoryItemId: "", quantity: "1" }]);
    setMachineImages([]);
    setMachineImage(null);
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
    const files = [...machineImages, ...(machineImage ? [machineImage] : [])];
    if (!existingReport?.attachments?.length && files.length === 0) {
      toast({ title: "Inspection images required", description: "Attach at least one inspection photo.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const uploadedIds: string[] = [];
      for (const file of files) {
        const uploaded = await api.uploadFile(file);
        uploadedIds.push(uploaded.id);
      }
      const report = await api.saveInspectionReport(active.id, {
        findings: [findings.trim(), workDetails.trim() ? `Work details:\n${workDetails.trim()}` : ""].filter(Boolean).join("\n\n"),
        recommendation: recommendation.trim(),
        severity,
        attachmentFileIds: uploadedIds,
        submit: true,
      });
      for (const item of recommendedItems.filter((entry) => entry.title.trim() || entry.inventoryItemId)) {
        const inv = inventory.find((i) => i.id === item.inventoryItemId);
        const qty = Number(item.quantity) || 1;
        await api.addInspectionRecommendation(report.id, {
          type: item.kind === "inventory" ? "part" : "service",
          title: item.title.trim() || inv?.name || "Parts requirement",
          description: item.description.trim() || item.title.trim() || inv?.name || "Required",
          priority: item.priority,
          inventoryItemId: item.inventoryItemId || null,
          quantity: qty,
          estimatedCost: Number(inv?.sellingPrice ?? inv?.unitCost ?? 0) * qty,
        });
        if (item.inventoryItemId && inv && inv.inStock - inv.reserved < qty) {
          await api.createStockPurchaseRequest({
            inventoryItemId: item.inventoryItemId,
            quantity: qty - Math.max(0, inv.inStock - inv.reserved),
            serviceRequestId: active.id,
            note: `Shortage from Parts Requirement on ${active.reference}`,
          }).catch(() => undefined);
        }
      }
      toast({
        title: "Inspection report submitted",
        description: "Ticket advanced to the Estimate stage.",
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
                          <StatusBadge status={report.severity} className="text-[10px]" />
                          <span className="text-xs text-muted-foreground">Report filed</span>
                        </div>
                        <p className="text-xs line-clamp-2">{report.findings}</p>
                      </div>
                    )}
                    <div className="space-y-2">
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
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
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
                <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
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
                        <span className="inline-block h-2 w-2 rounded-full bg-info" /> Low
                      </span>
                    </SelectItem>
                    <SelectItem value="medium">
                      <span className="flex items-center gap-2">
                        <span className="inline-block h-2 w-2 rounded-full bg-warning" /> Medium
                      </span>
                    </SelectItem>
                    <SelectItem value="high">
                      <span className="flex items-center gap-2">
                        <span className="inline-block h-2 w-2 rounded-full bg-warning-foreground" /> High
                      </span>
                    </SelectItem>
                    <SelectItem value="critical">
                      <span className="flex items-center gap-2">
                        <span className="inline-block h-2 w-2 rounded-full bg-destructive" /> Critical
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
                <Label>Work details</Label>
                <Textarea value={workDetails} onChange={(e) => setWorkDetails(e.target.value)} rows={3} placeholder="Tests performed, measurements, error codes and machine condition…" />
              </div>

              <div className="grid gap-2">
                <Label>Inspection images {!existingReport?.attachments?.length ? <span className="text-destructive">*</span> : null}</Label>
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    setMachineImages(files);
                    setMachineImage(files[0] ?? null);
                  }}
                />
                {machineImages.length ? (
                  <p className="text-xs text-muted-foreground">{machineImages.length} image(s) selected</p>
                ) : null}
                {existingReport?.attachments?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {existingReport.attachments.map((att) => (
                      <a
                        key={att.id}
                        className="text-xs text-primary underline"
                        href={api.fileDownloadUrl(att.fileId)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {att.file?.originalName ?? att.fileId}
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label>Recommendation <span className="text-destructive">*</span></Label>
                <Textarea
                  value={recommendation}
                  onChange={(e) => setRecommendation(e.target.value)}
                  rows={3}
                  placeholder="What action do you recommend?"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Parts Requirement</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setRecommendedItems((items) => [
                        ...items,
                        { title: "", description: "", priority: "medium", kind: "inventory", inventoryItemId: "", quantity: "1" },
                      ])
                    }
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add
                  </Button>
                </div>
                {recommendedItems.map((item, index) => (
                  <div key={index} className="space-y-2 rounded-lg border p-3">
                    <div className="grid grid-cols-[1fr_100px_auto] gap-2">
                      <Select
                        value={item.inventoryItemId || undefined}
                        onValueChange={(inventoryItemId) => {
                          const inv = inventory.find((i) => i.id === inventoryItemId);
                          setRecommendedItems((items) =>
                            items.map((entry, i) =>
                              i === index
                                ? {
                                    ...entry,
                                    inventoryItemId,
                                    kind: "inventory",
                                    title: inv?.name ?? entry.title,
                                  }
                                : entry,
                            ),
                          );
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select inventory item" />
                        </SelectTrigger>
                        <SelectContent>
                          {inventory.map((inv) => (
                            <SelectItem key={inv.id} value={inv.id}>
                              {inv.name} ({inv.sku}) · avail {inv.inStock - inv.reserved}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(event) =>
                          setRecommendedItems((items) =>
                            items.map((entry, i) => (i === index ? { ...entry, quantity: event.target.value } : entry)),
                          )
                        }
                        placeholder="Qty"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => setRecommendedItems((items) => items.filter((_, i) => i !== index))}
                        disabled={recommendedItems.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Textarea
                      value={item.description}
                      onChange={(event) =>
                        setRecommendedItems((items) =>
                          items.map((entry, i) => (i === index ? { ...entry, description: event.target.value } : entry)),
                        )
                      }
                      rows={2}
                      placeholder="Why needed…"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setActive(null)}>Cancel</Button>
            <Button
              variant="brand"
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
