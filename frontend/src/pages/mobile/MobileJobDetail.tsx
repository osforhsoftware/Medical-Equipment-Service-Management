import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
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
import { FormFieldError } from "@/components/shared/FormFieldError";
import { RequiredMark } from "@/components/shared/RequiredMark";
import { PhotoCaptionTile } from "@/components/shared/PhotoCaptionTile";
import { SignaturePad } from "@/components/shared/SignaturePad";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { useFormValidation } from "@/hooks/useFormValidation";
import { fieldAria, fieldErrorClass, fieldRules, type FieldErrors } from "@/lib/formValidation";
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
import { api, type BackendInventoryItem, type BackendServiceJob, type JobPhotoInput } from "@/lib/api";
import { formatFixedOption, SERVICE_TYPE_OPTIONS } from "@/lib/fixedOptions";
import { defaultDatePlusDays, formatDate, formatDateTime, formatFileTimestamp, formatJobStatus } from "@/lib/format";
import { toast } from "@/lib/toast";

const JOB_STATUS_OPTIONS = [
  { value: "scheduled", label: "Assigned" },
  { value: "inProgress", label: "In Progress" },
  { value: "partsPending", label: "Parts Pending" },
  { value: "review", label: "Review" },
  { value: "completed", label: "Completed" },
] as const;

const scopeSchema = z.object({
  partsNote: fieldRules.requiredString("Scope change reason"),
});

const signatureSchema = z.object({
  customerName: fieldRules.requiredString("Customer name"),
});

function validatePhotos(values: { photoCount: number }): FieldErrors {
  if (values.photoCount > 0) return {};
  return { photos: "Select at least one photo." };
}

