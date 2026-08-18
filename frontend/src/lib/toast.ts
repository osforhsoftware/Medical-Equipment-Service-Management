import type { ReactNode } from "react";
import { toast as sonnerToast, type ExternalToast } from "sonner";
import { ApiError } from "@/lib/api";

export type ToastType = "success" | "error" | "warning" | "info" | "loading" | "message";

export type ToastOptions = ExternalToast & {
  /** Skip duplicate suppression for this toast. */
  force?: boolean;
};

/** Legacy shadcn-style toast payload used across existing pages. */
export type LegacyToastProps = {
  title?: ReactNode;
  description?: ReactNode;
  variant?: "default" | "destructive";
  action?: ReactNode;
  duration?: number;
  id?: string | number;
};

const DEFAULT_DURATION = 4000;
const ERROR_DURATION = 5000;
const LOADING_DURATION = Infinity;
const DUPLICATE_WINDOW_MS = 2500;

const recentToasts = new Map<string, number>();

function nodeToString(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  return "";
}

function dedupeKey(type: ToastType, message: string, description?: string) {
  return `${type}::${message.trim()}::${(description ?? "").trim()}`.toLowerCase();
}

function shouldSkipDuplicate(type: ToastType, message: string, description?: string, force?: boolean) {
  if (force || type === "loading") return false;
  const key = dedupeKey(type, message, description);
  const now = Date.now();
  const last = recentToasts.get(key);
  if (last && now - last < DUPLICATE_WINDOW_MS) return true;
  recentToasts.set(key, now);
  // Opportunistic cleanup
  if (recentToasts.size > 80) {
    for (const [k, ts] of recentToasts) {
      if (now - ts > DUPLICATE_WINDOW_MS) recentToasts.delete(k);
    }
  }
  return false;
}

function withDefaults(type: ToastType, options?: ToastOptions): ExternalToast {
  const duration =
    options?.duration ??
    (type === "loading" ? LOADING_DURATION : type === "error" ? ERROR_DURATION : DEFAULT_DURATION);

  const durationMs = duration === Infinity ? DEFAULT_DURATION : duration;

  return {
    ...options,
    duration,
    closeButton: options?.closeButton ?? true,
    style: {
      ...options?.style,
      // Used by the CSS countdown bar
      ["--toast-duration" as string]: `${durationMs}ms`,
    },
  };
}

function show(type: ToastType, message: string, options?: ToastOptions) {
  const description = typeof options?.description === "string" ? options.description : undefined;
  if (shouldSkipDuplicate(type, message, description, options?.force)) {
    return options?.id ?? "skipped";
  }

  const opts = withDefaults(type, options);

  switch (type) {
    case "success":
      return sonnerToast.success(message, opts);
    case "error":
      return sonnerToast.error(message, opts);
    case "warning":
      return sonnerToast.warning(message, opts);
    case "info":
      return sonnerToast.info(message, opts);
    case "loading":
      return sonnerToast.loading(message, opts);
    default:
      return sonnerToast(message, opts);
  }
}

/**
 * Map HTTP / ApiError status codes to user-facing messages.
 * Prefer server message for validation (400/409/422) when present.
 */
export function getApiErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (error instanceof ApiError) {
    const validation = error.errors?.filter(Boolean).join(", ");
    switch (error.status) {
      case 400:
        return validation || error.message || "Invalid request. Please check your input.";
      case 401:
        return "Your session has expired. Please log in again.";
      case 403:
        return "You don't have permission to perform this action.";
      case 404:
        return "The requested item was not found.";
      case 409:
        return validation || error.message || "This action conflicts with existing data.";
      case 422:
        return validation || error.message || "Validation failed. Please check your input.";
      case 429:
        return "Too many requests. Please try again later.";
      default:
        if (error.status >= 500) {
          return "Server error. Please try again later.";
        }
        return validation || error.message || fallback;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return fallback;
}

function inferLegacyType(props: LegacyToastProps): ToastType {
  if (props.variant === "destructive") return "error";

  const text = `${nodeToString(props.title)} ${nodeToString(props.description)}`.toLowerCase();
  if (
    /\b(fail|failed|error|unable|invalid|required|denied|forbidden|unauthorized|conflict)\b/.test(
      text,
    )
  ) {
    return "error";
  }
  if (/\b(warning|cannot be undone|careful|please complete|please select|please fill)\b/.test(text)) {
    return "warning";
  }
  if (
    /\b(created|saved|updated|deleted|success|added|scheduled|assigned|submitted|recorded|posted|converted|approved|complete|completed|signed|uploaded|seeded|removed)\b/.test(
      text,
    )
  ) {
    return "success";
  }
  return "info";
}

function legacyToast(props: LegacyToastProps) {
  const title = nodeToString(props.title).trim();
  const description = nodeToString(props.description).trim();
  const type = inferLegacyType(props);

  const message = title || description || "Notification";
  const options: ToastOptions = {
    id: props.id,
    duration: props.duration,
    description: title && description ? description : undefined,
  };

  // When only description was meaningful and title is a generic "Error"
  if (type === "error" && /^error$/i.test(title) && description) {
    return show("error", description, { ...options, description: undefined });
  }

  return show(type, message, options);
}

type ToastCallable = {
  (message: string, options?: ToastOptions): string | number;
  (props: LegacyToastProps): string | number;
  success: (message: string, options?: ToastOptions) => string | number;
  error: (message: string, options?: ToastOptions) => string | number;
  warning: (message: string, options?: ToastOptions) => string | number;
  info: (message: string, options?: ToastOptions) => string | number;
  loading: (message: string, options?: ToastOptions) => string | number;
  message: (message: string, options?: ToastOptions) => string | number;
  dismiss: (id?: string | number) => void;
  promise: typeof sonnerToast.promise;
  apiError: (
    error: unknown,
    options?: ToastOptions & { fallback?: string },
  ) => string | number;
};

function isLegacyProps(value: unknown): value is LegacyToastProps {
  return typeof value === "object" && value !== null && ("title" in value || "description" in value || "variant" in value);
}

function toastFn(messageOrProps: string | LegacyToastProps, options?: ToastOptions): string | number {
  if (typeof messageOrProps === "string") {
    return show("message", messageOrProps, options);
  }
  if (isLegacyProps(messageOrProps)) {
    return legacyToast(messageOrProps);
  }
  return show("message", String(messageOrProps), options);
}

export const toast: ToastCallable = Object.assign(toastFn, {
  success: (message: string, options?: ToastOptions) => show("success", message, options),
  error: (message: string, options?: ToastOptions) => show("error", message, options),
  warning: (message: string, options?: ToastOptions) => show("warning", message, options),
  info: (message: string, options?: ToastOptions) => show("info", message, options),
  loading: (message: string, options?: ToastOptions) => show("loading", message, options),
  message: (message: string, options?: ToastOptions) => show("message", message, options),
  dismiss: (id?: string | number) => sonnerToast.dismiss(id),
  promise: sonnerToast.promise.bind(sonnerToast),
  apiError: (error: unknown, options?: ToastOptions & { fallback?: string }) => {
    const { fallback, ...rest } = options ?? {};
    return show("error", getApiErrorMessage(error, fallback), rest);
  },
});

/** Hook-shaped helper for components that previously used `useToast()`. */
export function useToast() {
  return {
    toast,
    dismiss: toast.dismiss,
    toasts: [] as never[],
  };
}
