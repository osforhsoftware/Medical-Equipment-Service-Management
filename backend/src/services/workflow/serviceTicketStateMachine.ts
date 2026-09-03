import { AppError } from "@/middleware/errorHandler";

/**
 * Canonical ticket lifecycle (DB / API values).
 *
 * Flow:
 *   new → inspection → estimate → pending_approval → assigned_engineer
 *     ↔ change_pending_approval → pending_final_approval → pending_invoice → invoiced → closed
 *
 * Legacy enum values (approval, inProgress, completed, finished) remain readable via normalizeTicketStatus().
 */
export const TICKET_STATUS_ORDER = [
  "new",
  "inspection",
  "estimate",
  "pending_approval",
  "assigned_engineer",
  "change_pending_approval",
  "pending_final_approval",
  "pending_invoice",
  "invoiced",
  "closed",
] as const;

export type TicketStatus = (typeof TICKET_STATUS_ORDER)[number];

/** Map legacy DB statuses to canonical workflow statuses. */
export const LEGACY_STATUS_ALIASES: Record<string, TicketStatus> = {
  approval: "pending_approval",
  inProgress: "assigned_engineer",
  "in-progress": "assigned_engineer",
  completed: "pending_final_approval",
  finished: "closed",
};

export function normalizeTicketStatus(status: string): TicketStatus {
  if ((TICKET_STATUS_ORDER as readonly string[]).includes(status)) return status as TicketStatus;
  return LEGACY_STATUS_ALIASES[status] ?? (status as TicketStatus);
}

/** Explicit next-state table — only one forward step unless reopen or admin reject-back. */
export const TICKET_TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  new: ["inspection"],
  inspection: ["estimate"],
  estimate: ["pending_approval"],
  pending_approval: ["assigned_engineer"],
  assigned_engineer: ["change_pending_approval", "pending_final_approval"],
  change_pending_approval: ["assigned_engineer"],
  pending_final_approval: ["pending_invoice"],
  pending_invoice: ["invoiced"],
  invoiced: ["closed"],
  closed: [],
};

/** Admin/coordinator reject-back targets from pending_approval. */
export const ESTIMATE_REJECT_TARGETS = ["estimate", "inspection"] as const;
export type EstimateRejectTarget = (typeof ESTIMATE_REJECT_TARGETS)[number];

/** Roles allowed to move a ticket *into* each status via advanceWorkflow. */
export const TICKET_TRANSITION_ROLES: Record<TicketStatus, readonly string[]> = {
  new: [],
  inspection: ["admin", "coordinator", "inspector"],
  estimate: ["admin", "coordinator", "inspector"],
  pending_approval: ["admin", "coordinator", "estimator"],
  assigned_engineer: ["admin", "coordinator"],
  change_pending_approval: ["admin", "coordinator", "engineer"],
  pending_final_approval: ["admin", "coordinator", "engineer"],
  pending_invoice: ["admin", "billing"],
  invoiced: ["admin", "billing"],
  closed: ["admin", "coordinator", "billing"],
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
  estimatePendingApproval: "pending_approval",
  estimateApproved: "assigned_engineer",
  estimateRejectedToEstimate: "estimate",
  estimateRejectedToInspection: "inspection",
  /** Coordinator/customer requested changes — return ticket to estimate staff. */
  estimateRevisionRequested: "estimate",
  changeRequestSubmitted: "change_pending_approval",
  changeRequestResolved: "assigned_engineer",
  jobScheduled: "assigned_engineer",
  jobCompleted: "pending_final_approval",
  finalApproved: "pending_invoice",
  invoiceGenerated: "invoiced",
  ticketClosed: "closed",
  // Legacy event aliases
  estimateRejected: "estimate",
  estimateApprovedLegacy: "pending_approval",
  ticketFinished: "closed",
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
  /** Field work must go through coordinator/admin review before completed. */
  inProgress: ["partsPending", "review"],
  partsPending: ["inProgress", "review"],
  review: ["inProgress", "completed"],
  completed: [],
};

export const ESTIMATE_DECISION_FROM = [
  "pendingAdminApproval",
  "sent",
  "revision",
] as const;

export function assertTicketAdvance(
  current: string,
  target: string,
  actorRole: string,
): asserts target is TicketStatus {
  const from = normalizeTicketStatus(current);
  const to = normalizeTicketStatus(target);
  if (!TICKET_STATUS_ORDER.includes(from)) throw new AppError("Invalid current ticket status", 400);
  if (!TICKET_STATUS_ORDER.includes(to)) throw new AppError("Invalid target status", 400);

  const allowedNext = TICKET_TRANSITIONS[from];
  if (!allowedNext.includes(to)) {
    throw new AppError(
      `Workflow cannot move from ${current} to ${target}. Use reopen or dedicated approval actions to move backward.`,
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
  const from = normalizeTicketStatus(current);
  const to = normalizeTicketStatus(target);
  if (!TICKET_STATUS_ORDER.includes(from)) throw new AppError("Invalid current ticket status", 400);
  if (!TICKET_STATUS_ORDER.includes(to)) throw new AppError("Invalid target status", 400);
  if (!(TICKET_REOPEN_ROLES as readonly string[]).includes(actorRole)) {
    throw new AppError("Only administrators and coordinators can reopen a ticket", 403);
  }
  if (from === "closed" && actorRole !== "admin") {
    throw new AppError("Only administrators can reopen a closed ticket", 403);
  }
  const currentIdx = TICKET_STATUS_ORDER.indexOf(from);
  const targetIdx = TICKET_STATUS_ORDER.indexOf(to);
  if (targetIdx >= currentIdx) {
    throw new AppError("Reopen must move to an earlier workflow stage", 409);
  }
}

/** Apply a domain event: allow same status, forward to event target, or controlled reverse. */
export function resolveTicketEventStatus(current: string, event: TicketEvent): TicketStatus {
  const normalized = normalizeTicketStatus(current);
  const target = TICKET_EVENT_TARGETS[event];
  const currentIdx = TICKET_STATUS_ORDER.indexOf(normalized);
  const targetIdx = TICKET_STATUS_ORDER.indexOf(target);
  if (currentIdx < 0) throw new AppError("Invalid current ticket status", 400);
  const allowReverse: TicketEvent[] = [
    "estimateRejected",
    "estimateRejectedToEstimate",
    "estimateRejectedToInspection",
    "estimateRevisionRequested",
    "changeRequestResolved",
  ];
  if (targetIdx < currentIdx && !allowReverse.includes(event)) {
    throw new AppError(`Cannot move ticket from ${current} to ${target} via ${event}`, 409);
  }
  return target;
}

export function assertEstimateDecisionAllowed(status: string) {
  if (!(ESTIMATE_DECISION_FROM as readonly string[]).includes(status)) {
    throw new AppError("Only estimates pending admin approval can receive a decision", 409);
  }
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
