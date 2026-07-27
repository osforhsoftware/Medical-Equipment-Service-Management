import { AppError } from "@/middleware/errorHandler";

export const TICKET_STATUS_ORDER = [
  "new",
  "inspection",
  "estimate",
  "approval",
  "inProgress",
  "completed",
  "invoiced",
  "finished",
] as const;

export type TicketStatus = (typeof TICKET_STATUS_ORDER)[number];

/** Roles allowed to move a ticket *into* each status via advanceWorkflow. */
export const TICKET_TRANSITION_ROLES: Record<TicketStatus, readonly string[]> = {
  new: [],
  inspection: ["admin", "coordinator", "inspector"],
  estimate: ["admin", "coordinator", "inspector"],
  approval: ["admin", "coordinator", "estimator"],
  inProgress: ["admin", "coordinator"],
  completed: ["admin", "coordinator", "engineer"],
  invoiced: ["admin", "billing"],
  finished: ["admin", "coordinator", "billing"],
};

/**
 * Domain event → ticket status mappings. Side-effect writers must use these
 * instead of free-form Prisma patches.
 */
export const TICKET_EVENT_TARGETS = {
  inspectionStarted: "inspection",
  inspectionSubmitted: "estimate",
  estimateCreated: "estimate",
  estimatePendingApproval: "approval",
  estimateApproved: "approval",
  estimateRejected: "estimate",
  jobScheduled: "inProgress",
  jobCompleted: "completed",
  invoiceGenerated: "invoiced",
  ticketFinished: "finished",
} as const satisfies Record<string, TicketStatus>;

export type TicketEvent = keyof typeof TICKET_EVENT_TARGETS;

export const JOB_STATUS_ORDER = [
  "scheduled",
  "inProgress",
  "partsPending",
  "review",
  "completed",
] as const;

export type JobStatus = (typeof JOB_STATUS_ORDER)[number];

/** Allowed job status transitions (from → to[]). */
export const JOB_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  scheduled: ["inProgress", "partsPending"],
  inProgress: ["partsPending", "review", "completed"],
  partsPending: ["inProgress", "review", "completed"],
  review: ["inProgress", "completed"],
  completed: [],
};

export const ESTIMATE_DECISION_FROM = [
  "pendingAdminApproval",
  "sent", // compat for seed / older estimates
  "revision",
] as const;

export function assertTicketAdvance(
  current: string,
  target: string,
  actorRole: string,
): asserts target is TicketStatus {
  const currentIdx = TICKET_STATUS_ORDER.indexOf(current as TicketStatus);
  const targetIdx = TICKET_STATUS_ORDER.indexOf(target as TicketStatus);
  if (targetIdx < 0) throw new AppError("Invalid target status", 400);
  if (currentIdx < 0) throw new AppError("Invalid current ticket status", 400);
  if (targetIdx !== currentIdx + 1) {
    throw new AppError("Workflow can only move to the next stage", 409);
  }
  if (!TICKET_TRANSITION_ROLES[target as TicketStatus].includes(actorRole)) {
    throw new AppError("Your role cannot perform this workflow transition", 403);
  }
}

/** Apply a domain event: allow same status, forward to event target, or controlled reverse. */
export function resolveTicketEventStatus(current: string, event: TicketEvent): TicketStatus {
  const target = TICKET_EVENT_TARGETS[event];
  const currentIdx = TICKET_STATUS_ORDER.indexOf(current as TicketStatus);
  const targetIdx = TICKET_STATUS_ORDER.indexOf(target);
  if (currentIdx < 0) throw new AppError("Invalid current ticket status", 400);
  const allowReverse: TicketEvent[] = ["estimateRejected"];
  if (targetIdx < currentIdx && !allowReverse.includes(event)) {
    throw new AppError(`Cannot move ticket from ${current} to ${target} via ${event}`, 409);
  }
  return target;
}

export function assertJobTransition(current: string, target: string): asserts target is JobStatus {
  if (current === target) return;
  const from = current as JobStatus;
  const to = target as JobStatus;
  if (!JOB_STATUS_ORDER.includes(from) || !JOB_STATUS_ORDER.includes(to)) {
    throw new AppError("Invalid job status", 400);
  }
  if (!JOB_TRANSITIONS[from].includes(to)) {
    throw new AppError(`Job cannot move from ${current} to ${target}`, 409);
  }
}

export function assertEstimateDecisionAllowed(status: string) {
  if (!(ESTIMATE_DECISION_FROM as readonly string[]).includes(status)) {
    throw new AppError("Only estimates pending admin approval can receive a decision", 409);
  }
}
