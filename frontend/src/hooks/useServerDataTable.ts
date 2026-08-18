import { useMemo } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useListingUrlState } from "@/hooks/useListingUrlState";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { EMPTY_PAGINATION_META, type PaginatedResult, type PageSize } from "@/lib/listing";

interface UseServerDataTableOptions<T, P extends Record<string, unknown>> {
  queryKey: string;
  queryFn: (params: P) => Promise<PaginatedResult<T>>;
  filterKeys?: string[];
  enabled?: boolean;
}

export function useServerDataTable<T, P extends Record<string, unknown>>({
  queryKey,
  queryFn,
  filterKeys = [],
  enabled = true,
}: UseServerDataTableOptions<T, P>) {
  const listing = useListingUrlState({ filterKeys });
  const debouncedSearch = useDebouncedValue(listing.search);

  const params = useMemo(
    () => ({
      ...listing.listParams,
      search: debouncedSearch || undefined,
    }) as P,
    [listing.listParams, debouncedSearch],
  );

  const query = usePaginatedQuery({
    queryKey,
    params,
    queryFn,
    enabled,
  });

  return {
    ...listing,
    params,
    query,
    data: query.data?.data ?? [],
    meta: query.data?.meta ?? EMPTY_PAGINATION_META,
    loading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
    refetch: query.refetch,
    setPage: listing.setPage,
    setLimit: listing.setLimit as (limit: PageSize) => void,
  };
}
