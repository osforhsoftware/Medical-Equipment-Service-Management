export type JobPartsLineQty = {
  qtyRequested: number;
  qtyApproved: number;
  qtyIssued: number;
  qtyConsumed: number;
  qtyReturned: number;
  qtyScrapped: number;
};

export function issuedRemaining(line: JobPartsLineQty): number {
  return Math.max(0, line.qtyIssued - line.qtyConsumed - line.qtyReturned - line.qtyScrapped);
}

export function approvableRemaining(line: JobPartsLineQty): number {
  return Math.max(0, line.qtyRequested - line.qtyApproved);
}

export function issuableRemaining(line: JobPartsLineQty): number {
  return Math.max(0, line.qtyApproved - line.qtyIssued);
}

export function rollupPartsRequestStatus(
  lines: JobPartsLineQty[],
  current: string,
): string {
  if (current === "rejected") return "rejected";
  if (lines.length === 0) return current;
  const approved = lines.some((line) => line.qtyApproved > 0);
  if (!approved) return current === "approved" ? "approved" : "pending";
  const allClosed = lines.every((line) => {
    if (line.qtyApproved <= 0 && line.qtyIssued <= 0) return true;
    return line.qtyConsumed + line.qtyReturned + line.qtyScrapped >= line.qtyIssued
      && line.qtyIssued >= line.qtyApproved;
  });
  if (allClosed && lines.some((line) => line.qtyIssued > 0)) return "closed";
  const allIssued = lines.every((line) => line.qtyApproved <= 0 || line.qtyIssued >= line.qtyApproved);
  if (allIssued) return "issued";
  return "approved";
}

export function trackingValue(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 191) : null;
}
