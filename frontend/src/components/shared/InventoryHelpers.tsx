import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";

interface MarginWarningBadgeProps {
  unitPrice: number;
  unitCost: number;
  quantity?: number;
  minMarginPct?: number | null; // Minimum acceptable margin %. Null skips the percent warning.
  className?: string;
}

/** First positive numeric value; treats 0 / NaN as unset (so sellingPrice 0 falls through to unitCost). */
export function firstPositivePrice(
  ...values: Array<string | number | null | undefined>
): number {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

/** Inventory sell price for estimates/billing: prefer selling price, else unit cost. */
export function inventoryOriginUnitPrice(item: {
  sellingPrice?: string | number | null;
  unitCost?: string | number | null;
}): number {
  return firstPositivePrice(item.sellingPrice, item.unitCost);
}

/** Computes margin % = (price - cost) / price * 100 */
export function computeMarginPct(unitPrice: number, unitCost: number): number | null {
  if (unitCost <= 0 || unitPrice <= 0) return null;
  return ((unitPrice - unitCost) / unitPrice) * 100;
}

export type MarginMode = "off" | "fixed" | "on";

/** Minimum margin for a line. Null means the percent check is skipped. */
export function lineMarginMinimum(input: {
  mode?: MarginMode | string | null;
  minMarginPct?: number | null;
  unitCost: number;
  catalogUnitPrice?: number | null;
}): number | null {
  const mode: MarginMode = input.mode === "off" || input.mode === "on" || input.mode === "fixed" ? input.mode : "fixed";
  if (mode === "off") return null;
  if (mode === "fixed") {
    const pct = Number(input.minMarginPct ?? 20);
    if (!Number.isFinite(pct) || pct <= 0) return null;
    return pct;
  }
  const catalogMargin = computeMarginPct(Number(input.catalogUnitPrice ?? 0), input.unitCost);
  if (catalogMargin == null || catalogMargin <= 0) return null;
  return catalogMargin;
}

export function MarginWarningBadge({
  unitPrice,
  unitCost,
  quantity = 1,
  minMarginPct = null,
  className,
}: MarginWarningBadgeProps) {
  if (unitCost <= 0 || unitPrice <= 0) return null;

  const marginPct = computeMarginPct(unitPrice, unitCost);
  if (marginPct === null) return null;

  const profit = (unitPrice - unitCost) * quantity;
  const isBelowCost = unitPrice < unitCost;
  const isBelowMinMargin = minMarginPct != null && minMarginPct > 0 && marginPct < minMarginPct;

  if (!isBelowCost && !isBelowMinMargin) return null;

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md p-2 text-xs",
        isBelowCost
          ? "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800"
          : "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div>
        {isBelowCost ? (
          <>
            <span className="font-semibold">Selling below cost! </span>
            Loss: {formatCurrency(Math.abs(profit))} on this line.
            <span className="ml-1 opacity-75">
              (Cost: {formatCurrency(unitCost)} · Price: {formatCurrency(unitPrice)})
            </span>
          </>
        ) : (
          <>
            <span className="font-semibold">Low margin warning. </span>
            Margin: {marginPct.toFixed(1)}% (min {minMarginPct ?? 0}%).
            <span className="ml-1 opacity-75">
              Profit: {formatCurrency(profit)} · Cost: {formatCurrency(unitCost)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
