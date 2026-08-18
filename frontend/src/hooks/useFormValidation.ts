import { useCallback, useState } from "react";
import type { ZodSchema } from "zod";
import {
  clearFieldError,
  focusFirstInvalidField,
  parseApiFieldErrors,
  validateFieldWithSchema,
  validateWithSchema,
  type FieldErrors,
} from "@/lib/formValidation";

type UseFormValidationOptions<T> = {
  fieldOrder: string[];
  schema?: ZodSchema<T>;
  validate?: (values: T) => FieldErrors;
};

export function useFormValidation<T>(options: UseFormValidationOptions<T>) {
  const { fieldOrder, schema, validate } = options;
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);

  const shouldShow = useCallback(
    (field: string) => Boolean(errors[field] && (touched[field] || submitted)),
    [errors, touched, submitted],
  );

  const reset = useCallback(() => {
    setErrors({});
    setTouched({});
    setSubmitted(false);
  }, []);

  const markTouched = useCallback((field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  const clearError = useCallback((field: string) => {
    setErrors((prev) => clearFieldError(prev, field));
  }, []);

  const runValidation = useCallback(
    (values: T, extraErrors?: FieldErrors): FieldErrors => {
      let fieldErrors: FieldErrors = {};

      if (schema) {
        const schemaErrors = validateWithSchema(schema, values);
        if (schemaErrors) fieldErrors = { ...fieldErrors, ...schemaErrors };
      }

      if (validate) {
        fieldErrors = { ...fieldErrors, ...validate(values) };
      }

      if (extraErrors) {
        fieldErrors = { ...fieldErrors, ...extraErrors };
      }

      return fieldErrors;
    },
    [schema, validate],
  );

  const validateAll = useCallback(
    (values: T, extraErrors?: FieldErrors, container?: HTMLElement | null): boolean => {
      const fieldErrors = runValidation(values, extraErrors);

      if (Object.keys(fieldErrors).length > 0) {
        setSubmitted(true);
        setErrors(fieldErrors);
        setTouched((prev) => {
          const next = { ...prev };
          for (const key of Object.keys(fieldErrors)) {
            next[key] = true;
          }
          return next;
        });
        focusFirstInvalidField(fieldErrors, fieldOrder, container);
        return false;
      }

      setErrors({});
      return true;
    },
    [fieldOrder, runValidation],
  );

  const handleBlur = useCallback(
    (field: string, values: T) => {
      markTouched(field);
      if (!schema) return;

      const message = validateFieldWithSchema(schema, field, values);
      setErrors((prev) => {
        if (message) return { ...prev, [field]: message };
        return clearFieldError(prev, field);
      });
    },
    [markTouched, schema],
  );

  const handleChange = useCallback(
    (field: string, values: T) => {
      if (!errors[field]) return;

      if (schema) {
        const message = validateFieldWithSchema(schema, field, values);
        setErrors((prev) => {
          if (message) return { ...prev, [field]: message };
          return clearFieldError(prev, field);
        });
        return;
      }

      if (validate) {
        const fieldErrors = validate(values);
        setErrors((prev) => {
          if (fieldErrors[field]) return { ...prev, [field]: fieldErrors[field] };
          return clearFieldError(prev, field);
        });
      }
    },
    [errors, schema, validate],
  );

  const applyApiErrors = useCallback(
    (error: unknown, container?: HTMLElement | null): boolean => {
      const { fieldErrors, hasFieldErrors } = parseApiFieldErrors(error);
      if (!hasFieldErrors) return false;

      setSubmitted(true);
      setErrors((prev) => ({ ...prev, ...fieldErrors }));
      setTouched((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(fieldErrors)) {
          next[key] = true;
        }
        return next;
      });
      focusFirstInvalidField(fieldErrors, fieldOrder, container);
      return true;
    },
    [fieldOrder],
  );

  return {
    errors,
    touched,
    submitted,
    shouldShow,
    reset,
    markTouched,
    clearError,
    validateAll,
    handleBlur,
    handleChange,
    applyApiErrors,
    setErrors,
  };
}
