import { cn } from "@/lib/utils";
import { fieldErrorId } from "@/lib/formValidation";

type FormFieldErrorProps = {
  field: string;
  message?: string | null;
  className?: string;
};

export function FormFieldError({ field, message, className }: FormFieldErrorProps) {
  if (!message) return null;

  return (
    <p id={fieldErrorId(field)} className={cn("text-[12px] text-destructive", className)} role="alert">
      {message}
    </p>
  );
}
