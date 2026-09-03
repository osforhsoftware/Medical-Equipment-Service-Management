import { useRef, type Dispatch, type SetStateAction } from "react";
import { AlertTriangle, Camera, ImagePlus } from "lucide-react";
import { PhotoCaptionTile } from "@/components/shared/PhotoCaptionTile";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { InspectionSection } from "@/components/inspections/InspectionSection";
import { api, type BackendJobPhoto, type BackendJobWorkLog, type BackendServiceJob } from "@/lib/api";
import { cn } from "@/lib/utils";

interface JobWorkReportFormProps {
  job: BackendServiceJob;
  existingLog: BackendJobWorkLog | null;
  existingPhotos: BackendJobPhoto[];
  workPerformed: string;
  setWorkPerformed: (v: string) => void;
  testingResult: string;
  setTestingResult: (v: string) => void;
  calibrationResult: string;
  setCalibrationResult: (v: string) => void;
  recommendation: string;
  setRecommendation: (v: string) => void;
  setNewImages: Dispatch<SetStateAction<File[]>>;
  imageCaptions: string[];
  setImageCaptions: Dispatch<SetStateAction<string[]>>;
  newImagePreviews: { file: File; url: string }[];
  mobile?: boolean;
}

export function JobWorkReportForm({
  job,
  existingLog,
  existingPhotos,
  workPerformed,
  setWorkPerformed,
  testingResult,
  setTestingResult,
  calibrationResult,
  setCalibrationResult,
  recommendation,
  setRecommendation,
  setNewImages,
  imageCaptions,
  setImageCaptions,
  newImagePreviews,
  mobile = false,
}: JobWorkReportFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const appendFiles = (files: File[]) => {
    if (!files.length) return;
    setNewImages((prev) => [...prev, ...files]);
    setImageCaptions((prev) => [...prev, ...files.map(() => "")]);
  };

  const removeNewImage = (index: number) => {
    setNewImages((prev) => prev.filter((_, i) => i !== index));
    setImageCaptions((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className={cn("space-y-6", mobile && "pb-2")}>
      {existingLog ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning/10 px-3.5 py-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          <p>
            Updating the saved work report for <strong className="font-mono">{job.reference}</strong>.
            Add more photos anytime before the job is completed.
          </p>
        </div>
      ) : null}

      <InspectionSection
        step="01"
        title="Work performed"
        description="Describe what you did on site — diagnosis, parts replaced, adjustments."
        required
      >
        <Textarea
          id="work-performed"
          value={workPerformed}
          onChange={(e) => setWorkPerformed(e.target.value)}
          rows={mobile ? 5 : 4}
          className={cn(mobile && "min-h-[120px] resize-none rounded-xl text-base leading-relaxed")}
          placeholder="e.g. Replaced power supply board, verified voltages, cleaned filters…"
        />
      </InspectionSection>

      <InspectionSection
        step="02"
        title="Testing results"
        description="Functional checks after the work."
        optional
      >
        <Textarea
          id="testing-result"
          value={testingResult}
          onChange={(e) => setTestingResult(e.target.value)}
          rows={mobile ? 4 : 3}
          className={cn(mobile && "min-h-[100px] resize-none rounded-xl text-base leading-relaxed")}
          placeholder="e.g. Power-on self-test OK, output within range…"
        />
      </InspectionSection>

      <InspectionSection
        step="03"
        title="Calibration / measurements"
        description="Any calibration values or meter readings."
        optional
      >
        <Textarea
          id="calibration-result"
          value={calibrationResult}
          onChange={(e) => setCalibrationResult(e.target.value)}
          rows={mobile ? 3 : 2}
          className={cn(mobile && "resize-none rounded-xl text-base leading-relaxed")}
          placeholder="Optional calibration notes…"
        />
      </InspectionSection>

      <InspectionSection
        step="04"
        title="Recommendation"
        description="Follow-up advice for the customer or coordinator."
        optional
      >
        <Textarea
          id="recommendation"
          value={recommendation}
          onChange={(e) => setRecommendation(e.target.value)}
          rows={mobile ? 3 : 2}
          className={cn(mobile && "resize-none rounded-xl text-base leading-relaxed")}
          placeholder="e.g. Schedule PM in 6 months; monitor temperature alarms…"
        />
      </InspectionSection>

      <InspectionSection
        step="05"
        title="Photos"
        description="Take photos with the camera or upload from gallery. Captions optional."
        optional
      >
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
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
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted/40",
                mobile && "min-h-11 flex-1 justify-center rounded-xl",
              )}
              onClick={() => cameraInputRef.current?.click()}
            >
              <Camera className="h-4 w-4" />
              Camera
            </button>
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted/40",
                mobile && "min-h-11 flex-1 justify-center rounded-xl",
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus className="h-4 w-4" />
              Upload
            </button>
          </div>

          {existingPhotos.length > 0 ? (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Saved photos</Label>
              <div className="flex flex-wrap gap-3">
                {existingPhotos.map((photo) => {
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
                      className="w-24 sm:w-28"
                    />
                  );
                })}
              </div>
            </div>
          ) : null}

          {newImagePreviews.length > 0 ? (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">New photos to upload</Label>
              <div className="flex flex-wrap gap-3">
                {newImagePreviews.map(({ file, url }, index) => (
                  <PhotoCaptionTile
                    key={`${file.name}-${index}`}
                    src={url}
                    alt={file.name}
                    caption={imageCaptions[index] ?? ""}
                    onCaptionChange={(value) =>
                      setImageCaptions((prev) => prev.map((c, i) => (i === index ? value : c)))
                    }
                    onRemove={() => removeNewImage(index)}
                    className="w-24 sm:w-28"
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </InspectionSection>
    </div>
  );
}
