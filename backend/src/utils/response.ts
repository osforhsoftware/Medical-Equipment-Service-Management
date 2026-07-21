import { type ApiResponse } from "@/types";

/** Send a standardized success response */
export const success = <T>(
  message: string,
  data?: T,
  meta?: ApiResponse["meta"]
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

/** Calculate pagination meta */
export const paginate = (
  total: number,
  page: number,
  limit: number
): ApiResponse["meta"] => ({
  total,
  page,
  limit,
});
