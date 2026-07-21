// Shared TypeScript types used across the backend

export interface JwtPayload {
  userId: string;
  tenantId: string;
  role: string;
  email: string;
  iat?: number;
  exp?: number;
}

/** Standard API response envelope */
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
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
