import { keepPreviousData, useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { PaginatedResult } from "@/lib/listing";

interface UsePaginatedQueryOptions<T, P extends Record<string, unknown>> {
  queryKey: string;
  params: P;
  queryFn: (params: P) => Promise<PaginatedResult<T>>;
  enabled?: boolean;
  staleTime?: number;
}

export function usePaginatedQuery<T, P extends Record<string, unknown>>({
  queryKey,
  params,
  queryFn,
  enabled = true,
  staleTime = 30_000,
}: UsePaginatedQueryOptions<T, P>): UseQueryResult<PaginatedResult<T>> {
  return useQuery({
    queryKey: [queryKey, params],
    queryFn: () => queryFn(params),
    enabled,
    staleTime,
    placeholderData: keepPreviousData,
    retry: (failureCount, error) => {
      if (error instanceof Error && "status" in error) {
        const status = (error as { status: number }).status;
        if (status === 401 || status === 403 || status === 404) return false;
      }
      return failureCount < 2;
    },
  });
}
