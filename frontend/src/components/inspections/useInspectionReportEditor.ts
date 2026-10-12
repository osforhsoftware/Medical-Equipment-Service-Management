import { useEffect, useMemo, useState } from "react";
import {
  api,
  type BackendCatalogItem,
  type BackendInspectionReport,
  type BackendInventoryItem,
  type BackendServiceRequest,
} from "@/lib/api";
import {
  parseCustomerAdditionalFields,
  sanitizeCustomerAdditionalFields,
  type CustomerAdditionalField,
} from "@/lib/customerFields";
import { formatServiceStatus } from "@/lib/format";
import { toast } from "@/lib/toast";

const WORK_DETAILS_MARKER = "\n\nWork details:\n";

export type RequestedItemDraft = {
  type: "part" | "service";
  inventoryItemId: string;
  catalogItemId: string;
  quantity: number;
};

export function splitInspectionFindings(raw: string) {
  const idx = raw.indexOf(WORK_DETAILS_MARKER);
  if (idx >= 0) {
    return {
      findings: raw.slice(0, idx),
      workDetails: raw.slice(idx + WORK_DETAILS_MARKER.length),
    };
  }
  return { findings: raw, workDetails: "" };
}

export function useInspectionReportEditor(onSaved?: () => Promise<void> | void) {
  const [active, setActive] = useState<BackendServiceRequest | null>(null);
  const [existingReport, setExistingReport] = useState<BackendInspectionReport | null>(null);
  const [findings, setFindings] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [workDetails, setWorkDetails] = useState("");
  const [machineImage, setMachineImage] = useState<File | null>(null);
  const [machineImages, setMachineImages] = useState<File[]>([]);
  const [imageCaptions, setImageCaptions] = useState<string[]>([]);
  const [severity, setSeverity] = useState("medium");
  const [additionalFields, setAdditionalFields] = useState<CustomerAdditionalField[]>([
    { label: "", value: "" },
  ]);
  const [recommendedParts, setRecommendedParts] = useState<RequestedItemDraft[]>([]);
  const [inventory, setInventory] = useState<BackendInventoryItem[]>([]);
  const [serviceCatalog, setServiceCatalog] = useState<BackendCatalogItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);

  const newImagePreviews = useMemo(
    () => machineImages.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [machineImages],
  );

  useEffect(
    () => () => {
      newImagePreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
    },
    [newImagePreviews],
  );

  const resetFormState = () => {
    setFindings("");
    setRecommendation("");
    setWorkDetails("");
    setMachineImage(null);
    setMachineImages([]);
    setImageCaptions([]);
    setSeverity("medium");
    setAdditionalFields([{ label: "", value: "" }]);
    setRecommendedParts([]);
    setExistingReport(null);
  };

  const startInspection = async (task: BackendServiceRequest) => {
    setActive(task);
    resetFormState();

    if (formatServiceStatus(task.status) === "new" || task.status === "new") {
      try {
        await api.advanceWorkflow(task.id, {
          status: "inspection",
          note: "Inspection started",
        });
        await onSaved?.();
      } catch (err) {
        toast.apiError(err, { fallback: "Unable to start inspection for this ticket." });
        setActive(null);
        return;
      }
    }

    setLoadingReport(true);
    try {
      const [inventoryItems, catalogItems] = await Promise.all([
        api.listInventory({ limit: 100, page: 1, status: "active" })
          .then((r) => r.data)
          .catch(() => [] as BackendInventoryItem[]),
        api.listServiceCatalog().catch(() => [] as BackendCatalogItem[]),
      ]);
      setInventory(inventoryItems);
      setServiceCatalog(catalogItems.filter((item) => item.isActive));
      const report = await api.getInspectionReport(task.id);
      if (report) {
        const split = splitInspectionFindings(report.findings ?? "");
        const fields = parseCustomerAdditionalFields(report.additionalFields);
        setExistingReport(report);
        setFindings(split.findings);
        setWorkDetails(split.workDetails);
        setRecommendation(report.recommendation);
        setSeverity(report.severity);
        setAdditionalFields(fields.length ? fields : [{ label: "", value: "" }]);
        setRecommendedParts(
          (report.recommendations ?? [])
            .filter((item) => item.inventoryItemId || item.catalogItemId)
            .map((item) => ({
              type: item.type === "service" || item.catalogItemId ? "service" as const : "part" as const,
              inventoryItemId: item.inventoryItemId ?? "",
              catalogItemId: item.catalogItemId ?? "",
              quantity: Math.max(1, Math.ceil(Number(item.quantity) || 1)),
            })),
        );
      }
    } catch {
      /* no report yet */
    } finally {
      setLoadingReport(false);
    }
  };

  const closePanel = () => {
    if (saving) return;
    setActive(null);
  };

  const submitReport = async () => {
    if (!active || saving) return;

    setSaving(true);
    try {
      const files = machineImages.length > 0 ? machineImages : machineImage ? [machineImage] : [];
      const attachments: { fileId: string; caption?: string }[] = [];
      for (let i = 0; i < files.length; i++) {
        const uploaded = await api.uploadFile(files[i]);
        const caption = imageCaptions[i]?.trim();
        attachments.push({ fileId: uploaded.id, ...(caption ? { caption } : {}) });
      }

      await api.saveInspectionReport(active.id, {
        findings: [findings.trim(), workDetails.trim() ? `Work details:\n${workDetails.trim()}` : ""]
          .filter(Boolean)
          .join("\n\n"),
        recommendation: recommendation.trim(),
        severity,
        attachments,
        attachmentFileIds: attachments.map((item) => item.fileId),
        additionalFields: sanitizeCustomerAdditionalFields(additionalFields),
        recommendedParts: recommendedParts
          .filter((item) =>
            item.quantity > 0 && (item.type === "service" ? item.catalogItemId : item.inventoryItemId),
          )
          .map((item) => ({
            type: item.type,
            ...(item.type === "service"
              ? { catalogItemId: item.catalogItemId }
              : { inventoryItemId: item.inventoryItemId }),
            quantity: Math.max(1, Math.ceil(Number(item.quantity) || 1)),
          })),
        submit: true,
      });

      toast.success("Inspection report submitted", {
        description: "The service request has moved to Estimate.",
      });
      setActive(null);
      await onSaved?.();
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to submit inspection report. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  return {
    active,
    existingReport,
    loadingReport,
    saving,
    findings,
    setFindings,
    recommendation,
    setRecommendation,
    workDetails,
    setWorkDetails,
    severity,
    setSeverity,
    additionalFields,
    setAdditionalFields,
    recommendedParts,
    setRecommendedParts,
    inventory,
    serviceCatalog,
    machineImages,
    setMachineImages,
    setMachineImage,
    imageCaptions,
    setImageCaptions,
    newImagePreviews,
    startInspection,
    closePanel,
    submitReport,
  };
}
