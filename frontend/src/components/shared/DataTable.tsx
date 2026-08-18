import { useMemo, useState, type ReactNode } from "react";
import { AlertCircle, RefreshCw, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ListingPagination } from "@/components/shared/ListingPagination";
import { EmptyState } from "@/components/shared/EmptyState";
import type { PaginationMeta, PageSize } from "@/lib/listing";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface FilterDef {
  label: string;
  key?: string;
  options: { label: string; value: string }[];
  predicate?: (row: unknown, value: string) => boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  /** @default client */
  mode?: "client" | "server";
  searchKeys?: (keyof T)[];
  searchPlaceholder?: string;
  search?: string;
  onSearchChange?: (value: string) => void;
  filters?: FilterDef[];
  filterValues?: Record<string, string>;
  onFilterChange?: (key: string, value: string) => void;
  pagination?: PaginationMeta;
  onPageChange?: (page: number) => void;
  onLimitChange?: (limit: PageSize) => void;
  loading?: boolean;
  isFetching?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  emptyHint?: string;
  toolbarExtra?: ReactNode;
  /** Compact rows and smaller typography for dense listings. */
  compact?: boolean;
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  mode = "client",
  searchKeys = [],
  searchPlaceholder = "Search…",
  search: controlledSearch,
  onSearchChange,
  filters = [],
  filterValues: controlledFilterValues,
  onFilterChange,
  pagination,
  onPageChange,
  onLimitChange,
  loading = false,
  isFetching = false,
  error = null,
  onRetry,
  onRowClick,
  emptyMessage = "No records found.",
  emptyHint = "Try changing your search or filters.",
  toolbarExtra,
  compact = false,
}: DataTableProps<T>) {
  const [internalQuery, setInternalQuery] = useState("");
  const [internalFilterValues, setInternalFilterValues] = useState<Record<number, string>>({});

  const isServer = mode === "server";
  const query = isServer ? (controlledSearch ?? "") : internalQuery;
  const setQuery = isServer ? (onSearchChange ?? (() => undefined)) : setInternalQuery;

  const filtered = useMemo(() => {
    if (isServer) return data;
    return data.filter((row) => {
      const matchesSearch =
        !query ||
        searchKeys.some((k) =>
          String(row[k] ?? "").toLowerCase().includes(query.toLowerCase()),
        );
      const matchesFilters = filters.every((f, idx) => {
        const val = internalFilterValues[idx];
        return !val || val === "all" || !f.predicate || f.predicate(row, val);
      });
      return matchesSearch && matchesFilters;
    });
  }, [data, query, searchKeys, filters, internalFilterValues, isServer]);

  const getFilterValue = (f: FilterDef, idx: number) => {
    const key = f.key ?? String(idx);
    if (isServer) return controlledFilterValues?.[key] ?? "all";
    return internalFilterValues[idx] ?? "all";
  };

  const handleFilterChange = (f: FilterDef, idx: number, value: string) => {
    const key = f.key ?? String(idx);
    if (isServer) {
      onFilterChange?.(key, value);
    } else {
      setInternalFilterValues((prev) => ({ ...prev, [idx]: value }));
    }
  };

  const showSkeleton = loading && data.length === 0;

  return (
    <Card className={cn("overflow-hidden", compact && "text-xs")}>
      <div className={cn(
        "flex flex-col gap-2 border-b border-border bg-card lg:flex-row lg:items-center lg:justify-between",
        compact ? "p-2.5" : "gap-3 p-4",
      )}
      >
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
          {(searchKeys.length > 0 || isServer) && (
            <div className="relative max-w-sm flex-1">
              <Search className={cn(
                "pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground",
                compact ? "h-3.5 w-3.5" : "h-4 w-4",
              )}
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className={cn(
                  "border-border bg-background shadow-none",
                  compact ? "h-8 pl-8 text-xs" : "h-9 pl-9",
                )}
              />
            </div>
          )}
          {filters.map((f, idx) => (
            <Select
              key={f.key ?? f.label}
              value={getFilterValue(f, idx)}
              onValueChange={(v) => handleFilterChange(f, idx, v)}
            >
              <SelectTrigger className={cn("w-full sm:w-40", compact && "h-8 text-xs")}>
                <SelectValue placeholder={f.label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All {f.label}</SelectItem>
                {f.options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
        </div>
        {toolbarExtra}
      </div>

      {error ? (
        <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
          <AlertCircle className="h-7 w-7 text-destructive" />
          <div>
            <p className="text-sm font-medium text-foreground">Something went wrong</p>
            <p className="mt-1 text-[13px] text-muted-foreground">{error.message || "Failed to load data"}</p>
          </div>
          {onRetry ? (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="mr-1 h-4 w-4" /> Retry
            </Button>
          ) : null}
        </div>
      ) : (
        <div className={cn("overflow-x-auto", isFetching && "opacity-70 transition-opacity")}>
          <Table className={compact ? "text-xs" : undefined}>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                {columns.map((c) => (
                  <TableHead
                    key={c.key}
                    className={cn(compact && "h-8 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide", c.className)}
                  >
                    {c.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {showSkeleton ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`skel-${i}`}>
                    {columns.map((c) => (
                      <TableCell key={c.key}>
                        <Skeleton className="h-4 w-full max-w-[180px]" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-auto p-0">
                    <EmptyState title={emptyMessage} description={isServer ? emptyHint : undefined} />
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => (
                  <TableRow
                    key={row.id}
                    onClick={() => onRowClick?.(row)}
                    className={onRowClick ? "cursor-pointer hover:bg-muted/60" : "hover:bg-muted/40"}
                  >
                    {columns.map((c) => (
                      <TableCell
                        key={c.key}
                        className={cn(compact && "px-2 py-1.5 align-top", c.className)}
                      >
                        {c.render(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {isServer && pagination && onPageChange ? (
        <ListingPagination
          meta={pagination}
          onPageChange={onPageChange}
          onLimitChange={onLimitChange}
          isFetching={isFetching}
        />
      ) : !isServer ? (
        <div className="border-t border-border bg-muted/30 px-4 py-2.5 text-xs font-medium text-muted-foreground">
          Showing {filtered.length} of {data.length} records
        </div>
      ) : null}
    </Card>
  );
}
