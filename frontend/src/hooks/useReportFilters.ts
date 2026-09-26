import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { defaultDateRange } from "@/lib/charts";
import type { DateRangeValue } from "@/components/shared/DateRangeFilter";

export function useReportFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const fallback = useMemo(() => defaultDateRange(29), []);

  const dateRange: DateRangeValue = {
    from: searchParams.get("from") || fallback.from,
    to: searchParams.get("to") || fallback.to,
  };
  const search = searchParams.get("q") ?? "";
  const status = searchParams.get("status") || "all";

  const patch = useCallback(
    (updates: Record<string, string | undefined>) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(updates).forEach(([key, value]) => {
        if (!value || value === "all") next.delete(key);
        else next.set(key, value);
      });
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const setDateRange = useCallback(
    (next: DateRangeValue) => patch({ from: next.from, to: next.to }),
    [patch],
  );
  const setSearch = useCallback((value: string) => patch({ q: value.trim() || undefined }), [patch]);
  const setStatus = useCallback((value: string) => patch({ status: value }), [patch]);

  return { dateRange, search, status, setDateRange, setSearch, setStatus };
}
