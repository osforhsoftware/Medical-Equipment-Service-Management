export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 25;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface BaseListParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface EquipmentListParams extends BaseListParams {
  customerId?: string;
  condition?: string;
  category?: string;
}

export interface CustomerListParams extends BaseListParams {
  status?: string;
  type?: string;
}

export interface JobListParams extends BaseListParams {
  status?: string;
  priority?: string;
  assignee?: string;
  customerId?: string;
}

export interface ServiceRequestListParams extends BaseListParams {
  status?: string;
  statuses?: string;
  priority?: string;
  assignee?: string;
  overdue?: boolean;
  customerId?: string;
}

export interface EstimateListParams extends BaseListParams {
  status?: string;
  customerId?: string;
}

export interface InventoryListParams extends BaseListParams {
  category?: string;
  stockStatus?: string;
  supplierId?: string;
}

export interface PurchaseOrderListParams extends BaseListParams {
  status?: string;
}

export interface AuditLogListParams extends BaseListParams {
  role?: string;
}

/** Build query string from list params — skips empty / "all" values. */
export function buildListQuery(params?: Record<string, string | number | boolean | undefined | null>): string {
  if (!params) return "";
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === "all") return;
    if (typeof value === "boolean") {
      if (value) search.set(key, "true");
      return;
    }
    search.set(key, String(value));
  });
  const q = search.toString();
  return q ? `?${q}` : "";
}

export const EMPTY_PAGINATION_META: PaginationMeta = {
  page: 1,
  limit: DEFAULT_LIMIT,
  total: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
};

/** Human-readable range label, e.g. "Showing 26–50 of 5,000" */
export function formatPaginationRange(meta: PaginationMeta): string {
  if (meta.total === 0) return "Showing 0 of 0";
  const start = (meta.page - 1) * meta.limit + 1;
  const end = Math.min(meta.page * meta.limit, meta.total);
  return `Showing ${start.toLocaleString()}–${end.toLocaleString()} of ${meta.total.toLocaleString()}`;
}

/** Extract data array from paginated result (for dropdown/lookup use with capped limit). */
export async function unwrapListData<T>(result: PaginatedResult<T>): Promise<T[]> {
  return result.data;
}
