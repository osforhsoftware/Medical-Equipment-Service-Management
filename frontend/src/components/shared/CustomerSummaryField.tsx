import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  customerDocumentSummary,
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
}: CustomerSummaryFieldProps) {
  const summary = customerDocumentSummary(lines, { label: value, headerDiscount });
  const shownTotal = total ?? summary.total;

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>Customer summary</Label>
      {readOnly ? (
        <p className="text-sm font-medium">{summary.label}</p>
      ) : (
        <Input
          id={id}
          value={value}
          disabled={disabled}
          maxLength={200}
          placeholder="Machine Service"
          onChange={(event) => onChange?.(event.target.value)}
        />
      )}
      <p className="text-xs text-muted-foreground">
        Shown on the customer copy as one line. Leave it blank to use Service. The amount is calculated from the lines.
      </p>
      <p className="text-sm">
        <span className="text-muted-foreground">{summary.label}</span>{" "}
        {formatCurrency(summary.workAmount)}
        {summary.showServiceCharge ? (
          <>
            {" "}
            · <span className="text-muted-foreground">Service Charge</span>{" "}
            {formatCurrency(summary.serviceAmount)}
          </>
        ) : null}
        {" "}
        · <span className="font-medium">Total {formatCurrency(shownTotal)}</span>
      </p>
    </div>
  );
}
