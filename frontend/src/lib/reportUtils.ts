export function asNumber(value: string | number | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function isoDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const raw = typeof value === "string" ? value : value.toISOString();
  return raw.slice(0, 10);
}

export function isInDateRange(value: string | Date | null | undefined, from: string, to: string): boolean {
  const day = isoDate(value);
  if (!day) return false;
  return day >= from && day <= to;
}

export function matchesQuery(query: string, ...values: Array<string | number | null | undefined>): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return values.some((value) => String(value ?? "").toLowerCase().includes(q));
}

export function daysBetween(start: string | Date | null | undefined, end: string | Date | null | undefined): number {
  if (!start || !end) return 0;
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

export function agingBucket(dueAt: string | Date | null | undefined, now = new Date()): string {
  if (!dueAt) return "No due date";
  const due = new Date(dueAt);
  if (!Number.isFinite(due.getTime())) return "No due date";
  const days = Math.floor((now.getTime() - due.getTime()) / 86_400_000);
  if (days <= 0) return "Current";
  if (days <= 30) return "1–30 days";
  if (days <= 60) return "31–60 days";
  if (days <= 90) return "61–90 days";
  return "90+ days";
}

export const OPEN_JOB_STATUSES = new Set(["scheduled", "inProgress", "partsPending", "review", "delivery"]);
export const CLOSED_TICKET_STATUSES = new Set(["completed", "invoiced", "closed", "finished", "cancelled"]);

export type ReportExportRow = {
  section: string;
  name: string;
  quantity: string | number;
  amount: string | number;
  extra?: string;
};

export type ReportActivityRow = {
  id: string;
  at: string;
  actor: string;
  action: string;
  reference: string;
};
