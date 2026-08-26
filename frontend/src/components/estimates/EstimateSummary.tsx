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
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd>{formatCurrency(subtotal)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Discount</dt>
          <dd>-{formatCurrency(discount)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Tax</dt>
          <dd>{formatCurrency(tax)}</dd>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-3">
          <dt className="text-base font-semibold">Total</dt>
          <dd className="text-xl font-semibold tracking-tight">{formatCurrency(total)}</dd>
        </div>
      </dl>
      {footer ? <p className="mt-3 text-xs text-muted-foreground">{footer}</p> : null}
    </div>
  );
}
