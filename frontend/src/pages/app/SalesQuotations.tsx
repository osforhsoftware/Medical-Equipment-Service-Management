import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Eye, FileText, LayoutGrid, List, Loader2, Search, Table2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api, ApiError, type BackendEstimate } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type QuoteViewMode = "list" | "grid" | "table";

function parseViewMode(raw: string | null): QuoteViewMode {
  if (raw === "grid" || raw === "table" || raw === "list") return raw;
  return "list";
}

export default function SalesQuotations() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const viewMode = parseViewMode(searchParams.get("view"));

  const setViewMode = (next: QuoteViewMode) => {
    const params = new URLSearchParams(searchParams);
    if (next === "list") params.delete("view");
    else params.set("view", next);
    setSearchParams(params, { replace: true });
  };

  const quotesQuery = useQuery({
    queryKey: ["estimates", "sales-quotations"],
    queryFn: () => api.listEstimates({ kind: "sales", limit: 200, page: 1, sortBy: "createdAt", sortOrder: "desc" }),
  });

  const quotes = quotesQuery.data?.data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return quotes;
    return quotes.filter((row) =>
      [row.reference, row.customerName, row.equipmentName, row.status].some((value) =>
        String(value ?? "").toLowerCase().includes(q),
      ),
    );
  }, [quotes, search]);

  const openQuote = (quote: BackendEstimate) => navigate(`/app/estimates/${quote.id}`);

  const tableColumns: Column<BackendEstimate>[] = [
    {
      key: "reference",
      header: "Quote Ref",
      render: (quote) => (
        <button
          type="button"
          className="font-mono text-sm font-semibold text-primary hover:underline text-left"
          onClick={() => openQuote(quote)}
        >
          {quote.reference}
        </button>
      ),
    },
    {
      key: "customerName",
      header: "Customer",
      render: (quote) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{quote.customerName}</p>
          <p className="truncate text-xs text-muted-foreground">{quote.equipmentName || "Sales quotation"}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (quote) => <StatusBadge status={quote.status} />,
    },
    {
      key: "validUntil",
      header: "Valid until",
      render: (quote) => <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(quote.validUntil)}</span>,
    },
    {
      key: "total",
      header: "Amount",
      className: "text-right",
      render: (quote) => <span className="font-mono text-sm font-medium">{formatCurrency(Number(quote.total))}</span>,
    },
    {
      key: "actions",
      header: "",
      className: "w-20 text-right",
      render: (quote) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 px-2 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            openQuote(quote);
          }}
        >
          <Eye className="h-3.5 w-3.5" /> View
        </Button>
      ),
    },
  ];

  return (
    <RoleGuard roles={["admin", "sales", "coordinator", "billing"]}>
      <div className="space-y-5">
        <PageHeader
          title="Quotation"
          description="Sales quotations from enquiries. Open a quote to review or convert it to a sales order."
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search quotation, customer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(value) => {
              if (value === "list" || value === "grid" || value === "table") setViewMode(value);
            }}
            variant="outline"
            size="sm"
            className="justify-start shrink-0"
            aria-label="Quotations view"
          >
            <ToggleGroupItem value="list" aria-label="List view" className="gap-1.5 px-3">
              <List className="h-3.5 w-3.5" />
              List
            </ToggleGroupItem>
            <ToggleGroupItem value="grid" aria-label="Grid view" className="gap-1.5 px-3">
              <LayoutGrid className="h-3.5 w-3.5" />
              Grid
            </ToggleGroupItem>
            <ToggleGroupItem value="table" aria-label="Table view" className="gap-1.5 px-3">
              <Table2 className="h-3.5 w-3.5" />
              Table
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {quotesQuery.isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading quotations…
          </div>
        ) : quotesQuery.isError ? (
          <Card>
            <CardContent className="space-y-3 py-12 text-center">
              <p className="text-sm font-medium text-destructive">
                {quotesQuery.error instanceof ApiError ? quotesQuery.error.message : "Unable to load quotations"}
              </p>
              <Button variant="outline" size="sm" onClick={() => void quotesQuery.refetch()}>
                Try again
              </Button>
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="font-medium text-muted-foreground">No sales quotations yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Create one from Enquiry.</p>
              <Button className="mt-4" onClick={() => navigate("/app/sales-enquiries")}>
                Open Enquiry
              </Button>
            </CardContent>
          </Card>
        ) : viewMode === "table" ? (
          <Card>
            <CardContent className="p-0">
              <DataTable
                data={filtered}
                columns={tableColumns}
                emptyMessage="No quotations match your search."
                onRowClick={openQuote}
              />
            </CardContent>
          </Card>
        ) : viewMode === "grid" ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((quote) => (
              <Card
                key={quote.id}
                className={cn(
                  "cursor-pointer transition-all hover:border-primary/40 hover:shadow-sm",
                )}
                onClick={() => openQuote(quote)}
              >
                <CardContent className="flex h-full flex-col gap-3 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-sm font-semibold text-primary">{quote.reference}</span>
                    <StatusBadge status={quote.status} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{quote.customerName}</p>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {quote.equipmentName || "Sales quotation"}
                    </p>
                  </div>
                  <div className="flex items-end justify-between gap-2 border-t pt-3">
                    <p className="text-xs text-muted-foreground">Valid until {formatDate(quote.validUntil)}</p>
                    <p className="font-mono text-sm font-semibold">{formatCurrency(Number(quote.total))}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((quote) => (
              <Card
                key={quote.id}
                className="cursor-pointer transition-all hover:border-primary/40 hover:shadow-sm"
                onClick={() => openQuote(quote)}
              >
                <CardContent className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold">{quote.reference}</span>
                      <StatusBadge status={quote.status} />
                    </div>
                    <p className="mt-1 font-medium">{quote.customerName}</p>
                    <p className="text-sm text-muted-foreground">{quote.equipmentName || "Sales quotation"}</p>
                  </div>
                  <div className="text-sm text-muted-foreground sm:text-right">
                    <p className="font-medium text-foreground">{formatCurrency(Number(quote.total))}</p>
                    <p>Valid until {formatDate(quote.validUntil)}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
