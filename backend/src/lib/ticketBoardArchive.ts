/** Statuses shown in the Service Tickets Kanban "Completed" column. */
export const BOARD_COMPLETED_STATUSES = [
  "completed",
  "pending_invoice",
  "invoiced",
  "closed",
  "finished",
] as const;

export type BoardCompletedStatus = (typeof BOARD_COMPLETED_STATUSES)[number];

/** Days a completed ticket stays on the active board before soft-hiding to Archive. */
export const COMPLETED_BOARD_RETENTION_DAYS = 7;

export type CompletedScope = "recent" | "archive" | "all";

export function parseCompletedScope(raw: unknown): CompletedScope {
  if (raw === "archive" || raw === "all" || raw === "recent") return raw;
  // Default: show all completed on the board (paginated via See more).
  return "all";
}

export function isBoardCompletedStatus(status: string | null | undefined): boolean {
  return Boolean(status && (BOARD_COMPLETED_STATUSES as readonly string[]).includes(status));
}

export function completedBoardCutoff(now = new Date()): Date {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - COMPLETED_BOARD_RETENTION_DAYS);
  return cutoff;
}

/**
 * When status moves into/out of the board Completed bucket, set or clear completedAt.
 * Keeps the first entry timestamp if already set (re-entering billing states).
 */
export function completedAtForStatusChange(args: {
  previousStatus?: string | null;
  nextStatus: string;
  existingCompletedAt?: Date | null;
  now?: Date;
}): Date | null | undefined {
  const nextIsCompleted = isBoardCompletedStatus(args.nextStatus);
  const prevIsCompleted = isBoardCompletedStatus(args.previousStatus);
  if (nextIsCompleted && !prevIsCompleted) {
    return args.existingCompletedAt ?? args.now ?? new Date();
  }
  if (!nextIsCompleted && prevIsCompleted) {
    return null;
  }
  return undefined;
}
