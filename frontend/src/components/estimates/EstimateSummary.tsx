import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

interface EstimateSummaryProps {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  className?: string;
  footer?: string;
}

export function EstimateSummary({
  subtotal,
  discount,
  tax,
  total,
  className,
  footer = "Final totals are calculated server-side.",
}: EstimateSummaryProps) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-4", className)}>
      <h2 className="section-title mb-4">Estimate Summary</h2>
      <dl className="space-y-2.5 text-sm">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <dt className="shrink-0 text-muted-foreground">Subtotal</dt>
          <dd className="overflow-num text-right" title={formatCurrency(subtotal)}>{formatCurrency(subtotal)}</dd>
        </div>
        <div className="flex min-w-0 items-center justify-between gap-3">
          <dt className="shrink-0 text-muted-foreground">Discount</dt>
          <dd className="overflow-num text-right" title={`-${formatCurrency(discount)}`}>-{formatCurrency(discount)}</dd>
        </div>
        <div className="flex min-w-0 items-center justify-between gap-3">
          <dt className="shrink-0 text-muted-foreground">Tax</dt>
          <dd className="overflow-num text-right" title={formatCurrency(tax)}>{formatCurrency(tax)}</dd>
        </div>
        <div className="flex min-w-0 items-center justify-between gap-3 border-t border-border pt-3">
          <dt className="shrink-0 text-base font-semibold">Total</dt>
          <dd className="overflow-num text-right text-xl font-semibold tracking-tight" title={formatCurrency(total)}>
            {formatCurrency(total)}
          </dd>
        </div>
      </dl>
      {footer ? <p className="mt-3 text-xs text-muted-foreground">{footer}</p> : null}
    </div>
  );
}
