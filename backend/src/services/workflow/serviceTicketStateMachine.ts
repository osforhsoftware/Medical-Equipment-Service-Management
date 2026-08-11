import { AppError } from "@/middleware/errorHandler";

/**
 * Canonical ticket lifecycle (DB / API values).
 *
 * Target product vocabulary (Phase 3 naming) maps as:
 *   intake              → new
 *   assigned_inspection → inspection
 *   inspection_complete → estimate   (inspection submitted; estimate stage opens)
 *   estimate_drafted    → estimate
 *   estimate_sent       → approval
 *   estimate_approved   → approval   (approved estimate; job may be scheduled)
 *   job_scheduled       → inProgress (job exists; work underway / ready)
 *   job_in_progress     → inProgress
 *   job_completed       → completed
 *   invoiced            → invoiced
 *   paid / closed       → finished
 *
 * Phase 1 keeps existing enum values to avoid breaking API response shapes.
 */
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

/** Explicit next-state table — only one forward step unless reopen. */
export const TICKET_TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  new: ["inspection"],
  inspection: ["estimate"],
  estimate: ["approval"],
  approval: ["inProgress"],
  inProgress: ["completed"],
  completed: ["invoiced"],
  invoiced: ["finished"],
  finished: [],
};

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

/** Roles allowed to reopen a ticket to an earlier stage. */
export const TICKET_REOPEN_ROLES = ["admin", "coordinator"] as const;

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
  const from = current as TicketStatus;
  const to = target as TicketStatus;
  if (!TICKET_STATUS_ORDER.includes(from)) throw new AppError("Invalid current ticket status", 400);
  if (!TICKET_STATUS_ORDER.includes(to)) throw new AppError("Invalid target status", 400);

  const allowedNext = TICKET_TRANSITIONS[from];
  if (!allowedNext.includes(to)) {
    throw new AppError(
      `Workflow cannot move from ${current} to ${target}. Use reopen to move backward.`,
      409,
    );
  }
  if (!TICKET_TRANSITION_ROLES[to].includes(actorRole)) {
    throw new AppError("Your role cannot perform this workflow transition", 403);
  }
}

export function assertTicketReopen(
  current: string,
  target: string,
  actorRole: string,
): asserts target is TicketStatus {
  const from = current as TicketStatus;
  const to = target as TicketStatus;
  if (!TICKET_STATUS_ORDER.includes(from)) throw new AppError("Invalid current ticket status", 400);
  if (!TICKET_STATUS_ORDER.includes(to)) throw new AppError("Invalid target status", 400);
  if (!(TICKET_REOPEN_ROLES as readonly string[]).includes(actorRole)) {
    throw new AppError("Only administrators and coordinators can reopen a ticket", 403);
  }
  if (from === "finished" && actorRole !== "admin") {
    throw new AppError("Only administrators can reopen a finished ticket", 403);
  }
  const currentIdx = TICKET_STATUS_ORDER.indexOf(from);
  const targetIdx = TICKET_STATUS_ORDER.indexOf(to);
  if (targetIdx >= currentIdx) {
    throw new AppError("Reopen must move to an earlier workflow stage", 409);
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
