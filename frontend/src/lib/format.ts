const SERVICE_STATUS_LABELS: Record<string, string> = {
  new: "New",
  inspection: "Inspection",
  estimate: "Estimate",
  pending_approval: "Pending approval",
  assigned_engineer: "Assigned engineer",
  change_pending_approval: "Change pending approval",
  pending_final_approval: "Pending final approval",
  pending_invoice: "Pending invoice",
  invoiced: "Invoiced",
  closed: "Closed",
  approval: "Pending approval",
  inProgress: "In progress",
  completed: "Completed",
  finished: "Closed",
};

export function formatServiceStatus(status: string) {
  if (status === "inProgress") return "in-progress";
  return SERVICE_STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

export function toApiServiceStatus(status: string) {
  return status === "in-progress" ? "inProgress" : status;
}

export function formatJobStatus(status: string) {
  if (status === "inProgress") return "in-progress";
  if (status === "partsPending") return "parts-pending";
  return status;
}

export function toApiJobStatus(status: string) {
  if (status === "in-progress") return "inProgress";
  if (status === "parts-pending") return "partsPending";
  return status;
}

export function formatTransferStatus(status: string) {
  return status === "inTransit" ? "in-transit" : status;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatFileTimestamp(file: File) {
  return formatDateTime(file.lastModified ? new Date(file.lastModified) : new Date());
}

export const CURRENCY_SYMBOL = "₹";

export function toMoney(value: string | number) {
  return Number(value).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function formatCurrency(value: string | number) {
  return `${CURRENCY_SYMBOL}${toMoney(value)}`;
}

export function formatCurrencyShort(amount: number) {
  if (amount >= 1_000_000) return `${CURRENCY_SYMBOL}${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${CURRENCY_SYMBOL}${(amount / 1_000).toFixed(1)}k`;
  return `${CURRENCY_SYMBOL}${amount.toFixed(0)}`;
}

export function defaultDatePlusDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatRelativeTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return "Just now";

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "Just now";

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr${diffHr === 1 ? "" : "s"} ago`;

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;

  return formatDate(value);
}

export function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}
