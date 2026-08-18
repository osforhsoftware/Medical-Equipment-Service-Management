import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { FormFieldError } from "./FormFieldError";
import { RequiredMark } from "./RequiredMark";

type ValidatedFieldProps = {
  label: ReactNode;
  htmlFor?: string;
  field: string;
  error?: string | null;
  showError?: boolean;
  required?: boolean;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function ValidatedField({
  label,
  htmlFor,
  field,
  error,
  showError = Boolean(error),
  required,
  hint,
  className,
  children,
}: ValidatedFieldProps) {
  const visibleError = showError ? error : null;

  return (
    <div className={cn("grid gap-2", className)} data-field={field}>
      <Label htmlFor={htmlFor ?? field} className={cn(visibleError && "text-destructive")}>
        {label}
        {required ? <RequiredMark /> : null}
      </Label>
      {children}
      {visibleError ? (
        <FormFieldError field={field} message={visibleError} />
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
