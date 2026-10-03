/**
 * Estimate money math. Mirror of frontend/src/lib/estimates.ts —
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

export type EstimateTotalsSource = {
  discount?: unknown;
  subtotal?: unknown;
  tax?: unknown;
  total?: unknown;
  lineItems?: EstimatePricedLine[] | null;
  revisions?: Array<{ revision?: number; snapshot?: unknown }> | null;
};

export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const sign = value < 0 ? -1 : 1;
  const cents = Math.round((Math.abs(value) + Number.EPSILON) * 100);
  return (sign * cents) / 100;
}

function amount(value: unknown): number {
  if (value == null || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "bigint") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof value === "object") {
    const decimal = value as { toNumber?: () => number };
    if (typeof decimal.toNumber === "function") {
      const n = decimal.toNumber();
      return Number.isFinite(n) ? n : 0;
    }
  }
  const n = Number(value);
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

export function calculateEstimateTotals(lines: EstimatePricedLine[], estimateLevelDiscount = 0) {
  let subtotal = 0;
  let lineDiscount = 0;
  let tax = 0;
  const pricedLines = lines.map((line) => {
    const priced = priceLine(line);
    subtotal += priced.gross;
    lineDiscount += priced.discount;
    tax += priced.tax;
    return priced;
  });
  const headerDiscount = Math.max(0, amount(estimateLevelDiscount));
  const subtotalRounded = roundMoney(subtotal);
  const discountRounded = roundMoney(lineDiscount + headerDiscount);
  const taxRounded = roundMoney(tax);
  return {
    lines: pricedLines,
    subtotal: subtotalRounded,
    discount: discountRounded,
    tax: taxRounded,
    total: roundMoney(Math.max(0, subtotalRounded - discountRounded + taxRounded)),
    lineDiscount: roundMoney(lineDiscount),
    headerDiscount: roundMoney(headerDiscount),
  };
}

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
