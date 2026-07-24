import { useMemo, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
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

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface FilterDef<T> {
  label: string;
  options: { label: string; value: string }[];
  predicate: (row: T, value: string) => boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchKeys?: (keyof T)[];
  searchPlaceholder?: string;
  filters?: FilterDef<T>[];
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  toolbarExtra?: ReactNode;
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  searchKeys = [],
  searchPlaceholder = "Search…",
  filters = [],
  onRowClick,
  emptyMessage = "No records found.",
  toolbarExtra,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [filterValues, setFilterValues] = useState<Record<number, string>>({});

  const filtered = useMemo(() => {
    return data.filter((row) => {
      const matchesSearch =
        !query ||
        searchKeys.some((k) =>
          String(row[k] ?? "").toLowerCase().includes(query.toLowerCase()),
        );
      const matchesFilters = filters.every((f, idx) => {
        const val = filterValues[idx];
        return !val || val === "all" || f.predicate(row, val);
      });
      return matchesSearch && matchesFilters;
    });
  }, [data, query, searchKeys, filters, filterValues]);

  return (
    <Card className="overflow-hidden shadow-card">
      <div className="flex flex-col gap-3 border-b border-border/70 bg-gradient-to-r from-secondary/45 via-card to-card p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          {searchKeys.length > 0 && (
            <div className="relative max-w-sm flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="border-border/80 bg-card/90 pl-9 shadow-sm"
              />
            </div>
          )}
          {filters.map((f, idx) => (
            <Select
              key={f.label}
              value={filterValues[idx] ?? "all"}
              onValueChange={(v) => setFilterValues((prev) => ({ ...prev, [idx]: v }))}
            >
              <SelectTrigger className="w-full sm:w-44">
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

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-primary/[0.045] hover:bg-primary/[0.045]">
              {columns.map((c) => (
                <TableHead key={c.key} className={c.className}>
                  {c.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={() => onRowClick?.(row)}
                  className={onRowClick ? "cursor-pointer hover:bg-secondary/35" : "hover:bg-secondary/20"}
                >
                  {columns.map((c) => (
                    <TableCell key={c.key} className={c.className}>
                      {c.render(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="border-t border-border/70 bg-muted/25 px-4 py-2.5 text-xs font-medium text-muted-foreground">
        Showing {filtered.length} of {data.length} records
      </div>
    </Card>
  );
}
