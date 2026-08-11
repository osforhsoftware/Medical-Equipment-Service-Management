import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Camera, FileSignature, Loader2, PackageMinus, PlusCircle, Wrench } from "lucide-react";
import {
  ActivityTimeline,
  DetailInfoGrid,
  DetailSection,
  RecordDetailLayout,
} from "@/components/shared/RecordDetailLayout";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SignaturePad } from "@/components/shared/SignaturePad";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import {
  api,
  ApiError,
  type BackendInventoryItem,
  type BackendJobActivity,
  type BackendServiceJob,
  type JobPhotoInput,
} from "@/lib/api";
import { formatFixedOption, SERVICE_TYPE_OPTIONS } from "@/lib/fixedOptions";
import { defaultDatePlusDays, formatDate, formatDateTime, formatJobStatus } from "@/lib/format";
import { toast } from "@/lib/toast";

const JOB_STATUS_OPTIONS = [
  { value: "scheduled", label: "Scheduled" },
  { value: "inProgress", label: "In Progress" },
  { value: "partsPending", label: "Parts Pending" },
  { value: "review", label: "Review" },
  { value: "completed", label: "Completed" },
] as const;

function toApiJobStatus(display: string) {
  if (display === "in-progress") return "inProgress";
  if (display === "parts-pending") return "partsPending";
  return display;
}

