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
  cancelled: "Cancelled",
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

export function formatDate(value: string | Date | null | undefined) {
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

export const CURRENCY_SYMBOL = "₹";

/** Compact Indian grouping once a value would otherwise overflow UI cells. */
const COMPACT_AMOUNT = 1e12;

/** Coerce API decimals, locale strings, and invalid values into a finite number. */
export function parseAmount(value: unknown): number {
  if (value == null || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "bigint") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof value === "object") {
    const maybe = value as { toNumber?: () => number; toString?: () => string };
    if (typeof maybe.toNumber === "function") {
      const n = maybe.toNumber();
      return Number.isFinite(n) ? n : 0;
    }
    const asString = typeof maybe.toString === "function" ? maybe.toString() : "";
    if (asString && asString !== "[object Object]") return parseAmount(asString);
    return 0;
  }

  const cleaned = String(value)
    .trim()
    .replace(/[₹$€£\s]/g, "")
    .replace(/,/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === "-.") return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function formatCompactAmount(n: number) {
  const crores = n / 10_000_000;
  if (Math.abs(crores) >= 10_000_000) return `${crores.toExponential(2)}Cr`;
  return `${crores.toLocaleString("en-IN", { maximumFractionDigits: 2 })}Cr`;
}

function formatGroupedNumber(value: unknown, fractionDigits: { min: number; max: number }) {
  const n = parseAmount(value);
  if (Math.abs(n) >= COMPACT_AMOUNT) return formatCompactAmount(n);
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: fractionDigits.min,
    maximumFractionDigits: fractionDigits.max,
  });
}

export function toMoney(value: unknown) {
  return formatGroupedNumber(value, { min: 0, max: 2 });
}

export function formatCurrency(value: unknown) {
  return `${CURRENCY_SYMBOL}${toMoney(value)}`;
}

/** Invoice/estimate amounts always show two decimal places (₹0.00, ₹1,250.00). */
export function formatDocumentCurrency(value: unknown) {
  return `${CURRENCY_SYMBOL}${formatGroupedNumber(value, { min: 2, max: 2 })}`;
}

/** Integer counts in tables, badges, and stat cards. */
export function formatCount(value: unknown) {
  const n = Math.round(parseAmount(value));
  if (Math.abs(n) >= COMPACT_AMOUNT) return formatCompactAmount(n);
  return n.toLocaleString("en-IN");
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function wordsUnderThousand(n: number) {
  if (n < 20) return ONES[n];
  if (n < 100) return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`;
  return `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${wordsUnderThousand(n % 100)}` : ""}`;
}

/** Indian numbering (Rupees / Paise) for invoice totals. */
export function formatAmountInWords(value: unknown) {
  const amount = Math.max(0, parseAmount(value));
  const rupees = Math.floor(amount + 1e-9);
  const paise = Math.round((amount - rupees) * 100);
  if (rupees === 0 && paise === 0) return "Zero Rupees Only";

  const crore = Math.floor(rupees / 10_000_000);
  const lakh = Math.floor((rupees % 10_000_000) / 100_000);
  const thousand = Math.floor((rupees % 100_000) / 1000);
  const rest = rupees % 1000;
  const parts: string[] = [];
  if (crore) parts.push(`${wordsUnderThousand(crore)} Crore`);
  if (lakh) parts.push(`${wordsUnderThousand(lakh)} Lakh`);
  if (thousand) parts.push(`${wordsUnderThousand(thousand)} Thousand`);
  if (rest) parts.push(wordsUnderThousand(rest));
  const rupeeWords = rupees === 0 ? "Zero Rupees" : `${parts.join(" ")} Rupee${rupees === 1 ? "" : "s"}`;
  const paiseWords = paise ? ` and ${wordsUnderThousand(paise)} Paise` : "";
  return `${rupeeWords}${paiseWords} Only`;
}

export function formatCurrencyShort(amount: unknown) {
  const n = parseAmount(amount);
  if (Math.abs(n) >= 1_000_000) return `${CURRENCY_SYMBOL}${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${CURRENCY_SYMBOL}${(n / 1_000).toFixed(1)}k`;
  return `${CURRENCY_SYMBOL}${n.toFixed(0)}`;
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
