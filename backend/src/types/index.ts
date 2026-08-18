// Shared TypeScript types used across the backend

export interface JwtPayload {
  userId: string;
  tenantId: string;
  role: string;
  email: string;
  name?: string;
  iat?: number;
  exp?: number;
}

export type SortOrder = "asc" | "desc";

/** Pagination metadata returned with list endpoints */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/** Standard API response envelope */
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  meta?: PaginationMeta;
}

/** Pagination params */
export interface PaginationQuery {
  page?: number;
  limit?: number;
}

/** Filter params common to all list endpoints */
export interface ListFilters extends PaginationQuery {
  branchId?: string;
  status?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: SortOrder;
}

/** Paginated list result from repositories */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
}

// ── Extend Express Request ────────────────────────────────────
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Express Request augmentation requires a namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
      tenantId?: string;
    }
  }
}
