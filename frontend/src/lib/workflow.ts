/** Service workflow stages — visible on every mobile field-service screen. */
export const WORKFLOW_STAGES = [
  { key: "request", label: "Request" },
  { key: "inspection", label: "Inspection" },
  { key: "estimate", label: "Estimate" },
  { key: "approval", label: "Approval" },
  { key: "service", label: "Service" },
  { key: "billing", label: "Billing" },
  { key: "completed", label: "Completed" },
] as const;

export type WorkflowStageKey = (typeof WORKFLOW_STAGES)[number]["key"];

const REQUEST_STATUS_TO_STAGE: Record<string, WorkflowStageKey> = {
  new: "request",
  inspection: "inspection",
  estimate: "estimate",
  approval: "approval",
  inProgress: "service",
  "in-progress": "service",
  completed: "completed",
  invoiced: "billing",
};

const JOB_STATUS_TO_STAGE: Record<string, WorkflowStageKey> = {
  scheduled: "service",
  inProgress: "service",
  "in-progress": "service",
  partsPending: "service",
  "parts-pending": "service",
  review: "service",
  completed: "completed",
};

export function resolveWorkflowStage(status: string, kind: "request" | "job" = "request"): WorkflowStageKey {
  const map = kind === "job" ? JOB_STATUS_TO_STAGE : REQUEST_STATUS_TO_STAGE;
  return map[status] ?? map[formatStatusKey(status)] ?? "request";
}

function formatStatusKey(status: string) {
  if (status === "inProgress") return "in-progress";
  if (status === "partsPending") return "parts-pending";
  return status;
}

export function workflowStageIndex(stage: WorkflowStageKey): number {
  return WORKFLOW_STAGES.findIndex((s) => s.key === stage);
}

export type WorkflowChipVariant =
  | "assigned"
  | "inspection"
  | "estimate"
  | "in-progress"
  | "completed"
  | "overdue"
  | "ready-billing"
  | "paid"
  | "closed"
  | "default";

export function statusToChipVariant(status: string, overdue = false): WorkflowChipVariant {
  if (overdue) return "overdue";
  const s = formatStatusKey(status);
  if (["new", "scheduled"].includes(s)) return "assigned";
  if (s === "inspection") return "inspection";
  if (s === "estimate") return "estimate";
  if (["approval", "review"].includes(s)) return "estimate";
  if (["in-progress", "inProgress", "parts-pending", "partsPending"].includes(status)) return "in-progress";
  if (s === "completed") return "completed";
  if (["invoiced", "ready-billing", "sent"].includes(s)) return "ready-billing";
  if (s === "paid") return "paid";
  if (s === "closed" || s === "cancelled") return "closed";
  return "default";
}

export const CHIP_VARIANT_CLASSES: Record<WorkflowChipVariant, string> = {
  assigned: "bg-info/15 text-info border-info/25",
  inspection: "bg-warning/15 text-warning-foreground border-warning/30",
  estimate: "bg-violet-500/12 text-violet-700 dark:text-violet-300 border-violet-500/25",
  "in-progress": "bg-accent/15 text-accent border-accent/25",
  completed: "bg-success/15 text-success border-success/25",
  overdue: "bg-destructive/15 text-destructive border-destructive/25",
  "ready-billing": "bg-indigo-500/12 text-indigo-700 dark:text-indigo-300 border-indigo-500/25",
  paid: "bg-emerald-700/12 text-emerald-800 dark:text-emerald-300 border-emerald-700/25",
  closed: "bg-muted text-muted-foreground border-border",
  default: "bg-muted text-muted-foreground border-border",
};
