import type { ZodError, ZodSchema } from "zod";
import { z } from "zod";
import { ApiError } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/toast";
import { cn } from "@/lib/utils";

export type FieldErrors = Record<string, string>;

/** Common Zod field helpers with user-friendly messages. */
export const fieldRules = {
  requiredString: (label: string) => z.string().trim().min(1, `${label} is required.`),
  optionalString: () => z.string().optional(),
  email: (required = true) => {
    const base = z.string().trim();
    if (required) {
      return base.min(1, "Email is required.").email("Enter a valid email address.");
    }
    return base.email("Enter a valid email address.").or(z.literal(""));
  },
  phone: (required = false) => {
    const phonePattern = /^[+]?[\d\s().-]{7,20}$/;
    const base = z.string().trim();
    if (required) {
      return base
        .min(1, "Phone is required.")
        .regex(phonePattern, "Enter a valid phone number.");
    }
    return base.refine((v) => !v || phonePattern.test(v), "Enter a valid phone number.");
  },
  minLength: (label: string, min: number) =>
    z.string().trim().min(min, `Enter at least ${min} characters.`),
  maxLength: (max: number) => z.string().max(max),
  positiveNumber: (label: string) =>
    z.number({ invalid_type_error: `${label} must be a number.` }).gt(0, `${label} must be greater than 0.`),
  nonNegativeNumber: (label: string) =>
    z.number({ invalid_type_error: `${label} must be a number.` }).min(0, `${label} cannot be negative.`),
  selectRequired: (label: string) => z.string().min(1, `Select ${label.toLowerCase()}.`),
  password: (min = 8) =>
    z.string().min(min, `Enter at least ${min} characters.`),
};

export function zodIssuesToFieldErrors(error: ZodError): FieldErrors {
  const fieldErrors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_form");
    if (!fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

export function validateWithSchema<T>(schema: ZodSchema<T>, values: unknown): FieldErrors | null {
  const result = schema.safeParse(values);
  if (result.success) return null;
  return zodIssuesToFieldErrors(result.error);
}

export function validateFieldWithSchema<T>(
  schema: ZodSchema<T>,
  field: string,
  values: unknown,
): string | null {
  const allErrors = validateWithSchema(schema, values);
  return allErrors?.[field] ?? null;
}

const TECHNICAL_MESSAGES: Record<string, string> = {
  "Required": "This field is required.",
  "Invalid email": "Enter a valid email address.",
  "String must contain at least 1 character(s)": "This field is required.",
  "Validation failed": "Please check your input and try again.",
};

export function humanizeValidationMessage(message: string): string {
  const trimmed = message.trim();
  return TECHNICAL_MESSAGES[trimmed] ?? trimmed;
}

/**
 * Parse backend validation errors into field-keyed messages.
 * Supports `"field: message"` strings from Zod middleware and plain messages.
 */
export function parseApiFieldErrors(error: unknown): {
  fieldErrors: FieldErrors;
  globalMessage?: string;
  hasFieldErrors: boolean;
} {
  if (!(error instanceof ApiError)) {
    return { fieldErrors: {}, hasFieldErrors: false };
  }

  const fieldErrors: FieldErrors = {};

  if (error.errors?.length) {
    for (const entry of error.errors) {
      const colonIdx = entry.indexOf(": ");
      if (colonIdx > 0) {
        const path = entry.slice(0, colonIdx).trim();
        const message = humanizeValidationMessage(entry.slice(colonIdx + 2).trim());
        const field = path.split(".").pop() ?? path;
        if (field && message) {
          fieldErrors[field] = message;
        }
      } else if (entry.trim()) {
        // Unstructured error — keep as global fallback
        fieldErrors._form = humanizeValidationMessage(entry.trim());
      }
    }
  }

  const hasFieldErrors = Object.keys(fieldErrors).length > 0;
  const globalMessage = hasFieldErrors ? undefined : getApiErrorMessage(error);

  return { fieldErrors, globalMessage, hasFieldErrors };
}

/** Focus and scroll the first invalid field into view. */
export function focusFirstInvalidField(
  errors: FieldErrors,
  fieldOrder: string[],
  container?: HTMLElement | null,
): void {
  const firstField = fieldOrder.find((field) => Boolean(errors[field]));
  if (!firstField) return;

  const root = container ?? document;
  const selector = `[data-field="${firstField}"], #${CSS.escape(firstField)}, [name="${firstField}"]`;
  const element =
    root.querySelector<HTMLElement>(selector) ??
    document.querySelector<HTMLElement>(selector);

  if (!element) return;

  element.focus({ preventScroll: true });
  element.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

export function fieldErrorId(field: string): string {
  return `${field}-error`;
}

export function fieldAria(field: string, error?: string | null) {
  const hasError = Boolean(error);
  return {
    "aria-invalid": hasError ? (true as const) : undefined,
    "aria-describedby": hasError ? fieldErrorId(field) : undefined,
  };
}

export function fieldErrorClass(hasError: boolean, className?: string) {
  return cn(hasError && "border-destructive focus-visible:ring-destructive", className);
}

export function clearFieldError(errors: FieldErrors, field: string): FieldErrors {
  if (!errors[field]) return errors;
  const next = { ...errors };
  delete next[field];
  return next;
}

export function mergeFieldErrors(...sources: FieldErrors[]): FieldErrors {
  return Object.assign({}, ...sources);
}
