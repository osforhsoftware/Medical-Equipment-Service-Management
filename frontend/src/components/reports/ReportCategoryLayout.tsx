import { useEffect, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, FileSpreadsheet, Loader2, Printer } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DateRangeFilter, type DateRangeValue } from "@/components/shared/DateRangeFilter";
import { StatCard } from "@/components/shared/StatCard";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { REPORT_PAGE_ROLES, type ReportCategory } from "@/lib/reportCategories";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function ReportCategoryLayout({
  category,
  dateRange,
  onDateRangeChange,
  search,
  onSearchChange,
  searchPlaceholder = "Search reports…",
  extraFilters,
  kpis,
  loading,
  error,
  onExportAll,
  onExportActivity,
  children,
}: {
  category: ReportCategory;
  dateRange: DateRangeValue;
  onDateRangeChange: (next: DateRangeValue) => void;
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  extraFilters?: ReactNode;
  kpis: { label: string; value: string; icon: LucideIcon; accent?: "primary" | "accent" | "success" | "warning" | "destructive" }[];
  loading?: boolean;
  error?: string | null;
  onExportAll: () => void;
  onExportActivity: () => void;
  children: ReactNode;
}) {
  const location = useLocation();

  useEffect(() => {
    const id = location.hash.replace("#", "");
    if (!id || loading) return;
    const timer = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [location.hash, loading]);

  const periodLabel = `${formatDate(dateRange.from)} – ${formatDate(dateRange.to)}`;

  return (
    <RoleGuard roles={REPORT_PAGE_ROLES}>
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm">
          <Link to="/app/reports" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" />
            Reports
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className={cn("font-medium", category.accentClass)}>{category.title}</span>
        </div>

        <PageHeader
          title={category.title}
          description={`${category.description} Filters apply to every report and export on this page.`}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}>
                <Printer className="h-4 w-4" />
                Print
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={onExportActivity}>
                <FileSpreadsheet className="h-4 w-4" />
                Export activity
              </Button>
              <Button variant="brand" size="sm" className="gap-1.5" onClick={onExportAll}>
                <FileSpreadsheet className="h-4 w-4" />
                Export all
              </Button>
            </div>
          }
        />

        <DateRangeFilter value={dateRange} onChange={onDateRangeChange} />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 sm:max-w-sm"
          />
          {extraFilters}
        </div>

        <p className="text-xs text-muted-foreground">
          Filtered period · {periodLabel}
          {search ? ` · search “${search}”` : ""}
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading {category.shortTitle.toLowerCase()} reports…
          </div>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((kpi) => (
            <StatCard key={kpi.label} label={kpi.label} value={kpi.value} icon={kpi.icon} accent={kpi.accent} />
          ))}
        </div>

        {children}
      </div>
    </RoleGuard>
  );
}
