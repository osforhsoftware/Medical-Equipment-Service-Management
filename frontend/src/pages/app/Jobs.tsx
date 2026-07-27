import { useCallback, useEffect, useRef, useState } from "react";
import { Wrench, Camera, PlusCircle, FileSignature, PackageMinus, Plus, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { SignaturePad } from "@/components/shared/SignaturePad";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import { useBranch } from "@/context/BranchContext";
import { api, type BackendInventoryItem, type BackendServiceJob, type BackendServiceRequest, type BackendUser, type JobPhotoInput } from "@/lib/api";
import { defaultDatePlusDays, formatDate, formatDateTime, formatJobStatus, todayInputValue } from "@/lib/format";
import { roleLabels } from "@/data/mock";
import type { Role } from "@/data/types";
import { toast } from "@/hooks/use-toast";

const columns = [
  { status: "scheduled", label: "Scheduled" },
  { status: "in-progress", label: "In Progress" },
  { status: "parts-pending", label: "Parts Pending" },
  { status: "review", label: "Review" },
  { status: "completed", label: "Completed" },
] as const;

const JOB_STATUS_OPTIONS = [
  { value: "scheduled", label: "Scheduled" },
  { value: "inProgress", label: "In Progress" },
  { value: "partsPending", label: "Parts Pending" },
  { value: "review", label: "Review" },
  { value: "completed", label: "Completed" },
] as const;

const ASSIGNABLE_JOB_ROLES: Role[] = ["coordinator", "engineer"];

function toApiJobStatus(display: string) {
  if (display === "in-progress") return "inProgress";
  if (display === "parts-pending") return "partsPending";
  return display;
}

export default function Jobs() {
  const { user } = useAuth();
  const { branchId } = useBranch();
  const [jobs, setJobs] = useState<BackendServiceJob[]>([]);
  const [requests, setRequests] = useState<BackendServiceRequest[]>([]);
  const [assignableStaff, setAssignableStaff] = useState<BackendUser[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<BackendServiceJob | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ serviceRequestId: "", engineerId: "", scheduledFor: todayInputValue() });

  // Action dialogs
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
  const [activities, setActivities] = useState<{ id: string; actor: string; action: string; note: string | null; createdAt: string }[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);

  async function fileToDataUrl(file: File): Promise<JobPhotoInput> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve({ filename: file.name, mimeType: file.type || "image/jpeg", dataUrl: reader.result as string });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const isEngineer = user?.role === "engineer";
  const canCreate = user?.role === "admin" || user?.role === "coordinator";
  const canUpdateJob = isEngineer || user?.role === "admin" || user?.role === "coordinator";

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listJobs();
      setJobs(data);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to load jobs";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRequests = useCallback(async () => {
    try {
      const data = await api.listServiceRequests({ branchId });
      setRequests(data.filter((r) => ["approval", "estimate", "inProgress"].includes(r.status)));
    } catch {
      setRequests([]);
    }
  }, [branchId]);

  const loadAssignableStaff = useCallback(async () => {
    setLoadingStaff(true);
    try {
      const lists = await Promise.all(
        ASSIGNABLE_JOB_ROLES.map((role) => api.listUsers({ role, isActive: true })),
      );
      const merged = lists.flat().sort((a, b) => a.name.localeCompare(b.name));
      setAssignableStaff(merged);
    } catch {
      setAssignableStaff([]);
    } finally {
      setLoadingStaff(false);
    }
  }, []);

  useEffect(() => {
    void loadJobs();
    void loadRequests();
  }, [loadJobs, loadRequests]);

  useEffect(() => {
    if (dialogOpen) void loadAssignableStaff();
  }, [dialogOpen, loadAssignableStaff]);

  const selectedId = selected?.id;
  useEffect(() => {
    if (!selectedId) {
      setActivities([]);
      return;
    }
    void api.getJobActivities(selectedId).then(setActivities).catch(() => setActivities([]));
  }, [selectedId]);

  const openScheduleDialog = () => {
    const defaultEngineerId = assignableStaff.find((s) => s.id === user?.id)?.id ?? "";
    setForm({ serviceRequestId: "", engineerId: defaultEngineerId, scheduledFor: todayInputValue() });
    setDialogOpen(true);
  };

  const saveJob = async () => {
    if (!form.serviceRequestId || !form.engineerId) return;
    setSaving(true);
    try {
      await api.createJob({
        serviceRequestId: form.serviceRequestId,
        engineerId: form.engineerId,
        scheduledFor: form.scheduledFor,
      });
      toast({ title: "Job scheduled", description: "Service job created successfully." });
      setDialogOpen(false);
      setForm({ serviceRequestId: "", engineerId: "", scheduledFor: todayInputValue() });
      await loadJobs();
      await loadRequests();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Unable to create job";
      toast({ title: "Save failed", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateJobStatus = async (status: string, progress?: number) => {
    if (!selected) return;
    try {
      const updated = await api.updateJob(selected.id, {
        status,
        ...(progress !== undefined ? { progress } : {}),
      });
      setSelected(updated);
      await loadJobs();
      toast({ title: "Status updated", description: `Job moved to ${JOB_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status}.` });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Unable to update job";
      toast({ title: "Update failed", description: message, variant: "destructive" });
    }
  };

  const completeJob = async () => {
    if (!selected) return;
    try {
      await api.updateJob(selected.id, { status: "completed", progress: 100 });
      const doc = await api.generateDocument("service-report", selected.id);
      toast({
        title: "Job completed",
        description: "Service report PDF generated.",
      });
      if (doc.file?.id) {
        window.open(api.fileDownloadUrl(doc.file.id), "_blank");
      }
      setSelected(null);
      await loadJobs();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Unable to update job";
      toast({ title: "Update failed", description: message, variant: "destructive" });
    }
  };

  const handleUploadPhotos = async () => {
    if (!selected || photoFiles.length === 0) {
      toast({ title: "No photos selected", description: "Choose at least one photo to upload.", variant: "destructive" });
      return;
    }
    setActionSaving(true);
    try {
      const photos = [];
      for (const file of photoFiles) {
        const uploaded = await api.uploadFile(file);
        photos.push({ fileId: uploaded.id, filename: uploaded.originalName, mimeType: uploaded.mimeType });
      }
      const result = await api.uploadJobPhotos(selected.id, photos);
      setSelected(result.job);
      toast({
        title: "Photos uploaded",
        description: `${photoFiles.length} photo(s) attached to ${selected.reference}.`,
      });
      setPhotoFiles([]);
      setPhotosOpen(false);
      await loadJobs();
      const acts = await api.getJobActivities(selected.id);
      setActivities(acts);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Upload failed";
      toast({ title: "Upload failed", description: message, variant: "destructive" });
    } finally {
      setActionSaving(false);
    }
  };

  const handleScopeChange = async () => {
    if (!selected || !partsNote.trim()) {
      toast({ title: "Details required", description: "Describe the extra parts or scope change.", variant: "destructive" });
      return;
    }
    setActionSaving(true);
    try {
      await api.addJobExtra(selected.id, {
        description: partsNote.trim().slice(0, 120),
        reason: partsNote.trim(),
        quantity: 1,
        unitPrice: 0,
        taxRate: 0,
      });
      toast({ title: "Scope change submitted", description: "Routed for Admin/Estimator approval." });
      setPartsNote("");
      setPartsOpen(false);
      const acts = await api.getJobActivities(selected.id);
      setActivities(acts);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Request failed";
      toast({ title: "Request failed", description: message, variant: "destructive" });
    } finally {
      setActionSaving(false);
    }
  };

  const handleCaptureSignature = async () => {
    if (!selected || !customerName.trim() || !signatureData) {
      toast({ title: "Signature required", description: "Enter the customer name and draw the signature.", variant: "destructive" });
      return;
    }
    setActionSaving(true);
    try {
      const result = await api.captureJobSignature(selected.id, {
        customerName: customerName.trim(),
        signatureData,
      });
      setSelected(result.job);
      toast({ title: "Signature captured", description: `Signed by ${customerName.trim()}` });
      setCustomerName("");
      setSignatureData(null);
      setSignatureOpen(false);
      await loadJobs();
      const acts = await api.getJobActivities(selected.id);
      setActivities(acts);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Signature failed";
      toast({ title: "Signature failed", description: message, variant: "destructive" });
    } finally {
      setActionSaving(false);
    }
  };

  const openStockDialog = async () => {
    setStockOpen(true);
    setStockItemId("");
    setStockQty(1);
    try {
      const items = await api.listInventory(branchId);
      setInventory(items);
    } catch {
      setInventory([]);
    }
  };

  const handleDeductStock = async () => {
    if (!selected || !stockItemId) {
      toast({ title: "Select an item", description: "Choose inventory to deduct.", variant: "destructive" });
      return;
    }
    const item = inventory.find((i) => i.id === stockItemId);
    if (!item || stockQty < 1 || stockQty > item.inStock) {
      toast({ title: "Invalid quantity", description: `Available: ${item?.inStock ?? 0}`, variant: "destructive" });
      return;
    }
    setActionSaving(true);
    try {
      const result = await api.deductJobStock(selected.id, { inventoryItemId: stockItemId, quantity: stockQty });
      setSelected(result.job);
      toast({
        title: "Stock deducted",
        description: `${stockQty} × ${item.name} deducted from inventory.`,
      });
      setStockOpen(false);
      await loadJobs();
      const acts = await api.getJobActivities(selected.id);
      setActivities(acts);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Deduction failed";
      toast({ title: "Deduction failed", description: message, variant: "destructive" });
    } finally {
      setActionSaving(false);
    }
  };

  const handleShortagePurchase = async () => {
    const item = inventory.find((candidate) => candidate.id === stockItemId);
    if (!item || stockQty <= item.inStock) return;
    setActionSaving(true);
    try {
      await api.createItemizedPurchaseOrder({
        supplier: item.supplier,
        branchId: branchId === "all" ? item.branchId : branchId,
        expectedDate: defaultDatePlusDays(7),
        lines: [{
          inventoryItemId: item.id,
          sku: item.sku,
          description: `${item.name} — shortage for ${selected?.reference ?? "service job"}`,
          quantityOrdered: stockQty - item.inStock,
          unitCost: Number(item.unitCost),
          taxRate: 0,
        }],
      });
      setStockOpen(false);
      toast({ title: "Purchase order created", description: `Shortage of ${stockQty - item.inStock} × ${item.name} sent to purchasing.` });
    } catch (error) {
      toast({ title: "Purchase action failed", description: error instanceof ApiError ? error.message : "Request failed", variant: "destructive" });
    } finally {
      setActionSaving(false);
    }
  };

  const selectedApiStatus = selected ? toApiJobStatus(formatJobStatus(selected.status)) : "";

  return (
    <RoleGuard roles={["admin", "coordinator", "engineer"]}>
      <div className="space-y-6">
        <PageHeader
          title="Service Jobs"
          description={isEngineer ? "Your assigned jobs — update status and complete field actions." : "Track repair, maintenance and calibration jobs."}
          actions={
            canCreate ? (
              <Button onClick={openScheduleDialog} variant="brand">
                <Plus className="mr-1 h-4 w-4" /> Schedule Job
              </Button>
            ) : undefined
          }
        />

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading jobs…
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
            {columns.map((col) => {
              const items = jobs.filter((j) => formatJobStatus(j.status) === col.status);
              return (
                <div key={col.status} className="flex flex-col rounded-2xl border border-border/70 bg-card/55 p-3 shadow-sm backdrop-blur">
                  <div className="mb-3 flex items-center justify-between px-1">
                    <span className="text-sm font-semibold">{col.label}</span>
                    <span className="rounded-full border border-primary/10 bg-secondary px-2.5 py-0.5 text-xs font-semibold text-primary">{items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {items.map((j) => (
                      <Card key={j.id} onClick={() => setSelected(j)} className="cursor-pointer space-y-2 p-3 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-elevated">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs text-muted-foreground">{j.reference}</span>
                          <StatusBadge status={formatJobStatus(j.status)} />
                        </div>
                        <p className="text-sm font-medium leading-snug">{j.equipmentName}</p>
                        <p className="text-xs text-muted-foreground">{j.customerName} · {j.type}</p>
                        <Progress value={j.progress} className="h-1.5" />
                      </Card>
                    ))}
                    {items.length === 0 && <p className="px-1 py-6 text-center text-xs text-muted-foreground">No jobs</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Schedule Service Job</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Service request</Label>
              <Select value={form.serviceRequestId} onValueChange={(v) => setForm({ ...form, serviceRequestId: v })}>
                <SelectTrigger><SelectValue placeholder="Select request" /></SelectTrigger>
                <SelectContent>
                  {requests.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.reference} · {r.equipmentName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Assign to</Label>
              {loadingStaff ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading staff…
                </div>
              ) : (
                <Select value={form.engineerId} onValueChange={(v) => setForm({ ...form, engineerId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select service engineer or coordinator" /></SelectTrigger>
                  <SelectContent>
                    {assignableStaff.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} · {roleLabels[s.role as Role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-xs text-muted-foreground">Only Service Engineer or Service Coordinator can be assigned.</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="scheduled">Scheduled for</Label>
              <Input id="scheduled" type="date" value={form.scheduledFor} onChange={(e) => setForm({ ...form, scheduledFor: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveJob} disabled={saving || !form.serviceRequestId || !form.engineerId}>Schedule job</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <SheetTitle>{selected.reference}</SheetTitle>
                  <StatusBadge status={formatJobStatus(selected.status)} />
                </div>
                <SheetDescription>{selected.equipmentName} · {selected.customerName}</SheetDescription>
              </SheetHeader>
              <div className="mt-5 space-y-4">
                <div className="rounded-lg border border-border p-3">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{selected.progress}%</span>
                  </div>
                  <Progress value={selected.progress} className="h-2" />
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Info label="Engineer" value={selected.engineer} />
                  <Info label="Type" value={selected.type} />
                  <Info label="Scheduled" value={formatDate(selected.scheduledFor)} />
                  <Info label="Request" value={selected.requestRef} />
                </div>

                {canUpdateJob && selected.status !== "completed" && (
                  <div className="space-y-2">
                    <Label>Update Status</Label>
                    <Select
                      value={selectedApiStatus}
                      onValueChange={(v) => void updateJobStatus(v)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {JOB_STATUS_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {canUpdateJob && selected.status !== "completed" && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Field Actions</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Action icon={Camera} label="Upload Photos" onClick={() => setPhotosOpen(true)} />
                      <Action icon={PlusCircle} label="Request Extra Scope" onClick={() => setPartsOpen(true)} />
                      <Action icon={FileSignature} label="Capture Signature" onClick={() => setSignatureOpen(true)} />
                      <Action icon={PackageMinus} label="Deduct Stock" onClick={() => void openStockDialog()} />
                    </div>
                  </div>
                )}

                {canUpdateJob && selected.status !== "completed" && (
                  <Button className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90" onClick={completeJob}>
                    Complete & Generate Report PDF
                  </Button>
                )}

                {activities.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Activity</p>
                    <ol className="space-y-2 border-l border-border pl-3">
                      {activities.map((a) => (
                        <li key={a.id} className="text-xs">
                          <p className="font-medium">{a.action}</p>
                          <p className="text-muted-foreground">
                            {a.actor} · {formatDateTime(a.createdAt)}
                            {a.note ? ` — ${a.note}` : ""}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Upload Photos */}
      <Dialog open={photosOpen} onOpenChange={setPhotosOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Upload Photos</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <p className="text-sm text-muted-foreground">Attach before/after photos for this service job.</p>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => setPhotoFiles(Array.from(e.target.files ?? []))}
            />
            <Button variant="outline" onClick={() => photoInputRef.current?.click()}>
              <Camera className="mr-2 h-4 w-4" />
              {photoFiles.length > 0 ? `${photoFiles.length} photo(s) selected` : "Choose photos"}
            </Button>
            {photoFiles.length > 0 && (
              <ul className="text-xs text-muted-foreground space-y-1">
                {photoFiles.map((f) => <li key={f.name}>{f.name}</li>)}
              </ul>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPhotosOpen(false); setPhotoFiles([]); }}>Cancel</Button>
            <Button onClick={handleUploadPhotos} disabled={actionSaving || photoFiles.length === 0}>
              {actionSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Upload & Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Parts */}
      <Dialog open={partsOpen} onOpenChange={setPartsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Request Additional Parts / Scope Change</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <p className="text-sm text-muted-foreground">Creates a supplementary request for Admin/Estimator approval. Does not edit the approved estimate.</p>
            <Textarea
              placeholder="Extra parts, quantity, or scope change reason…"
              value={partsNote}
              onChange={(e) => setPartsNote(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPartsOpen(false); setPartsNote(""); }}>Cancel</Button>
            <Button onClick={handleScopeChange} disabled={actionSaving || !partsNote.trim()}>
              {actionSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit for Approval"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Capture Signature */}
      <Dialog open={signatureOpen} onOpenChange={setSignatureOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Capture Signature</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <p className="text-sm text-muted-foreground">Record customer sign-off. Job status will move to Review.</p>
            <div className="grid gap-2">
              <Label htmlFor="customer-sign">Customer name</Label>
              <Input
                id="customer-sign"
                placeholder="Customer full name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
            <SignaturePad onChange={setSignatureData} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSignatureOpen(false); setCustomerName(""); setSignatureData(null); }}>Cancel</Button>
            <Button onClick={handleCaptureSignature} disabled={actionSaving || !customerName.trim() || !signatureData}>
              {actionSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Sign-off"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deduct Stock */}
      <Dialog open={stockOpen} onOpenChange={setStockOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Deduct Stock</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <p className="text-sm text-muted-foreground">Deduct parts used from branch inventory for this job.</p>
            <div className="grid gap-2">
              <Label>Inventory item</Label>
              <Select value={stockItemId} onValueChange={setStockItemId}>
                <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                <SelectContent>
                  {inventory.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name} ({i.sku}) — {i.inStock} in stock
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="stock-qty">Quantity</Label>
              <Input
                id="stock-qty"
                type="number"
                min={1}
                value={stockQty}
                onChange={(e) => setStockQty(Number(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStockOpen(false)}>Cancel</Button>
            {stockItemId && stockQty > (inventory.find((item) => item.id === stockItemId)?.inStock ?? 0) ? (
              <Button onClick={handleShortagePurchase} disabled={actionSaving}>
                {actionSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Create PO for shortage
              </Button>
            ) : (
              <Button onClick={handleDeductStock} disabled={actionSaving || !stockItemId}>
                {actionSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Deduct & Update"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleGuard>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium capitalize">{value}</p>
    </div>
  );
}

function Action({ icon: Icon, label, onClick }: { icon: typeof Camera; label: string; onClick: () => void }) {
  return (
    <Button variant="outline" className="h-auto flex-col gap-1.5 py-3" onClick={onClick}>
      <Icon className="h-4 w-4" />
      <span className="text-xs">{label}</span>
    </Button>
  );
}
