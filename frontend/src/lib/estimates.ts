import type { BackendEstimate, BackendEstimateLine, EstimateLineInput } from "@/lib/api";
import type { DocumentLine } from "@/components/shared/ProfessionalDocument";
import { parseAmount } from "@/lib/format";

export const ESTIMATE_STATUS_OPTIONS = [
  { label: "Draft", value: "draft" },
  { label: "Pending Approval", value: "pendingAdminApproval" },
  { label: "Sent", value: "sent" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "Revision Required", value: "revision" },
  { label: "Converted", value: "converted" },
] as const;

export const ESTIMATE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pendingAdminApproval: "Pending Approval",
  sent: "Sent",
  approved: "Approved",
  rejected: "Rejected",
  revision: "Revision Required",
  converted: "Converted",
};

export const ESTIMATE_LINE_TYPES = [
  { value: "labor", label: "Labor" },
  { value: "part", label: "Part" },
  { value: "service", label: "Service" },
  { value: "custom", label: "Custom" },
  { value: "transport", label: "Delivery / logistics" },
  { value: "testing", label: "Testing" },
  { value: "calibration", label: "Calibration" },
  { value: "other", label: "Other" },
] as const;

export const ESTIMATE_WORKFLOW_STEPS = [
  "Details",
  "Line Items",
  "Totals",
  "Review",
  "Approval",
] as const;

export function estimateStatusLabel(status: string) {
  return ESTIMATE_STATUS_LABELS[status] ?? status.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function isEstimatePendingDecision(status: string) {
  return status === "pendingAdminApproval" || status === "sent" || status === "revision";
}

export function canEditEstimate(status: string) {
  return status === "draft" || status === "revision" || status === "rejected";
}

/**
 * Estimate money math. Mirror of backend/src/lib/estimateTotals.ts —
 * keep the two implementations on the same rules.
 *
 * line_gross    = qty × unit_price
 * line_discount = discount clamped to [0, line_gross] (percent discounts converted first)
 * line_taxable  = line_gross − line_discount
 * line_tax      = line_taxable × tax% / 100
 * line_total    = line_taxable + line_tax
 * subtotal      = Σ line_gross
 * discount      = Σ line_discount + estimate-level discount
 * tax           = Σ line_tax
 * total         = max(0, subtotal − discount + tax)
 *
 * Amounts stay unrounded until the summary figures, which are rounded to 2 decimals.
 */
export type EstimatePricedLine = {
  quantity?: unknown;
  unitPrice?: unknown;
  discount?: unknown;
  /** "percent" means `discount` is a percent of line gross. Anything else is a rupee amount. */
  discountType?: unknown;
  taxRate?: unknown;
};

export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const sign = value < 0 ? -1 : 1;
  const cents = Math.round((Math.abs(value) + Number.EPSILON) * 100);
  return (sign * cents) / 100;
}

function amount(value: unknown): number {
  const n = parseAmount(value);
  return Number.isFinite(n) ? n : 0;
}

export function priceLine(line: EstimatePricedLine) {
  const gross = amount(line.quantity) * amount(line.unitPrice);
  const rawDiscount = amount(line.discount);
  const type = String(line.discountType ?? "amount").toLowerCase();
  const discountAmount =
    type === "percent" || type === "percentage" || type === "pct"
      ? (gross * rawDiscount) / 100
      : rawDiscount;
  const discount = Math.min(Math.max(0, discountAmount), Math.max(0, gross));
  const taxable = gross - discount;
  const tax = (taxable * amount(line.taxRate)) / 100;
  return { gross, discount, taxable, tax, total: taxable + tax };
}

export function lineNet(line: EstimatePricedLine) {
  return priceLine(line).taxable;
}

export function lineTotal(line: EstimatePricedLine) {
  return priceLine(line).total;
}

export function summarizeLines(lines: EstimatePricedLine[], estimateLevelDiscount = 0) {
  let subtotal = 0;
  let lineDiscount = 0;
  let tax = 0;
  for (const line of lines) {
    const priced = priceLine(line);
    subtotal += priced.gross;
    lineDiscount += priced.discount;
    tax += priced.tax;
  }
  const headerDiscount = Math.max(0, amount(estimateLevelDiscount));
  const subtotalRounded = roundMoney(subtotal);
  const discountRounded = roundMoney(lineDiscount + headerDiscount);
  const taxRounded = roundMoney(tax);
  return {
    subtotal: subtotalRounded,
    discount: discountRounded,
    tax: taxRounded,
    total: roundMoney(Math.max(0, subtotalRounded - discountRounded + taxRounded)),
    lineDiscount: roundMoney(lineDiscount),
    headerDiscount: roundMoney(headerDiscount),
  };
}

