import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  customerDocumentSummary,
  DEFAULT_CUSTOMER_SUMMARY_LABEL,
  type CustomerSummaryLine,
} from "@/lib/customerDocumentSummary";
import { formatCurrency } from "@/lib/format";

interface CustomerSummaryFieldProps {
  id: string;
  value: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  lines: CustomerSummaryLine[];
  headerDiscount?: number;
  total?: number;
  readOnly?: boolean;
  /** Compact footer style under the item table. */
  embedded?: boolean;
}

export function CustomerSummaryField({
  id,
  value,
  onChange,
  disabled,
  lines,
  headerDiscount = 0,
  total,
  readOnly = false,
  embedded = false,
}: CustomerSummaryFieldProps) {
  const summary = customerDocumentSummary(lines, { label: value, headerDiscount });
  const shownTotal = total ?? summary.total;
  const label = summary.label;

  return (
    <div className={embedded ? "grid gap-2 border-t border-border bg-muted/20 px-4 py-3" : "grid gap-2"}>
      <Label htmlFor={id}>Customize Items</Label>
      {readOnly ? (
        <p className="text-sm font-medium">{value.trim() || DEFAULT_CUSTOMER_SUMMARY_LABEL}</p>
      ) : (
        <Input
          id={id}
          value={value}
          disabled={disabled}
          maxLength={200}
          placeholder={DEFAULT_CUSTOMER_SUMMARY_LABEL}
          onChange={(event) => onChange?.(event.target.value)}
        />
      )}
      <p className="text-xs text-muted-foreground">
        Customer print and PDF show only a Description and Price summary. The item label defaults to{" "}
        <span className="font-medium text-foreground">{DEFAULT_CUSTOMER_SUMMARY_LABEL}</span>. Internal
        categories such as Products or Other stay on the staff form only.
      </p>
      <div className="rounded-md border border-border bg-background px-3 py-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Customer line</span>
          <span className="font-medium">
            {label} · {formatCurrency(summary.workAmount)}
          </span>
        </div>
        {summary.showServiceCharge ? (
          <div className="mt-1 flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Service Charge</span>
            <span className="font-medium">{formatCurrency(summary.serviceAmount)}</span>
          </div>
        ) : null}
        <div className="mt-1 flex items-center justify-between gap-3 border-t border-border pt-1">
          <span className="text-muted-foreground">Total</span>
          <span className="font-semibold">{formatCurrency(shownTotal)}</span>
        </div>
      </div>
    </div>
  );
}
