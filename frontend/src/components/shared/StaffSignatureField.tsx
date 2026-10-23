import { SignaturePad } from "@/components/shared/SignaturePad";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface StaffSignatureFieldProps {
  /** Role shown above the pad — e.g. "Estimate creator", "Billing staff", "Inspector". */
  label: string;
  value?: string | null;
  onChange: (dataUrl: string | null) => void;
  description?: string;
  className?: string;
  readOnly?: boolean;
}

/**
 * Shared staff signature capture (draw or upload).
 * Use for estimate creator, billing staff, inspector, or any other staff sign-off.
 */
export function StaffSignatureField({
  label,
  value = null,
  onChange,
  description = "Draw on screen or upload a signature image.",
  className,
  readOnly = false,
}: StaffSignatureFieldProps) {
  if (readOnly) {
    return (
      <div className={cn("space-y-2", className)}>
        <Label>{label}</Label>
        {value ? (
          <img
            src={value}
            alt={label}
            className="h-24 w-full rounded-lg border border-border bg-white object-contain"
          />
        ) : (
          <p className="text-sm text-muted-foreground">No signature captured</p>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="space-y-1">
        <Label>{label}</Label>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <SignaturePad value={value} ariaLabel={label} onChange={onChange} />
    </div>
  );
}
