import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, Search, ArrowUpDown, TrendingUp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { downloadSpreadsheet } from "@/lib/exportSpreadsheet";
import { formatCurrency, formatCurrencyShort } from "@/lib/format";
import { toast } from "@/lib/toast";

export interface ReportCategoryItem {
  name: string;
  quantity: number;
  amount: number;
}

interface ReportCategoryDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  rows?: ReportCategoryItem[];
  dateRangeLabel?: string;
  categoryKey?: string;
}

export function ReportCategoryDetailDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  rows = [],
  dateRangeLabel,
  categoryKey = "category",
}: ReportCategoryDetailDialogProps) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"amount_desc" | "amount_asc" | "qty_desc" | "qty_asc" | "name_asc">("amount_desc");

  const totalAmount = useMemo(() => rows.reduce((sum, r) => sum + Number(r.amount || 0), 0), [rows]);
  const totalQuantity = useMemo(() => rows.reduce((sum, r) => sum + Number(r.quantity || 0), 0), [rows]);
  const averageValue = rows.length ? totalAmount / rows.length : 0;

  const filteredAndSortedRows = useMemo(() => {
    let result = rows;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((r) => r.name.toLowerCase().includes(q));
    }

    const sorted = [...result];
    switch (sortBy) {
      case "amount_desc":
        sorted.sort((a, b) => b.amount - a.amount);
        break;
      case "amount_asc":
        sorted.sort((a, b) => a.amount - b.amount);
        break;
      case "qty_desc":
        sorted.sort((a, b) => b.quantity - a.quantity);
        break;
      case "qty_asc":
        sorted.sort((a, b) => a.quantity - b.quantity);
        break;
      case "name_asc":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }
    return sorted;
  }, [rows, search, sortBy]);

  const handleExport = () => {
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    downloadSpreadsheet(
      `sales-report-${slug}`,
      [
        { header: "Rank", value: (_row, idx) => Number(idx !== undefined ? idx + 1 : 1) },
        { header: "Name / Description", value: (row) => row.name },
        { header: "Quantity Sold", value: (row) => row.quantity },
        { header: "Total Amount (₹)", value: (row) => row.amount },
        {
          header: "Share of Total (%)",
          value: (row) =>
            totalAmount > 0 ? Number(((row.amount / totalAmount) * 100).toFixed(2)) : 0,
        },
      ],
      filteredAndSortedRows,
    );
    toast.success("Export ready", {
      description: `${filteredAndSortedRows.length} item(s) exported for Excel.`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b bg-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
                <Badge variant="secondary" className="font-mono text-xs">
                  {rows.length} total
                </Badge>
              </div>
              <DialogDescription className="mt-1">
                {subtitle || (dateRangeLabel ? `Performance breakdown · ${dateRangeLabel}` : "Complete performance report")}
              </DialogDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={filteredAndSortedRows.length === 0}
              className="self-start sm:self-auto shrink-0 gap-1.5"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              Export to Excel
            </Button>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-border/60">
            <div className="rounded-lg border bg-background/80 p-2.5">
              <p className="text-xs text-muted-foreground">Total Revenue</p>
              <p className="text-base font-semibold text-foreground">{formatCurrency(totalAmount)}</p>
            </div>
            <div className="rounded-lg border bg-background/80 p-2.5">
              <p className="text-xs text-muted-foreground">Total Units / Qty</p>
              <p className="text-base font-semibold text-foreground">{totalQuantity.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border bg-background/80 p-2.5">
              <p className="text-xs text-muted-foreground">Unique Entries</p>
              <p className="text-base font-semibold text-foreground">{rows.length}</p>
            </div>
            <div className="rounded-lg border bg-background/80 p-2.5">
              <p className="text-xs text-muted-foreground">Avg Value / Entry</p>
              <p className="text-base font-semibold text-foreground">{formatCurrencyShort(averageValue)}</p>
            </div>
          </div>
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 px-6 py-3 border-b bg-card">
          <div className="relative w-full sm:flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`Search ${title.toLowerCase()}…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <ArrowUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="h-9 w-full sm:w-[190px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="amount_desc">Highest revenue</SelectItem>
                <SelectItem value="amount_asc">Lowest revenue</SelectItem>
                <SelectItem value="qty_desc">Highest quantity</SelectItem>
                <SelectItem value="qty_asc">Lowest quantity</SelectItem>
                <SelectItem value="name_asc">Name (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table List */}
        <div className="flex-1 overflow-y-auto p-6 pt-2">
          {filteredAndSortedRows.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <p className="text-sm">No items match your filter criteria.</p>
              {search && (
                <Button variant="link" size="sm" onClick={() => setSearch("")} className="mt-1">
                  Clear search
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead>Item / Name</TableHead>
                  <TableHead className="text-right w-24">Qty</TableHead>
                  <TableHead className="text-right w-36">Revenue</TableHead>
                  <TableHead className="w-28 text-right">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedRows.map((row, idx) => {
                  const sharePercent = totalAmount > 0 ? (row.amount / totalAmount) * 100 : 0;
                  return (
                    <TableRow key={row.name}>
                      <TableCell className="font-mono text-xs text-center text-muted-foreground">
                        {idx + 1}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-foreground">{row.name}</span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums">
                        {row.quantity}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium text-sm tabular-nums">
                        {formatCurrency(row.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs font-mono text-muted-foreground tabular-nums">
                            {sharePercent.toFixed(1)}%
                          </span>
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded-full"
                              style={{ width: `${Math.min(100, Math.max(2, sharePercent))}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
