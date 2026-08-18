import type { Request } from "express";
import type { PaginationMeta, SortOrder } from "@/types";

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 100;
export const ALLOWED_PAGE_SIZES = [10, 25, 50, 100] as const;

export interface ParsedPagination {
  page: number;
  limit: number;
  skip: number;
}

export interface ParsedSort {
  field: string;
  order: SortOrder;
}

/** Parse and validate page/limit from query string. */
export function parsePaginationQuery(query: Request["query"]): ParsedPagination {
  const page = Math.max(1, parseInt(String(query.page ?? DEFAULT_PAGE), 10) || DEFAULT_PAGE);
  let limit = parseInt(String(query.limit ?? DEFAULT_LIMIT), 10) || DEFAULT_LIMIT;

  if (!ALLOWED_PAGE_SIZES.includes(limit as (typeof ALLOWED_PAGE_SIZES)[number])) {
    limit = DEFAULT_LIMIT;
  }

  limit = Math.min(MAX_LIMIT, Math.max(1, limit));

  return { page, limit, skip: (page - 1) * limit };
}

/** Build consistent pagination metadata. */
export function buildPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: totalPages > 0 && page < totalPages,
    hasPreviousPage: page > 1,
  };
}

/** Parse optional search term (trimmed, empty → undefined). */
export function parseSearchQuery(query: Request["query"]): string | undefined {
  const search = String(query.search ?? "").trim();
  return search.length > 0 ? search : undefined;
}

/** Parse sort params against a whitelist map (query key → prisma field). */
export function parseSortQuery(
  query: Request["query"],
  allowedFields: Record<string, string>,
  defaultField: string,
  defaultOrder: SortOrder = "asc",
): ParsedSort {
  const requested = String(query.sortBy ?? defaultField);
  const field = allowedFields[requested] ?? allowedFields[defaultField] ?? defaultField;
  const order: SortOrder = query.sortOrder === "desc" ? "desc" : query.sortOrder === "asc" ? "asc" : defaultOrder;
  return { field, order };
}

/** Build Prisma orderBy from parsed sort. */
export function toOrderBy(sort: ParsedSort): Record<string, SortOrder> {
  return { [sort.field]: sort.order };
}

/** Optional string query param (empty / "all" → undefined). */
export function parseOptionalFilter(value: unknown): string | undefined {
  const str = String(value ?? "").trim();
  if (!str || str === "all") return undefined;
  return str;
}