export default function JobDetail() {
  const { id = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [job, setJob] = useState<BackendServiceJob | null>(null);
  const [activities, setActivities] = useState<BackendJobActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [partsOpen, setPartsOpen] = useState(false);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [partsNote, setPartsNote] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [inventory, setInventory] = useState<BackendInventoryItem[]>([]);
  const [stockItemId, setStockItemId] = useState("");
  const [stockQty, setStockQty] = useState(1);
  const [actionSaving, setActionSaving] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const canUpdateJob = user?.role === "engineer" || user?.role === "admin" || user?.role === "coordinator";
  const tab = searchParams.get("tab") ?? "overview";

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [record, audit] = await Promise.all([api.getJob(id), api.getJobActivities(id)]);
      setJob(record);
      setActivities(audit);
    } catch (err) {
      setJob(null);
      setError(err instanceof ApiError && err.status === 404 ? null : "Please try again.");
      if (!(err instanceof ApiError && err.status === 404)) {
        toast.apiError(err, { fallback: "Failed to load job" });
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const refreshActivities = async (jobId: string) => {
    try {
      setActivities(await api.getJobActivities(jobId));
    } catch {
      /* ignore */
    }
  };

  const updateJobStatus = async (status: string, progress?: number) => {
    if (!job) return;
    try {
      const updated = await api.updateJob(job.id, {
        status,
        ...(progress !== undefined ? { progress } : {}),
      });
      setJob(updated);
      toast({ title: "Status updated", description: `Job moved to ${JOB_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status}.` });
      await refreshActivities(job.id);
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to update job" });
    }
  };

  const completeJob = async () => {
    if (!job) return;
    try {
      await api.updateJob(job.id, { status: "completed", progress: 100 });
      const doc = await api.generateDocument("service-report", job.id);
      toast({ title: "Job completed", description: "Service report PDF generated." });
      if (doc.file?.id) window.open(api.fileDownloadUrl(doc.file.id), "_blank");
      await load();
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to complete job" });
    }
  };

  const handleUploadPhotos = async () => {
    if (!job || photoFiles.length === 0) return;
    setActionSaving(true);
    try {
      const photos: JobPhotoInput[] = [];
      for (const file of photoFiles) {
        const uploaded = await api.uploadFile(file);
        photos.push({ fileId: uploaded.id, filename: uploaded.originalName, mimeType: uploaded.mimeType });
      }
      const result = await api.uploadJobPhotos(job.id, photos);
      setJob(result.job);
      toast({ title: "Photos uploaded", description: `${photoFiles.length} photo(s) attached.` });
      setPhotoFiles([]);
      setPhotosOpen(false);
      await refreshActivities(job.id);
    } catch (err) {
      toast.apiError(err, { fallback: "Upload failed" });
    } finally {
      setActionSaving(false);
    }
  };

  const handleScopeChange = async () => {
    if (!job || !partsNote.trim()) return;
    setActionSaving(true);
    try {
      await api.addJobExtra(job.id, {
        description: partsNote.trim().slice(0, 120),
        reason: partsNote.trim(),
        quantity: 1,
        unitPrice: 0,
        taxRate: 0,
      });
      toast({ title: "Scope change submitted", description: "Routed for Admin/Estimator approval." });
      setPartsNote("");
      setPartsOpen(false);
      await refreshActivities(job.id);
      const refreshed = await api.getJob(job.id);
      setJob(refreshed);
    } catch (err) {
      toast.apiError(err, { fallback: "Request failed" });
    } finally {
      setActionSaving(false);
    }
  };

  const handleCaptureSignature = async () => {
    if (!job || !customerName.trim() || !signatureData) return;
    setActionSaving(true);
    try {
      const result = await api.captureJobSignature(job.id, {
        customerName: customerName.trim(),
        signatureData,
      });
      setJob(result.job);
      toast({ title: "Signature captured", description: `Signed by ${customerName.trim()}` });
      setCustomerName("");
      setSignatureData(null);
      setSignatureOpen(false);
      await refreshActivities(job.id);
    } catch (err) {
      toast.apiError(err, { fallback: "Signature failed" });
    } finally {
      setActionSaving(false);
    }
  };

  const openStockDialog = async () => {
    setStockOpen(true);
    setStockItemId("");
    setStockQty(1);
    try {
      setInventory(await api.listInventory());
    } catch {
      setInventory([]);
    }
  };

  const handleDeductStock = async () => {
    if (!job || !stockItemId) return;
    const item = inventory.find((i) => i.id === stockItemId);
    if (!item || stockQty < 1 || stockQty > item.inStock) {
      toast({ title: "Invalid quantity", description: `Available: ${item?.inStock ?? 0}`, variant: "destructive" });
      return;
    }
    setActionSaving(true);
    try {
      const result = await api.deductJobStock(job.id, { inventoryItemId: stockItemId, quantity: stockQty });
      setJob(result.job);
      toast({ title: "Stock deducted", description: `${stockQty} × ${item.name} deducted.` });
      setStockOpen(false);
      await refreshActivities(job.id);
    } catch (err) {
      toast.apiError(err, { fallback: "Deduction failed" });
    } finally {
      setActionSaving(false);
    }
  };

  const handleShortagePurchase = async () => {
    const item = inventory.find((candidate) => candidate.id === stockItemId);
    if (!item || !job) return;
    if (stockQty <= item.inStock) return;
    setActionSaving(true);
    try {
      await api.createItemizedPurchaseOrder({
        supplier: item.supplier,
        expectedDate: defaultDatePlusDays(7),
        lines: [{
          inventoryItemId: item.id,
          sku: item.sku,
          description: `${item.name} — shortage for ${job.reference}`,
          quantityOrdered: stockQty - item.inStock,
          unitCost: Number(item.unitCost),
          taxRate: 0,
        }],
      });
      setStockOpen(false);
      toast({ title: "Purchase order created", description: `Shortage of ${stockQty - item.inStock} × ${item.name} sent to purchasing.` });
    } catch (error) {
      toast.apiError(error, { fallback: "Request failed" });
    } finally {
      setActionSaving(false);
    }
  };

  const selectedApiStatus = job ? toApiJobStatus(formatJobStatus(job.status)) : "";
  const extras = job?.extras ?? [];
  const workLogs = job?.workLogs ?? [];

  return (
    <RoleGuard roles={["admin", "coordinator", "engineer"]}>
      <RecordDetailLayout
        backTo="/app/jobs"
        backLabel="Back to Jobs"
        title={job?.reference ?? "Job"}
        subtitle={job ? `${job.equipmentName} · ${job.customerName}` : undefined}
        status={job ? formatJobStatus(job.status) : undefined}
        meta={job ? [
          { label: "Engineer", value: job.engineer || "Unassigned" },
          { label: "Scheduled", value: formatDate(job.scheduledFor) },
          { label: "Ticket", value: job.requestRef },
        ] : undefined}
        loading={loading}
        error={error}
        notFound={!loading && !error && !job}
        notFoundTitle="Job not found"
        notFoundDescription="The requested service job could not be found."
        onRetry={() => void load()}
        actions={
          job && canUpdateJob && job.status !== "completed" ? (
            <Button className="bg-gradient-primary text-primary-foreground hover:opacity-90" onClick={() => void completeJob()}>
              Complete & Generate Report
            </Button>
          ) : undefined
        }
        activeTab={tab}
        onTabChange={(value) => setSearchParams(value === "overview" ? {} : { tab: value })}
        tabs={job ? [
          {
            id: "overview",
            label: "Overview",
            content: (
              <div className="space-y-4">
                <DetailSection title="Progress">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Completion</span>
                    <span className="font-medium">{job.progress}%</span>
                  </div>
                  <Progress value={job.progress} className="h-2" />
                </DetailSection>
                <DetailSection title="Job details">
                  <DetailInfoGrid
                    items={[
                      { label: "Type", value: formatFixedOption(SERVICE_TYPE_OPTIONS, job.type, job.typeOther) },
                      { label: "Engineer", value: job.engineer },
                      { label: "Customer", value: job.customerName },
                      { label: "Equipment", value: job.equipmentName },
                      { label: "Scheduled", value: formatDate(job.scheduledFor) },
                      { label: "Service ticket", value: job.serviceRequestId ? (
                        <Link className="text-primary hover:underline normal-case" to={`/app/service-tickets/${job.serviceRequestId}`}>
                          {job.requestRef}
                        </Link>
                      ) : job.requestRef },
                      { label: "Created", value: formatDate(job.createdAt) },
                      { label: "Updated", value: formatDate(job.updatedAt) },
                    ]}
                  />
                </DetailSection>
              </div>
            ),
          },
          {
            id: "work",
            label: "Work",
            content: (
              <DetailSection title="Work logs">
                {workLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No work logs recorded yet.</p>
                ) : (
                  <div className="space-y-3">
                    {workLogs.map((log) => (
                      <div key={log.id} className="rounded-lg border p-3 text-sm">
                        <p>{log.workPerformed}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDateTime(log.startedAt)}
                          {log.endedAt ? ` – ${formatDateTime(log.endedAt)}` : ""} · {log.minutes} minutes
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </DetailSection>
            ),
          },
          {
            id: "parts",
            label: "Parts",
            content: (
              <DetailSection title="Additional parts / scope">
                {extras.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No extra parts or scope changes yet.</p>
                ) : (
                  <div className="space-y-3">
                    {extras.map((item) => (
                      <div key={item.id} className="flex justify-between gap-3 rounded-lg border p-3 text-sm">
                        <div>
                          <p className="font-medium">{item.description}</p>
                          <p className="text-xs text-muted-foreground">{item.reason}</p>
                        </div>
                        <StatusBadge status={item.status} />
                      </div>
                    ))}
                  </div>
                )}
              </DetailSection>
            ),
          },
          {
            id: "activity",
            label: "Activity",
            content: (
              <DetailSection title="Activity timeline">
                <ActivityTimeline
                  items={activities.map((a) => ({
                    id: a.id,
                    title: a.action,
                    detail: a.note,
                    meta: `${a.actor} · ${formatDateTime(a.createdAt)}`,
                  }))}
                />
              </DetailSection>
            ),
          },
        ] : undefined}
        sidebar={job ? (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wrench className="h-4 w-4" /> Status & actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {canUpdateJob && job.status !== "completed" ? (
                  <>
                    <div className="space-y-2">
                      <Label>Update status</Label>
                      <Select value={selectedApiStatus} onValueChange={(v) => void updateJobStatus(v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {JOB_STATUS_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <ActionBtn icon={Camera} label="Photos" onClick={() => setPhotosOpen(true)} />
                      <ActionBtn icon={PlusCircle} label="Extra scope" onClick={() => setPartsOpen(true)} />
                      <ActionBtn icon={FileSignature} label="Signature" onClick={() => setSignatureOpen(true)} />
                      <ActionBtn icon={PackageMinus} label="Stock" onClick={() => void openStockDialog()} />
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">This job is completed.</p>
                )}
              </CardContent>
            </Card>
          </div>
        ) : undefined}
      />

      <Dialog open={photosOpen} onOpenChange={setPhotosOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Upload Photos</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => setPhotoFiles(Array.from(e.target.files ?? []))} />
            <Button variant="outline" onClick={() => photoInputRef.current?.click()}>
              <Camera className="mr-2 h-4 w-4" />
              {photoFiles.length > 0 ? `${photoFiles.length} photo(s) selected` : "Choose photos"}
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPhotosOpen(false); setPhotoFiles([]); }}>Cancel</Button>
            <Button onClick={() => void handleUploadPhotos()} disabled={actionSaving || photoFiles.length === 0}>
              {actionSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={partsOpen} onOpenChange={setPartsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Request Additional Parts / Scope</DialogTitle></DialogHeader>
          <Textarea placeholder="Extra parts, quantity, or scope change reason…" value={partsNote} onChange={(e) => setPartsNote(e.target.value)} rows={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPartsOpen(false); setPartsNote(""); }}>Cancel</Button>
            <Button onClick={() => void handleScopeChange()} disabled={actionSaving || !partsNote.trim()}>
              {actionSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={signatureOpen} onOpenChange={setSignatureOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Capture Signature</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="customer-sign">Customer name</Label>
              <Input id="customer-sign" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </div>
            <SignaturePad onChange={setSignatureData} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSignatureOpen(false); setCustomerName(""); setSignatureData(null); }}>Cancel</Button>
            <Button onClick={() => void handleCaptureSignature()} disabled={actionSaving || !customerName.trim() || !signatureData}>
              {actionSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={stockOpen} onOpenChange={setStockOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Deduct Stock</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Inventory item</Label>
              <Select value={stockItemId} onValueChange={setStockItemId}>
                <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                <SelectContent>
                  {inventory.map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.name} ({i.sku}) — {i.inStock} in stock</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="stock-qty">Quantity</Label>
              <Input id="stock-qty" type="number" min={1} value={stockQty} onChange={(e) => setStockQty(Number(e.target.value))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStockOpen(false)}>Cancel</Button>
            {stockItemId && stockQty > (inventory.find((item) => item.id === stockItemId)?.inStock ?? 0) ? (
              <Button onClick={() => void handleShortagePurchase()} disabled={actionSaving}>
                {actionSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Create PO for shortage
              </Button>
            ) : (
              <Button onClick={() => void handleDeductStock()} disabled={actionSaving || !stockItemId}>
                {actionSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Deduct"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleGuard>
  );
}

function ActionBtn({ icon: Icon, label, onClick }: { icon: typeof Camera; label: string; onClick: () => void }) {
  return (
    <Button variant="outline" className="h-auto flex-col gap-1.5 py-3" onClick={onClick}>
      <Icon className="h-4 w-4" />
      <span className="text-xs">{label}</span>
    </Button>
  );
}
