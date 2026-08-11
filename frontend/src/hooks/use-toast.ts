/**
 * Centralized toast notifications.
 * Prefer: toast.success / toast.error / toast.warning / toast.info / toast.loading / toast.apiError
 * Legacy shadcn-style toast({ title, description, variant }) remains supported.
 */
export { toast, useToast, getApiErrorMessage } from "@/lib/toast";
export type { ToastOptions, ToastType, LegacyToastProps } from "@/lib/toast";
