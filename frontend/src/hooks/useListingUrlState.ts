import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { DEFAULT_LIMIT, DEFAULT_PAGE, type PageSize } from "@/lib/listing";

type FilterRecord = Record<string, string>;

interface UseListingUrlStateOptions {
  filterKeys?: string[];
  defaultLimit?: PageSize;
  omitFromUrl?: string[];
}

export function useListingUrlState(options: UseListingUrlStateOptions = {}) {
  const { filterKeys = [], defaultLimit = DEFAULT_LIMIT, omitFromUrl = [] } = options;
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Math.max(1, parseInt(searchParams.get("page") ?? String(DEFAULT_PAGE), 10) || DEFAULT_PAGE);
  const limit = (parseInt(searchParams.get("limit") ?? String(defaultLimit), 10) || defaultLimit) as PageSize;
  const search = searchParams.get("search") ?? "";
  const sortBy = searchParams.get("sortBy") ?? undefined;
  const sortOrder = (searchParams.get("sortOrder") as "asc" | "desc" | null) ?? undefined;

  const filters = useMemo(() => {
    const result: FilterRecord = {};
    for (const key of filterKeys) {
      const val = searchParams.get(key);
      if (val) result[key] = val;
    }
    return result;
  }, [filterKeys, searchParams]);

  const updateParams = useCallback(
    (updates: Record<string, string | number | null | undefined>, resetPage = false) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (resetPage) next.set("page", String(DEFAULT_PAGE));

        Object.entries(updates).forEach(([key, value]) => {
          if (omitFromUrl.includes(key)) return;
          if (value === undefined || value === null || value === "" || value === "all") {
            next.delete(key);
          } else {
            next.set(key, String(value));
          }
        });

        return next;
      }, { replace: true });
    },
    [omitFromUrl, setSearchParams],
  );

  const setPage = useCallback(
    (nextPage: number) => updateParams({ page: nextPage }),
    [updateParams],
  );

  const setLimit = useCallback(
    (nextLimit: PageSize) => updateParams({ limit: nextLimit, page: DEFAULT_PAGE }),
    [updateParams],
  );

  const setSearch = useCallback(
    (nextSearch: string) => updateParams({ search: nextSearch || null, page: DEFAULT_PAGE }),
    [updateParams],
  );

  const setFilter = useCallback(
    (key: string, value: string) => updateParams({ [key]: value || null, page: DEFAULT_PAGE }),
    [updateParams],
  );

  const setSort = useCallback(
    (field: string, order: "asc" | "desc") => updateParams({ sortBy: field, sortOrder: order, page: DEFAULT_PAGE }),
    [updateParams],
  );

  const listParams = useMemo(
    () => ({
      page,
      limit,
      ...(search ? { search } : {}),
      ...(sortBy ? { sortBy } : {}),
      ...(sortOrder ? { sortOrder } : {}),
      ...filters,
    }),
    [page, limit, search, sortBy, sortOrder, filters],
  );

  return {
    page,
    limit,
    search,
    sortBy,
    sortOrder,
    filters,
    listParams,
    setPage,
    setLimit,
    setSearch,
    setFilter,
    setSort,
    updateParams,
  };
}
