import { cn } from "@/lib/utils";
import { CHIP_VARIANT_CLASSES, statusToChipVariant } from "@/lib/workflow";

interface WorkflowStatusChipProps {
  status: string;
  label?: string;
  overdue?: boolean;
  className?: string;
}

export function WorkflowStatusChip({ status, label, overdue, className }: WorkflowStatusChipProps) {
  const variant = statusToChipVariant(status, overdue);
  const display =
    label ??
    status
      .replace(/([A-Z])/g, " $1")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize",
        CHIP_VARIANT_CLASSES[variant],
        className,
      )}
    >
      {display}
    </span>
  );
}
