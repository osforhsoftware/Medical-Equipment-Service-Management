import { type ApiResponse, type PaginationMeta } from "@/types";
import { buildPaginationMeta } from "@/utils/pagination";

/** Send a standardized success response */
export const success = <T>(
  message: string,
  data?: T,
  meta?: PaginationMeta,
): ApiResponse<T> => ({
  success: true,
  message,
  data,
  ...(meta ? { meta } : {}),
});

/** Send a standardized error response */
export const failure = (message: string): ApiResponse<null> => ({
  success: false,
  message,
  data: null,
});

/** Calculate pagination meta (legacy alias) */
export const paginate = buildPaginationMeta;
