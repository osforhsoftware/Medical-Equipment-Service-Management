export type JobQaStage = {
  result?: "pass" | "fail";
  notes?: string | null;
  checkedAt?: string | null;
  checkedBy?: string | null;
  checklist?: {
    repairVerified?: boolean;
    testingPassed?: boolean;
    calibrationChecked?: boolean;
    cleanlinessOk?: boolean;
    docsReady?: boolean;
  } | null;
};

export type JobDeliveryStage = {
  method?: string | null;
  note?: string | null;
  receivedBy?: string | null;
  deliveredAt?: string | null;
  confirmedBy?: string | null;
  courier?: {
    name?: string | null;
    waybill?: string | null;
    dispatchDate?: string | null;
    estimatedDeliveryDate?: string | null;
  } | null;
};

export type JobStageDetails = {
  qa?: JobQaStage;
  delivery?: JobDeliveryStage;
};

export const JOB_WORKFLOW_STAGES = [
  { id: "repair", label: "Repair", description: "Field work & parts" },
  { id: "qa", label: "QA", description: "Quality check" },
  { id: "delivery", label: "Delivery", description: "Handoff to customer" },
] as const;

export type JobWorkflowStageId = (typeof JOB_WORKFLOW_STAGES)[number]["id"];

export function parseJobStageDetails(value: unknown): JobStageDetails {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const qa =
    raw.qa && typeof raw.qa === "object" && !Array.isArray(raw.qa)
      ? (raw.qa as JobQaStage)
      : undefined;
  const delivery =
    raw.delivery && typeof raw.delivery === "object" && !Array.isArray(raw.delivery)
      ? (raw.delivery as JobDeliveryStage)
      : undefined;
  return {
    ...(qa ? { qa } : {}),
    ...(delivery ? { delivery } : {}),
  };
}

/** Map job status → Repair / QA / Delivery stage (completed counts as delivery done). */
export function jobWorkflowStage(status: string): JobWorkflowStageId | "done" {
  if (status === "completed") return "done";
  if (status === "delivery") return "delivery";
  if (status === "review") return "qa";
  return "repair";
}

export function jobWorkflowStageIndex(status: string): number {
  const stage = jobWorkflowStage(status);
  if (stage === "done") return JOB_WORKFLOW_STAGES.length;
  return JOB_WORKFLOW_STAGES.findIndex((s) => s.id === stage);
}

export const DELIVERY_METHOD_OPTIONS = [
  { value: "customer_pickup", label: "Customer pickup" },
  { value: "site_return", label: "Returned on site" },
  { value: "courier", label: "Courier / shipping" },
  { value: "other", label: "Other" },
] as const;
