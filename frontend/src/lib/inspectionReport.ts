import {
  api,
  type BackendCustomer,
  type BackendEquipment,
  type BackendInspectionReport,
  type BackendServiceRequest,
  type BackendTimelineEvent,
} from "@/lib/api";

export function displayOrFallback(value: unknown, fallback = "Not Provided") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

export function formatJsonField(value: unknown): Array<{ label: string; value: string }> {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item, index) => ({
      label: `Item ${index + 1}`,
      value: typeof item === "string" ? item : JSON.stringify(item),
    }));
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).map(([key, val]) => ({
      label: key.replace(/_/g, " "),
      value: displayOrFallback(val),
    }));
  }
  return [{ label: "Value", value: displayOrFallback(value) }];
}

export interface InspectionReportBundle {
  request: BackendServiceRequest;
  report: BackendInspectionReport;
  customer: BackendCustomer | null;
  equipment: BackendEquipment[];
  timeline: BackendTimelineEvent[];
}

export async function loadInspectionReportBundle(requestId: string): Promise<InspectionReportBundle> {
  const [request, report, timeline] = await Promise.all([
    api.getServiceRequest(requestId),
    api.getInspectionReport(requestId),
    api.getServiceRequestTimeline(requestId).catch(() => [] as BackendTimelineEvent[]),
  ]);

  if (!report) {
    throw new Error("Inspection report not found");
  }

  const customer = request.customerId
    ? await api.getCustomer(request.customerId).catch(() => null)
    : null;

  const equipmentIds = [
    ...(request.equipmentId ? [request.equipmentId] : []),
    ...request.equipmentItems.map((item) => item.equipmentId).filter(Boolean),
  ];
  const uniqueIds = [...new Set(equipmentIds)];
  const equipment = (
    await Promise.all(uniqueIds.map((id) => api.getEquipment(id).catch(() => null)))
  ).filter((item): item is BackendEquipment => Boolean(item));

  return {
    request,
    report,
    customer,
    equipment,
    timeline,
  };
}

export async function downloadInspectionReportPdf(requestId: string) {
  const doc = await api.generateDocument("inspection-report", requestId);
  if (doc.file?.id) {
    window.open(api.fileDownloadUrl(doc.file.id), "_blank");
  }
  return doc;
}