type EstimateTotalsSource = {
  discount?: unknown;
  subtotal?: unknown;
  tax?: unknown;
  total?: unknown;
  lineItems?: EstimatePricedLine[] | null;
  revisions?: Array<{ revision?: number; snapshot?: unknown }> | null;
};

function latestRevisionSnapshot(estimate: EstimateTotalsSource) {
  const revisions = estimate.revisions ?? [];
  if (!revisions.length) return undefined;
  return [...revisions].sort((a, b) => Number(b.revision ?? 0) - Number(a.revision ?? 0))[0]?.snapshot;
}

/** Estimate-level discount only. Line discounts stay on the lines so they are not added twice. */
export function estimateLevelDiscount(estimate: EstimateTotalsSource): number {
  const snapshot = latestRevisionSnapshot(estimate);
  if (snapshot && typeof snapshot === "object" && snapshot !== null && "headerDiscount" in snapshot) {
    return Math.max(0, amount((snapshot as { headerDiscount?: unknown }).headerDiscount));
  }
  const lines = estimate.lineItems ?? [];
  if (lines.length) {
    const gross = roundMoney(lines.reduce((sum, line) => sum + priceLine(line).gross, 0));
    const storedSubtotal = amount(estimate.subtotal);
    if (Math.abs(storedSubtotal - gross) < 0.02) {
      const lineDiscount = lines.reduce((sum, line) => sum + priceLine(line).discount, 0);
      return Math.max(0, roundMoney(amount(estimate.discount) - lineDiscount));
    }
  }
  return Math.max(0, amount(estimate.discount));
}

export function totalsForEstimate(estimate: EstimateTotalsSource) {
  const lines = estimate.lineItems ?? [];
  if (lines.length) return summarizeLines(lines, estimateLevelDiscount(estimate));
  return {
    subtotal: roundMoney(amount(estimate.subtotal)),
    discount: roundMoney(Math.max(0, amount(estimate.discount))),
    tax: roundMoney(Math.max(0, amount(estimate.tax))),
    total: roundMoney(Math.max(0, amount(estimate.total))),
    lineDiscount: 0,
    headerDiscount: roundMoney(Math.max(0, amount(estimate.discount))),
  };
}

export function newEstimateLine(taxRate = 0, partial?: Partial<EstimateLineInput>): EstimateLineInput {
  return {
    type: "service",
    description: "",
    quantity: 1,
    unitPrice: 0,
    taxRate,
    discount: 0,
    ...partial,
  };
}

export function fallbackEstimateLines(estimate: BackendEstimate): DocumentLine[] {
  return [
    ...(Number(estimate.laborCost)
      ? [{ id: "labor", description: "Services and labor", quantity: 1, unitPrice: Number(estimate.laborCost), taxRate: 0 }]
      : []),
    ...(Number(estimate.partsCost)
      ? [{ id: "parts", description: "Products and parts", quantity: 1, unitPrice: Number(estimate.partsCost), taxRate: 0 }]
      : []),
  ];
}

export function estimateToDocumentLines(estimate: BackendEstimate): DocumentLine[] {
  if (estimate.lineItems?.length) {
    return estimate.lineItems.map((line) => mapEstimateLine(line));
  }
  return fallbackEstimateLines(estimate);
}

export function mapEstimateLine(line: BackendEstimateLine): DocumentLine {
  return {
    id: line.id,
    description: line.partNumber ? `${line.description} (${line.partNumber})` : line.description,
    type: line.type,
    quantity: Number(line.quantity),
    unitPrice: Number(line.unitPrice),
    discount: Number(line.discount),
    taxRate: Number(line.taxRate),
  };
}

export function formatLineType(type: string) {
  return ESTIMATE_LINE_TYPES.find((item) => item.value === type)?.label
    ?? type.replace(/_/g, " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

export function workflowStepIndex(status?: string | null, hasLines = false, hasValidity = false) {
  if (
    status === "pendingAdminApproval" ||
    status === "sent" ||
    status === "approved" ||
    status === "rejected" ||
    status === "converted"
  ) {
    return 4;
  }
  if (!status || status === "draft" || status === "revision") {
    if (!hasValidity) return 0;
    if (!hasLines) return 1;
    return 3;
  }
  return 4;
}