function validateStock(
  values: { stockItemId: string; stockQty: number },
  inStock: number,
): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.stockItemId) {
    errors.stockItemId = "Select an inventory item.";
  }
  if (values.stockQty < 1) {
    errors.stockQty = "Quantity must be at least 1.";
  } else if (values.stockItemId && values.stockQty > inStock) {
    errors.stockQty = `Available: ${inStock}. Use Create PO for shortage if needed.`;
  }
  return errors;
}

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
  const [photoCaptions, setPhotoCaptions] = useState<string[]>([]);
  const [partsNote, setPartsNote] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [inventory, setInventory] = useState<BackendInventoryItem[]>([]);
  const [stockItemId, setStockItemId] = useState("");
  const [stockQty, setStockQty] = useState(1);
  const [actionSaving, setActionSaving] = useState(false);
  const photosDrawerRef = useRef<HTMLDivElement>(null);
  const scopeDrawerRef = useRef<HTMLDivElement>(null);
  const signatureDrawerRef = useRef<HTMLDivElement>(null);
  const stockDrawerRef = useRef<HTMLDivElement>(null);

  const photosValidation = useFormValidation({
    fieldOrder: ["photos"],
    validate: validatePhotos,
  });

  const photoPreviews = useMemo(
    () => photoFiles.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [photoFiles],
  );

  useEffect(
    () => () => {
      photoPreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
    },
    [photoPreviews],
  );

  const resetPhotoDraft = () => {
    setPhotoFiles([]);
    setPhotoCaptions([]);
  };
  const scopeValidation = useFormValidation({
    fieldOrder: ["partsNote"],
    schema: scopeSchema,
  });
  const signatureValidation = useFormValidation({
    fieldOrder: ["customerName", "signature"],
    schema: signatureSchema,
  });
  const stockValidation = useFormValidation({
    fieldOrder: ["stockItemId", "stockQty"],
  });

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
    if (!job) return;
    const values = { photoCount: photoFiles.length };
    if (!photosValidation.validateAll(values, undefined, photosDrawerRef.current)) return;

    setActionSaving(true);
    try {
      const photos: JobPhotoInput[] = [];
      for (let i = 0; i < photoFiles.length; i++) {
        const uploaded = await api.uploadFile(photoFiles[i]);
        const caption = photoCaptions[i]?.trim();
        photos.push({
          fileId: uploaded.id,
          filename: uploaded.originalName,
          mimeType: uploaded.mimeType,
          ...(caption ? { caption } : {}),
        });
      }
      const result = await api.uploadJobPhotos(job.id, photos);
      setJob(result.job);
      resetPhotoDraft();
      setPhotosOpen(false);
      photosValidation.reset();
      await load();
    } catch (err) {
      if (!photosValidation.applyApiErrors(err, photosDrawerRef.current)) {
        toast.apiError(err, { fallback: "Upload failed" });
      }
    } finally {
      setActionSaving(false);
    }
  };

  const handleScopeChange = async () => {
    if (!job) return;
    const values = { partsNote };
    if (!scopeValidation.validateAll(values, undefined, scopeDrawerRef.current)) return;

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
      scopeValidation.reset();
      await load();
    } catch (err) {
      if (!scopeValidation.applyApiErrors(err, scopeDrawerRef.current)) {
        toast.apiError(err, { fallback: "Request failed" });
      }
    } finally {
      setActionSaving(false);
    }
  };

  const handleCaptureSignature = async () => {
    if (!job) return;
    const values = { customerName };
    const extraErrors: FieldErrors = {};
    if (!signatureData) extraErrors.signature = "Customer signature is required.";
    if (!signatureValidation.validateAll(values, extraErrors, signatureDrawerRef.current)) return;

    setActionSaving(true);
    try {
      const result = await api.captureJobSignature(job.id, {
        customerName: customerName.trim(),
        signatureData: signatureData!,
      });
      setJob(result.job);
      setCustomerName("");
      setSignatureData(null);
      setSignatureOpen(false);
      signatureValidation.reset();
      await load();
    } catch (err) {
      if (!signatureValidation.applyApiErrors(err, signatureDrawerRef.current)) {
        toast.apiError(err, { fallback: "Signature failed" });
      }
    } finally {
      setActionSaving(false);
    }
  };

  const openStockDialog = async () => {
    setStockOpen(true);
    setStockItemId("");
    setStockQty(1);
    stockValidation.reset();
    try {
      setInventory((await api.listInventory({ limit: 100, page: 1 })).data);
    } catch {
      setInventory([]);
    }
  };

  const handleDeductStock = async () => {
    if (!job) return;
    const item = inventory.find((i) => i.id === stockItemId);
    const inStock = item?.inStock ?? 0;
    const values = { stockItemId, stockQty };
    const fieldErrors = validateStock(values, inStock);
    if (Object.keys(fieldErrors).length > 0) {
      stockValidation.validateAll(values, fieldErrors, stockDrawerRef.current);
      return;
    }

    setActionSaving(true);
    try {
      const result = await api.deductJobStock(job.id, { inventoryItemId: stockItemId, quantity: stockQty });
      setJob(result.job);
      setStockOpen(false);
      stockValidation.reset();
      await load();
    } catch (err) {
      if (!stockValidation.applyApiErrors(err, stockDrawerRef.current)) {
        toast.apiError(err, { fallback: "Deduction failed" });
      }
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
  const stockShortage = stockItemId && stockQty > (inventory.find((item) => item.id === stockItemId)?.inStock ?? 0);

  return (
    <RoleGuard roles={["admin", "coordinator", "engineer"]}>
      <div className="mobile-page pb-8">
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

        <div className="mobile-card mt-4">
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-semibold">{job.progress}%</span>
          </div>
          <Progress value={job.progress} className="h-2" />
        </div>

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

          {(job.photos?.length ?? 0) > 0 ? (
            <CollapsibleSection title="Photos" icon={<Camera className="h-4 w-4" />} defaultOpen>
              <div className="grid grid-cols-2 gap-3">
                {job.photos!.map((photo) => {
                  const src = photo.fileId ? api.fileDownloadUrl(photo.fileId) : "";
                  if (!src) return null;
                  return (
                    <PhotoCaptionTile
                      key={photo.id}
                      src={src}
                      alt={photo.filename}
                      caption={photo.caption ?? ""}
                      href={src}
                      readOnly
                    />
                  );
                })}
              </div>
            </CollapsibleSection>
          ) : null}

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
                <FieldAction icon={Camera} label="Photos" onClick={() => { photosValidation.reset(); resetPhotoDraft(); setPhotosOpen(true); }} />
                <FieldAction icon={PlusCircle} label="Extra Scope" onClick={() => { scopeValidation.reset(); setPartsNote(""); setPartsOpen(true); }} />
                <FieldAction icon={FileSignature} label="Signature" onClick={() => { signatureValidation.reset(); setCustomerName(""); setSignatureData(null); setSignatureOpen(true); }} />
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

      <ActionDrawer open={photosOpen} onOpenChange={(open) => { if (!open) { photosValidation.reset(); resetPhotoDraft(); } setPhotosOpen(open); }} title="Upload Photos" contentRef={photosDrawerRef}>
        <form noValidate onSubmit={(e) => { e.preventDefault(); void handleUploadPhotos(); }}>
          <p className="text-sm text-muted-foreground">Attach before/after photos. Add a time or note for each image.</p>
          <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            setPhotoFiles(files);
            setPhotoCaptions(files.map((file) => formatFileTimestamp(file)));
            photosValidation.clearError("photos");
            photosValidation.handleChange("photos", { photoCount: files.length });
            e.target.value = "";
          }} />
          <button
            type="button"
            className={`mobile-btn-secondary w-full ${fieldErrorClass(photosValidation.shouldShow("photos"))}`}
            {...fieldAria("photos", photosValidation.shouldShow("photos") ? photosValidation.errors.photos : null)}
            data-field="photos"
            onClick={() => photoInputRef.current?.click()}
          >
            <Camera className="mr-2 h-5 w-5" />
            {photoFiles.length > 0 ? `${photoFiles.length} selected` : "Choose photos"}
          </button>
          {photoPreviews.length > 0 ? (
            <div className="mt-3 grid grid-cols-2 gap-3">
              {photoPreviews.map(({ file, url }, index) => (
                <PhotoCaptionTile
                  key={`${file.name}-${file.lastModified}-${index}`}
                  src={url}
                  alt={file.name}
                  caption={photoCaptions[index] ?? ""}
                  onCaptionChange={(value) => {
                    setPhotoCaptions((prev) => {
                      const next = [...prev];
                      next[index] = value;
                      return next;
                    });
                  }}
                  onRemove={() => {
                    const nextFiles = photoFiles.filter((_, i) => i !== index);
                    setPhotoFiles(nextFiles);
                    setPhotoCaptions((prev) => prev.filter((_, i) => i !== index));
                    photosValidation.handleChange("photos", { photoCount: nextFiles.length });
                  }}
                />
              ))}
            </div>
          ) : null}
          {photosValidation.shouldShow("photos") && (
            <FormFieldError field="photos" message={photosValidation.errors.photos} className="mt-2" />
          )}
          <DrawerFooter className="px-0">
            <button type="submit" className="mobile-btn-primary w-full" disabled={actionSaving}>
              {actionSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : "Upload"}
            </button>
          </DrawerFooter>
        </form>
      </ActionDrawer>

      <ActionDrawer open={partsOpen} onOpenChange={(open) => { if (!open) { scopeValidation.reset(); setPartsNote(""); } setPartsOpen(open); }} title="Request Extra Scope" contentRef={scopeDrawerRef}>
        <form noValidate onSubmit={(e) => { e.preventDefault(); void handleScopeChange(); }}>
          <div data-field="partsNote">
            <Label htmlFor="mobile-parts-note" className={scopeValidation.shouldShow("partsNote") ? "text-destructive" : undefined}>
              Scope change details
              <RequiredMark />
            </Label>
            <Textarea
              id="mobile-parts-note"
              name="partsNote"
              className={`mt-1.5 min-h-[120px] rounded-[14px] ${fieldErrorClass(scopeValidation.shouldShow("partsNote"))}`}
              placeholder="Describe extra parts or scope change…"
              value={partsNote}
              {...fieldAria("partsNote", scopeValidation.shouldShow("partsNote") ? scopeValidation.errors.partsNote : null)}
              onChange={(e) => {
                setPartsNote(e.target.value);
                scopeValidation.handleChange("partsNote", { partsNote: e.target.value });
              }}
              onBlur={() => scopeValidation.handleBlur("partsNote", { partsNote })}
            />
            {scopeValidation.shouldShow("partsNote") && (
              <FormFieldError field="partsNote" message={scopeValidation.errors.partsNote} className="mt-2" />
            )}
          </div>
          <DrawerFooter className="px-0">
            <button type="submit" className="mobile-btn-primary w-full" disabled={actionSaving}>
              Submit for Approval
            </button>
          </DrawerFooter>
        </form>
      </ActionDrawer>

      <ActionDrawer open={signatureOpen} onOpenChange={(open) => { if (!open) { signatureValidation.reset(); setCustomerName(""); setSignatureData(null); } setSignatureOpen(open); }} title="Capture Signature" contentRef={signatureDrawerRef}>
        <form noValidate onSubmit={(e) => { e.preventDefault(); void handleCaptureSignature(); }}>
          <div className="space-y-3">
            <div data-field="customerName">
              <Label htmlFor="sign-name" className={signatureValidation.shouldShow("customerName") ? "text-destructive" : undefined}>
                Customer name
                <RequiredMark />
              </Label>
              <Input
                id="sign-name"
                name="customerName"
                className={`mt-1.5 h-12 rounded-[14px] ${fieldErrorClass(signatureValidation.shouldShow("customerName"))}`}
                value={customerName}
                {...fieldAria("customerName", signatureValidation.shouldShow("customerName") ? signatureValidation.errors.customerName : null)}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  signatureValidation.handleChange("customerName", { customerName: e.target.value });
                }}
                onBlur={() => signatureValidation.handleBlur("customerName", { customerName })}
              />
              {signatureValidation.shouldShow("customerName") && (
                <FormFieldError field="customerName" message={signatureValidation.errors.customerName} className="mt-2" />
              )}
            </div>
            <div data-field="signature">
              <SignaturePad
                onChange={(data) => {
                  setSignatureData(data);
                  if (data) signatureValidation.clearError("signature");
                }}
              />
              {signatureValidation.shouldShow("signature") && (
                <FormFieldError field="signature" message={signatureValidation.errors.signature} className="mt-2" />
              )}
            </div>
          </div>
          <DrawerFooter className="px-0">
            <button type="submit" className="mobile-btn-primary w-full" disabled={actionSaving}>
              Confirm Sign-off
            </button>
          </DrawerFooter>
        </form>
      </ActionDrawer>

      <ActionDrawer open={stockOpen} onOpenChange={(open) => { if (!open) stockValidation.reset(); setStockOpen(open); }} title="Deduct Stock" contentRef={stockDrawerRef}>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (stockShortage) void handleShortagePurchase();
            else void handleDeductStock();
          }}
        >
          <div className="space-y-3">
            <div data-field="stockItemId">
              <Label className={stockValidation.shouldShow("stockItemId") ? "text-destructive" : undefined}>
                Inventory item
                <RequiredMark />
              </Label>
              <Select
                value={stockItemId}
                onValueChange={(v) => {
                  setStockItemId(v);
                  stockValidation.clearError("stockItemId");
                  stockValidation.clearError("stockQty");
                }}
              >
                <SelectTrigger
                  className={`mt-1.5 h-12 rounded-[14px] ${fieldErrorClass(stockValidation.shouldShow("stockItemId"))}`}
                  {...fieldAria("stockItemId", stockValidation.shouldShow("stockItemId") ? stockValidation.errors.stockItemId : null)}
                >
                  <SelectValue placeholder="Select item" />
                </SelectTrigger>
                <SelectContent>
                  {inventory.map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.name} — {i.inStock} in stock</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {stockValidation.shouldShow("stockItemId") && (
                <FormFieldError field="stockItemId" message={stockValidation.errors.stockItemId} className="mt-2" />
              )}
            </div>
            <div data-field="stockQty">
              <Label htmlFor="mobile-stock-qty" className={stockValidation.shouldShow("stockQty") ? "text-destructive" : undefined}>
                Quantity
                <RequiredMark />
              </Label>
              <Input
                id="mobile-stock-qty"
                name="stockQty"
                type="number"
                min={1}
                className={`mt-1.5 h-12 rounded-[14px] ${fieldErrorClass(stockValidation.shouldShow("stockQty"))}`}
                value={stockQty}
                {...fieldAria("stockQty", stockValidation.shouldShow("stockQty") ? stockValidation.errors.stockQty : null)}
                onChange={(e) => {
                  setStockQty(Number(e.target.value));
                  stockValidation.clearError("stockQty");
                }}
                onBlur={() => {
                  const item = inventory.find((i) => i.id === stockItemId);
                  const fieldErrors = validateStock({ stockItemId, stockQty }, item?.inStock ?? 0);
                  if (fieldErrors.stockQty) {
                    stockValidation.validateAll({ stockItemId, stockQty }, fieldErrors, stockDrawerRef.current);
                  }
                }}
              />
              {stockValidation.shouldShow("stockQty") && (
                <FormFieldError field="stockQty" message={stockValidation.errors.stockQty} className="mt-2" />
              )}
            </div>
          </div>
          <DrawerFooter className="px-0">
            <button type="submit" className="mobile-btn-primary w-full" disabled={actionSaving}>
              {actionSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : stockShortage ? "Create PO for shortage" : "Deduct & Update"}
            </button>
          </DrawerFooter>
        </form>
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
  contentRef,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  children: ReactNode;
  contentRef?: RefObject<HTMLDivElement>;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="rounded-t-[20px] px-4 pb-safe">
        <DrawerHeader>
          <DrawerTitle className="font-display">{title}</DrawerTitle>
        </DrawerHeader>
        <div ref={contentRef} className="space-y-4 pb-4">{children}</div>
      </DrawerContent>
    </Drawer>
  );
}
