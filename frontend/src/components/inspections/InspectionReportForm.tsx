import { useRef, type Dispatch, type SetStateAction } from "react";
import { AlertTriangle, Camera, ImagePlus, Loader2, Plus } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PhotoCaptionTile } from "@/components/shared/PhotoCaptionTile";
import {
  api,
  type BackendInspectionReport,
  type BackendServiceRequest,
} from "@/lib/api";
import { formatFileTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";
import { InspectionSection } from "./InspectionSection";

const SEVERITY_OPTIONS = [
  {
    value: "low",
    label: "Low",
    helper: "Minor issue",
    dot: "bg-muted-foreground",
    selected: "border-primary bg-primary/10 text-primary",
  },
  {
    value: "medium",
    label: "Medium",
    helper: "Needs attention",
    dot: "bg-info",
    selected: "border-primary bg-primary/10 text-primary",
  },
  {
    value: "high",
    label: "High",
    helper: "Urgent",
    dot: "bg-warning",
    selected: "border-primary bg-primary/10 text-primary",
  },
  {
    value: "critical",
    label: "Critical",
    helper: "Immediate action",
    dot: "bg-destructive",
    selected: "border-primary bg-primary/10 text-primary",
  },
] as const;

interface InspectionReportFormProps {
  active: BackendServiceRequest;
  existingReport: BackendInspectionReport | null;
  loadingReport: boolean;
  findings: string;
  setFindings: (v: string) => void;
  recommendation: string;
  setRecommendation: (v: string) => void;
  workDetails: string;
  setWorkDetails: (v: string) => void;
  severity: string;
  setSeverity: (v: string) => void;
  machineImages: File[];
  setMachineImages: Dispatch<SetStateAction<File[]>>;
  setMachineImage: (file: File | null) => void;
  imageCaptions: string[];
  setImageCaptions: Dispatch<SetStateAction<string[]>>;
  newImagePreviews: { file: File; url: string }[];
  mobile?: boolean;
}

export function InspectionReportForm({
  active,
  existingReport,
  loadingReport,
  findings,
  setFindings,
  recommendation,
  setRecommendation,
  workDetails,
  setWorkDetails,
  severity,
  setSeverity,
  setMachineImages,
  setMachineImage,
  imageCaptions,
  setImageCaptions,
  newImagePreviews,
  mobile = false,
}: InspectionReportFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const equipmentLabel = active.equipmentItems?.length
    ? active.equipmentItems.map((e) => e.equipmentName).join(", ")
    : (active.equipmentName ?? "Equipment");

  const hasExistingPhotos = Boolean(existingReport?.attachments?.length);
  const hasNewPhotos = newImagePreviews.length > 0;

  const appendFiles = (files: File[]) => {
    if (!files.length) return;
    setMachineImages((prev) => {
      const next = [...prev, ...files];
      setMachineImage(next[0] ?? null);
      return next;
    });
    setImageCaptions((prev) => [...prev, ...files.map((file) => formatFileTimestamp(file))]);
  };

  const removeNewImage = (index: number) => {
    setMachineImages((prev) => {
      const next = prev.filter((_, i) => i !== index);
      setMachineImage(next[0] ?? null);
      return next;
    });
    setImageCaptions((prev) => prev.filter((_, i) => i !== index));
  };

  if (loadingReport) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading existing report…
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", mobile && "pb-2")}>
      {existingReport ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning/10 px-3.5 py-3 text-sm text-warning-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            Updating report filed by <strong>{existingReport.reportedBy}</strong>
          </p>
        </div>
      ) : null}

      <InspectionSection
        step="01"
        title="Severity"
        description="How serious is the issue?"
      >
        <div
          className={cn("grid grid-cols-2 gap-2", !mobile && "sm:grid-cols-4")}
          role="radiogroup"
          aria-label="Severity level"
        >
          {SEVERITY_OPTIONS.map((opt) => {
            const selected = severity === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setSeverity(opt.value)}
                className={cn(
                  "flex min-h-[48px] flex-col items-start justify-center gap-1 rounded-xl border px-3 py-2.5 text-left transition-colors duration-200",
                  selected
                    ? opt.selected
                    : "border-border/70 bg-card text-foreground hover:bg-muted/40",
                )}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", opt.dot)} aria-hidden="true" />
                  {opt.label}
                </span>
                <span className="pl-4 text-[11px] text-muted-foreground">{opt.helper}</span>
              </button>
            );
          })}
        </div>
      </InspectionSection>

      <InspectionSection
        step="02"
        title="Findings & Observations"
        description="Describe what you observed during the inspection."
        optional
      >
        <div className="space-y-2">
          <Label htmlFor="findings" className="sr-only">
            Findings & Observations
          </Label>
          <Textarea
            id="findings"
            data-field="findings"
            value={findings}
            onChange={(e) => setFindings(e.target.value)}
            rows={mobile ? 5 : 4}
            className={cn(mobile && "min-h-[120px] resize-none rounded-xl text-base leading-relaxed")}
            placeholder="Describe the issue, condition, or abnormal behavior…"
          />
        </div>
      </InspectionSection>

      <InspectionSection
        title="Work Details"
        description="Add any work already performed during the inspection."
        optional
        className="opacity-95"
      >
        <Textarea
          id="workDetails"
          value={workDetails}
          onChange={(e) => setWorkDetails(e.target.value)}
          rows={mobile ? 3 : 2}
          className={cn(mobile && "min-h-[88px] resize-none rounded-xl text-base leading-relaxed")}
          placeholder="Tests performed, measurements, error codes…"
        />
      </InspectionSection>

      <InspectionSection
        step="03"
        title="Inspection Photos"
        description={`${equipmentLabel} — attach photos and add a time or note for each image.`}
        optional
      >
        <div data-field="photos">
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => {
            appendFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            appendFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />

        {mobile ? (
          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="mobile-btn-primary !h-12 gap-2 text-sm"
            >
              <Camera className="h-5 w-5" aria-hidden="true" />
              Take Photo
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mobile-btn-secondary !h-12 gap-2 text-sm"
            >
              <ImagePlus className="h-5 w-5" aria-hidden="true" />
              Choose from Gallery
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center transition-colors hover:bg-muted/40"
          >
            <Camera className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-foreground">Add inspection photos</p>
              <p className="mt-0.5 text-xs text-muted-foreground">JPG, PNG · Multiple images</p>
            </div>
          </button>
        )}

        {(hasExistingPhotos || hasNewPhotos) && (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {existingReport?.attachments?.map((att) => (
              <PhotoCaptionTile
                key={att.id}
                src={api.fileDownloadUrl(att.fileId)}
                alt={att.file?.originalName ?? "Inspection image"}
                caption={att.caption ?? ""}
                href={api.fileDownloadUrl(att.fileId)}
                readOnly
              />
            ))}
            {newImagePreviews.map(({ file, url }, index) => (
              <PhotoCaptionTile
                key={`${file.name}-${file.lastModified}-${index}`}
                src={url}
                alt={file.name}
                caption={imageCaptions[index] ?? ""}
                onCaptionChange={(value) => {
                  setImageCaptions((prev) => {
                    const next = [...prev];
                    next[index] = value;
                    return next;
                  });
                }}
                onRemove={() => removeNewImage(index)}
              />
            ))}
            {!mobile ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border/70 bg-card text-muted-foreground transition-colors hover:bg-muted/40"
                aria-label="Add more photos"
              >
                <Plus className="h-5 w-5" />
                <span className="text-[11px] font-medium">Add</span>
              </button>
            ) : null}
          </div>
        )}

        {hasNewPhotos ? (
          <p className="mt-2 text-xs font-medium text-primary">
            {newImagePreviews.length} new photo{newImagePreviews.length === 1 ? "" : "s"} ready to upload
          </p>
        ) : null}
        </div>
      </InspectionSection>

      <InspectionSection
        step="04"
        title="Recommendation"
        description="What should happen next?"
        optional
      >
        <div className="space-y-2">
          <Label htmlFor="recommendation" className="sr-only">
            Recommendation
          </Label>
          <Textarea
            id="recommendation"
            data-field="recommendation"
            value={recommendation}
            onChange={(e) => setRecommendation(e.target.value)}
            rows={mobile ? 4 : 3}
            className={cn(mobile && "min-h-[96px] resize-none rounded-xl text-base leading-relaxed")}
            placeholder="e.g. Replace compressor filter and schedule follow-up calibration…"
          />
        </div>
      </InspectionSection>
    </div>
  );
}
