import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Camera,
  FileSignature,
  HardDrive,
  Loader2,
  MapPin,
  PackageMinus,
  PlusCircle,
  User,
  Wrench,
} from "lucide-react";
import { CollapsibleSection } from "@/components/mobile/CollapsibleSection";
import { WorkflowTimeline } from "@/components/mobile/WorkflowTimeline";
import { WorkflowStatusChip } from "@/components/mobile/WorkflowStatusChip";
import { useMobilePullRefresh } from "@/components/mobile/MobileLayout";
import { SignaturePad } from "@/components/shared/SignaturePad";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Progress } from "@/components/ui/progress";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { api, type BackendInventoryItem, type BackendServiceJob } from "@/lib/api";
import { formatFixedOption, SERVICE_TYPE_OPTIONS } from "@/lib/fixedOptions";
import { defaultDatePlusDays, formatDate, formatDateTime, formatJobStatus } from "@/lib/format";
import { toast } from "@/lib/toast";

const JOB_STATUS_OPTIONS = [
  { value: "scheduled", label: "Assigned" },
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

export default function MobileJobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [job, setJob] = useState<BackendServiceJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<{ id: string; actor: string; action: string; note: string | null; createdAt: string }[]>([]);

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

  const isEngineer = user?.role === "engineer";
  const canUpdateJob = isEngineer || user?.role === "admin" || user?.role === "coordinator";

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [j, acts] = await Promise.all([api.getJob(id), api.getJobActivities(id)]);
      setJob(j);
      setActivities(acts);
    } catch (err) {
      toast.apiError(err, { fallback: "Job not found" });
      navigate("/app/jobs", { replace: true });
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  useMobilePullRefresh(load);

  const updateJobStatus = async (status: string) => {
    if (!job) return;
    try {
      const updated = await api.updateJob(job.id, { status });
      setJob(updated);
      toast({ title: "Status updated" });
      await load();
    } catch (err) {
      toast.apiError(err, { fallback: "Error" });
    }
  };

  const completeJob = async () => {
    if (!job) return;
    try {
      await api.updateJob(job.id, { status: "completed", progress: 100 });
      const doc = await api.generateDocument("service-report", job.id);
      toast({ title: "Job completed", description: "Service report generated." });
      if (doc.file?.id) window.open(api.fileDownloadUrl(doc.file.id), "_blank");
      navigate("/app/jobs");
    } catch (err) {
      toast.apiError(err, { fallback: "Error" });
    }
  };

  const handleUploadPhotos = async () => {
    if (!job || photoFiles.length === 0) return;
    setActionSaving(true);
    try {
      const photos = [];
      for (const file of photoFiles) {
        const uploaded = await api.uploadFile(file);
        photos.push({ fileId: uploaded.id, filename: uploaded.originalName, mimeType: uploaded.mimeType });
      }
      const result = await api.uploadJobPhotos(job.id, photos);
      setJob(result.job);
      setPhotoFiles([]);
      setPhotosOpen(false);
      await load();
    } catch (err) {
      toast({ title: "Upload failed", variant: "destructive" });
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
      setPartsNote("");
      setPartsOpen(false);
      await load();
    } finally {
      setActionSaving(false);
    }
  };

  const handleCaptureSignature = async () => {
    if (!job || !customerName.trim() || !signatureData) return;
    setActionSaving(true);
    try {
      const result = await api.captureJobSignature(job.id, { customerName: customerName.trim(), signatureData });
      setJob(result.job);
      setCustomerName("");
      setSignatureData(null);
      setSignatureOpen(false);
      await load();
    } finally {
      setActionSaving(false);
    }
  };

  const openStockDialog = async () => {
    setStockOpen(true);
    try {
      setInventory(await api.listInventory());
    } catch {
      setInventory([]);
    }
  };

  const handleDeductStock = async () => {
    if (!job || !stockItemId) return;
    setActionSaving(true);
    try {
      const result = await api.deductJobStock(job.id, { inventoryItemId: stockItemId, quantity: stockQty });
      setJob(result.job);
      setStockOpen(false);
      await load();
    } finally {
      setActionSaving(false);
    }
  };

  if (loading || !job) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading job…
      </div>
    );
  }

  const displayStatus = formatJobStatus(job.status);
  const selectedApiStatus = toApiJobStatus(displayStatus);

  return (
    <RoleGuard roles={["admin", "coordinator", "engineer"]}>
      <div className="mobile-page pb-8">
        {/* Sticky header */}
        <div className="mobile-sticky-header">
          <button
            type="button"
            onClick={() => navigate("/app/jobs")}
            className="mobile-icon-btn mb-3"
            aria-label="Back to jobs"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[20px] bg-primary/10">
              <HardDrive className="h-8 w-8 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-xs text-muted-foreground">{job.reference}</p>
              <h1 className="font-display text-xl font-bold text-foreground">{job.equipmentName}</h1>
              <div className="mt-2 flex flex-wrap gap-2">
                <WorkflowStatusChip status={displayStatus} />
              </div>
            </div>
          </div>

          <div className="mobile-glass-card mt-4 p-3">
            <WorkflowTimeline status={displayStatus} kind="job" />
          </div>
        </div>

        {/* Progress */}
        <div className="mobile-card mt-4">
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-semibold">{job.progress}%</span>
          </div>
          <Progress value={job.progress} className="h-2" />
        </div>

        {/* Collapsible sections */}
        <div className="mt-4 space-y-3">
          <CollapsibleSection title="Customer" icon={<MapPin className="h-4 w-4" />} defaultOpen>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Hospital / Customer</dt>
                <dd className="font-medium">{job.customerName}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Request Reference</dt>
                <dd className="font-mono text-sm">{job.requestRef}</dd>
              </div>
            </dl>
          </CollapsibleSection>

          <CollapsibleSection title="Equipment" icon={<HardDrive className="h-4 w-4" />} defaultOpen>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Equipment</dt>
                <dd className="font-medium">{job.equipmentName}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Service Type</dt>
                <dd className="font-medium capitalize">
                  {formatFixedOption(SERVICE_TYPE_OPTIONS, job.type, job.typeOther)}
                </dd>
              </div>
            </dl>
          </CollapsibleSection>

          <CollapsibleSection title="Engineer & Schedule" icon={<User className="h-4 w-4" />}>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Assigned Engineer</dt>
                <dd className="font-medium">{job.engineer}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Scheduled For</dt>
                <dd className="font-medium">{formatDate(job.scheduledFor)}</dd>
              </div>
            </dl>
          </CollapsibleSection>

          {canUpdateJob && job.status !== "completed" && (
            <CollapsibleSection title="Field Actions" icon={<Wrench className="h-4 w-4" />} defaultOpen>
              {canUpdateJob && (
                <div className="mb-4">
                  <Label className="text-xs text-muted-foreground">Update Status</Label>
                  <Select value={selectedApiStatus} onValueChange={(v) => void updateJobStatus(v)}>
                    <SelectTrigger className="mt-1.5 h-12 rounded-[14px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {JOB_STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <FieldAction icon={Camera} label="Photos" onClick={() => setPhotosOpen(true)} />
                <FieldAction icon={PlusCircle} label="Extra Scope" onClick={() => setPartsOpen(true)} />
                <FieldAction icon={FileSignature} label="Signature" onClick={() => setSignatureOpen(true)} />
                <FieldAction icon={PackageMinus} label="Deduct Stock" onClick={() => void openStockDialog()} />
              </div>
            </CollapsibleSection>
          )}

          <CollapsibleSection title="Activity" icon={<Wrench className="h-4 w-4" />}>
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ol className="space-y-3 border-l-2 border-primary/20 pl-4">
                {activities.map((a) => (
                  <li key={a.id} className="text-sm">
                    <p className="font-medium">{a.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.actor} · {formatDateTime(a.createdAt)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </CollapsibleSection>
        </div>

        {canUpdateJob && job.status !== "completed" && (
          <div className="mobile-sticky-footer mt-6">
            <button type="button" className="mobile-btn-primary w-full" onClick={() => void completeJob()}>
              Complete & Generate Report
            </button>
          </div>
        )}
      </div>

      {/* Bottom sheets for field actions */}
      <ActionDrawer open={photosOpen} onOpenChange={setPhotosOpen} title="Upload Photos">
        <p className="text-sm text-muted-foreground">Attach before/after photos for this service job.</p>
        <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => setPhotoFiles(Array.from(e.target.files ?? []))} />
        <button type="button" className="mobile-btn-secondary w-full" onClick={() => photoInputRef.current?.click()}>
          <Camera className="mr-2 h-5 w-5" />
          {photoFiles.length > 0 ? `${photoFiles.length} selected` : "Choose photos"}
        </button>
        <DrawerFooter className="px-0">
          <button type="button" className="mobile-btn-primary w-full" onClick={() => void handleUploadPhotos()} disabled={actionSaving || photoFiles.length === 0}>
            {actionSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : "Upload"}
          </button>
        </DrawerFooter>
      </ActionDrawer>

      <ActionDrawer open={partsOpen} onOpenChange={setPartsOpen} title="Request Extra Scope">
        <Textarea className="min-h-[120px] rounded-[14px]" placeholder="Describe extra parts or scope change…" value={partsNote} onChange={(e) => setPartsNote(e.target.value)} />
        <DrawerFooter className="px-0">
          <button type="button" className="mobile-btn-primary w-full" onClick={() => void handleScopeChange()} disabled={actionSaving || !partsNote.trim()}>
            Submit for Approval
          </button>
        </DrawerFooter>
      </ActionDrawer>

      <ActionDrawer open={signatureOpen} onOpenChange={setSignatureOpen} title="Capture Signature">
        <div className="space-y-3">
          <div>
            <Label htmlFor="sign-name">Customer name</Label>
            <Input id="sign-name" className="mt-1.5 h-12 rounded-[14px]" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </div>
          <SignaturePad onChange={setSignatureData} />
        </div>
        <DrawerFooter className="px-0">
          <button type="button" className="mobile-btn-primary w-full" onClick={() => void handleCaptureSignature()} disabled={actionSaving || !customerName.trim() || !signatureData}>
            Confirm Sign-off
          </button>
        </DrawerFooter>
      </ActionDrawer>

      <ActionDrawer open={stockOpen} onOpenChange={setStockOpen} title="Deduct Stock">
        <div className="space-y-3">
          <Select value={stockItemId} onValueChange={setStockItemId}>
            <SelectTrigger className="h-12 rounded-[14px]"><SelectValue placeholder="Select item" /></SelectTrigger>
            <SelectContent>
              {inventory.map((i) => (
                <SelectItem key={i.id} value={i.id}>{i.name} — {i.inStock} in stock</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="number" min={1} className="h-12 rounded-[14px]" value={stockQty} onChange={(e) => setStockQty(Number(e.target.value))} />
        </div>
        <DrawerFooter className="px-0">
          <button type="button" className="mobile-btn-primary w-full" onClick={() => void handleDeductStock()} disabled={actionSaving || !stockItemId}>
            Deduct & Update
          </button>
        </DrawerFooter>
      </ActionDrawer>
    </RoleGuard>
  );
}

function FieldAction({ icon: Icon, label, onClick }: { icon: typeof Camera; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-2 rounded-[16px] border border-border bg-card p-4 transition-colors active:bg-muted/50">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

function ActionDrawer({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="rounded-t-[20px] px-4 pb-safe">
        <DrawerHeader>
          <DrawerTitle className="font-display">{title}</DrawerTitle>
        </DrawerHeader>
        <div className="space-y-4 pb-4">{children}</div>
      </DrawerContent>
    </Drawer>
  );
}
