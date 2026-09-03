import { useEffect, useMemo, useState } from "react";
import {
  api,
  type BackendJobPhoto,
  type BackendJobWorkLog,
  type BackendServiceJob,
  type JobPhotoInput,
} from "@/lib/api";
import { toast } from "@/lib/toast";

const REC_MARKER = "\n\nRecommendation:\n";

const AUTO_PREFIXES = [
  "Field work started",
  "Work paused — parts pending",
  "Work paused — awaiting review",
  "Job completed",
  "Customer sign-off captured",
];

export function isNarrativeWorkLog(log: BackendJobWorkLog) {
  const text = (log.workPerformed ?? "").trim();
  return !AUTO_PREFIXES.some((prefix) => text === prefix || text.startsWith(`${prefix}\n`));
}

export function pickWorkReportLog(logs: BackendJobWorkLog[] | undefined | null) {
  if (!logs?.length) return null;
  const sorted = [...logs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return sorted.find(isNarrativeWorkLog) ?? null;
}

export function splitCalibrationRecommendation(raw: string | null | undefined) {
  const text = raw ?? "";
  const idx = text.indexOf(REC_MARKER);
  if (idx >= 0) {
    return {
      calibrationResult: text.slice(0, idx),
      recommendation: text.slice(idx + REC_MARKER.length),
    };
  }
  if (text.startsWith("Recommendation:\n")) {
    return { calibrationResult: "", recommendation: text.slice("Recommendation:\n".length) };
  }
  return { calibrationResult: text, recommendation: "" };
}

export function useJobWorkReportEditor(onSaved?: () => Promise<void> | void) {
  const [job, setJob] = useState<BackendServiceJob | null>(null);
  const [existingLog, setExistingLog] = useState<BackendJobWorkLog | null>(null);
  const [existingPhotos, setExistingPhotos] = useState<BackendJobPhoto[]>([]);
  const [workPerformed, setWorkPerformed] = useState("");
  const [testingResult, setTestingResult] = useState("");
  const [calibrationResult, setCalibrationResult] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [newImages, setNewImages] = useState<File[]>([]);
  const [imageCaptions, setImageCaptions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const newImagePreviews = useMemo(
    () => newImages.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [newImages],
  );

  useEffect(
    () => () => {
      newImagePreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
    },
    [newImagePreviews],
  );

  const resetForm = () => {
    setExistingLog(null);
    setExistingPhotos([]);
    setWorkPerformed("");
    setTestingResult("");
    setCalibrationResult("");
    setRecommendation("");
    setNewImages([]);
    setImageCaptions([]);
  };

  const openReport = (record: BackendServiceJob) => {
    setJob(record);
    resetForm();
    const log = pickWorkReportLog(record.workLogs);
    setExistingLog(log);
    setExistingPhotos(record.photos ?? []);
    if (log) {
      setWorkPerformed(log.workPerformed ?? "");
      setTestingResult(log.testingResult ?? "");
      const split = splitCalibrationRecommendation(log.calibrationResult);
      setCalibrationResult(split.calibrationResult);
      setRecommendation(split.recommendation);
    }
  };

  const closePanel = () => {
    if (saving) return;
    setJob(null);
  };

  const submitReport = async () => {
    if (!job || saving) return;
    if (!workPerformed.trim()) {
      toast({ title: "Work details required", description: "Describe the work performed.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const result = await api.saveJobWorkReport(job.id, {
        workPerformed: workPerformed.trim(),
        testingResult: testingResult.trim() || null,
        calibrationResult: calibrationResult.trim() || null,
        recommendation: recommendation.trim() || null,
      });

      if (newImages.length > 0) {
        const photos: JobPhotoInput[] = [];
        for (let i = 0; i < newImages.length; i++) {
          const uploaded = await api.uploadFile(newImages[i]);
          const caption = imageCaptions[i]?.trim();
          photos.push({
            fileId: uploaded.id,
            filename: uploaded.originalName,
            mimeType: uploaded.mimeType,
            ...(caption ? { caption } : {}),
          });
        }
        await api.uploadJobPhotos(job.id, photos);
      }

      toast({
        title: existingLog ? "Work report updated" : "Work report saved",
        description: newImages.length
          ? `${newImages.length} photo(s) attached.`
          : "You can update details and add more photos anytime before completion.",
      });
      setJob(null);
      await onSaved?.();
      return result.job;
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to save work report" });
      return null;
    } finally {
      setSaving(false);
    }
  };

  return {
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
    newImages,
    setNewImages,
    imageCaptions,
    setImageCaptions,
    newImagePreviews,
    saving,
    openReport,
    closePanel,
    submitReport,
  };
}
