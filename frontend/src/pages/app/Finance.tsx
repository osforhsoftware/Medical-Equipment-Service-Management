import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  CreditCard,
  IndianRupee,
  Percent,
  Receipt,
  Search,
  TrendingUp,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StatCard } from "@/components/shared/StatCard";
import { ModuleFlowStrip, ModuleQuickAction } from "@/components/shared/ModuleFlowStrip";
import { ReportTable } from "@/components/reports/ReportTable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SERVICE_BILLING_ROLES } from "@/config/roles";
import { api, ApiError, type BackendInvoice } from "@/lib/api";
import { formatCurrency, formatCurrencyShort, formatDate } from "@/lib/format";
import { agingBucket, asNumber } from "@/lib/reportUtils";
import ExpensesCommissions from "./ExpensesCommissions";

const DETAIL_STAGES = ["receivables", "payments", "vat", "profit", "credit"] as const;
const STAGES = ["overview", ...DETAIL_STAGES] as const;
type FinanceStage = (typeof STAGES)[number];
type FinanceDetailStage = (typeof DETAIL_STAGES)[number];

const SECTIONS: {
  id: FinanceDetailStage;
  label: string;
  hint: string;
  icon: typeof Receipt;
}[] = [
  { id: "receivables", label: "Receivables", hint: "Open balances", icon: Users },
  { id: "payments", label: "Payments", hint: "In and out", icon: CreditCard },
  { id: "vat", label: "VAT", hint: "Invoice tax", icon: Percent },
  { id: "profit", label: "Profit", hint: "Billed − costs", icon: TrendingUp },
  { id: "credit", label: "Credit", hint: "Limits", icon: IndianRupee },
];

function dueBalance(invoice: BackendInvoice) {
  return asNumber(invoice.balanceDue ?? asNumber(invoice.total) - asNumber(invoice.paidTotal));
}

function matches(query: string, ...values: Array<string | number | null | undefined>) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return values.some((value) => String(value ?? "").toLowerCase().includes(q));
}

export default function Finance() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const rawStage = searchParams.get("stage");
  const stage: FinanceStage = STAGES.includes(rawStage as FinanceStage)
    ? (rawStage as FinanceStage)
    : "overview";

  useEffect(() => {
    if (rawStage && !STAGES.includes(rawStage as FinanceStage)) {
      setSearchParams({}, { replace: true });
    }
  }, [rawStage, setSearchParams]);

  const invoicesQuery = useQuery({
    queryKey: ["finance", "invoices"],
    queryFn: () => api.listInvoices(),
  });
  const customersQuery = useQuery({
    queryKey: ["finance", "customers"],
    queryFn: () => api.listCustomers({ page: 1, limit: 200, status: "active" }),
    enabled: stage === "credit" || stage === "overview",
  });
  const costsQuery = useQuery({
    queryKey: ["finance", "costs"],
    queryFn: async () => {
      const [expenses, commissions] = await Promise.all([api.listExpenses(), api.listCommissions()]);
      return { expenses, commissions };
    },
    enabled: stage === "profit" || stage === "payments" || stage === "overview",
  });

  const invoices = invoicesQuery.data ?? [];
  const customers = customersQuery.data?.data ?? [];
  const expenses = costsQuery.data?.expenses ?? [];
  const commissions = costsQuery.data?.commissions ?? [];
  const loading = invoicesQuery.isLoading || ((stage === "credit" || stage === "overview") && customersQuery.isLoading);
  const error = invoicesQuery.error || customersQuery.error;

  const setStage = (next: FinanceStage) => {
    setSearch("");
    if (next === "overview") {
      setSearchParams({}, { replace: true });
      return;
    }
    setSearchParams({ stage: next }, { replace: true });
  };

  const openInvoices = useMemo(
    () =>
      invoices.filter(
        (invoice) =>
          dueBalance(invoice) > 0 &&
          matches(search, invoice.reference, invoice.customerName, invoice.status, agingBucket(invoice.dueAt)),
      ),
    [invoices, search],
  );

  const paymentRows = useMemo(() => {
    return invoices
      .flatMap((invoice) =>
        (invoice.payments ?? []).map((payment) => ({
          id: payment.id,
          invoiceId: invoice.id,
          reference: invoice.reference,
          customerName: invoice.customerName,
          amount: asNumber(payment.amount),
          method: payment.method,
          paidAt: payment.paidAt,
        })),
      )
      .filter((row) => matches(search, row.reference, row.customerName, row.method))
      .sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  }, [invoices, search]);

  const vatRows = useMemo(
    () =>
      invoices
        .map((invoice) => ({
          id: invoice.id,
          reference: invoice.reference,
          customerName: invoice.customerName,
          channel: invoice.salesOrderId ? "Sale" : "Service",
          taxable: asNumber(invoice.amount),
          tax: asNumber(invoice.tax),
          total: asNumber(invoice.total),
          status: invoice.status,
        }))
        .filter((row) => matches(search, row.reference, row.customerName, row.channel, row.status)),
    [invoices, search],
  );

  const expenseTotal = expenses.reduce((sum, row) => sum + asNumber(row.amount), 0);
  const commissionTotal = commissions.reduce((sum, row) => sum + asNumber(row.amount), 0);
  const billedTotal = invoices.reduce((sum, invoice) => sum + asNumber(invoice.total), 0);
  const collectedTotal = invoices.reduce((sum, invoice) => sum + asNumber(invoice.paidTotal), 0);
  const netProfit = billedTotal - expenseTotal - commissionTotal;

  const profitRows = useMemo(
    () =>
      invoices
        .map((invoice) => {
          const total = asNumber(invoice.total);
          const paid = asNumber(invoice.paidTotal);
          return {
            id: invoice.id,
            reference: invoice.reference,
            customerName: invoice.customerName,
            channel: invoice.salesOrderId ? "Sale" : "Service",
            total,
            paid,
            outstanding: dueBalance(invoice),
            realized: total > 0 ? (paid / total) * 100 : 0,
            status: invoice.status,
          };
        })
        .filter((row) => matches(search, row.reference, row.customerName, row.channel, row.status)),
    [invoices, search],
  );

  const creditRows = useMemo(
    () =>
      customers
        .map((customer) => {
          const limit = customer.creditLimit != null ? Number(customer.creditLimit) : null;
          const outstanding = asNumber(customer.outstandingBalance);
          const over = limit != null && limit > 0 && outstanding > limit;
          return {
            id: customer.id,
            name: customer.name,
            paymentTerms: customer.paymentTerms ?? "—",
            creditLimit: limit,
            outstanding,
            available: limit != null ? Math.max(0, limit - outstanding) : null,
            over,
          };
        })
        .filter((row) => row.creditLimit != null || row.outstanding > 0)
        .filter((row) => matches(search, row.name, row.paymentTerms))
        .sort((a, b) => Number(b.over) - Number(a.over) || b.outstanding - a.outstanding),
    [customers, search],
  );

  const receivableTotal = openInvoices.reduce((sum, invoice) => sum + dueBalance(invoice), 0);
  const vatTotal = vatRows.reduce((sum, row) => sum + row.tax, 0);
  const overLimitCount = creditRows.filter((row) => row.over).length;
  const overdueCount = openInvoices.filter((invoice) => {
    const bucket = agingBucket(invoice.dueAt);
    return bucket !== "Current" && bucket !== "No due date";
  }).length;

  const section = SECTIONS.find((item) => item.id === stage);

  return (
    <RoleGuard roles={SERVICE_BILLING_ROLES}>
      <div className="space-y-6">
        <PageHeader
          title={stage === "overview" ? "Finance Overview" : section?.label ?? "Finance"}
          description={
            stage === "overview"
              ? "Cash position at a glance — receivables, payments, VAT, profit, and credit."
              : section?.hint ?? "Receivables, payments, VAT, profit, and credit — one desk."
          }
          actions={
            <Button variant="outline" asChild>
              <Link to="/app/billing">Open Billing</Link>
            </Button>
          }
        />

        <ModuleFlowStrip
          overviewTo="/app/finance"
          overviewActive={stage === "overview"}
          activeId={stage}
          flowLabel="Books"
          steps={SECTIONS.map((item) => ({
            id: item.id,
            label: item.label,
            to: `/app/finance?stage=${item.id}`,
            icon: item.icon,
          }))}
        />

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading finance…</p>
        ) : error ? (
          <p className="text-sm text-destructive">
            {error instanceof ApiError ? error.message : "Unable to load finance"}
          </p>
        ) : null}

        {stage === "overview" ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Open invoices" value={String(openInvoices.length)} icon={Receipt} />
              <StatCard label="Receivables" value={formatCurrencyShort(receivableTotal)} icon={IndianRupee} accent="warning" />
              <StatCard label="Overdue" value={String(overdueCount)} icon={Users} accent="warning" />
              <StatCard label="Collected" value={formatCurrencyShort(collectedTotal)} icon={IndianRupee} accent="success" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="VAT output" value={formatCurrencyShort(vatTotal)} icon={Percent} />
              <StatCard label="Net profit" value={formatCurrencyShort(netProfit)} icon={TrendingUp} accent={netProfit >= 0 ? "success" : "warning"} />
              <StatCard label="Over credit limit" value={String(overLimitCount)} icon={CreditCard} accent={overLimitCount ? "warning" : "accent"} />
              <StatCard label="Payments logged" value={String(paymentRows.length)} icon={CreditCard} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ModuleQuickAction title="Receivables" hint={`${openInvoices.length} open balance(s)`} icon={Users} onClick={() => setStage("receivables")} />
              <ModuleQuickAction title="Payments" hint="Collections & expenses" icon={CreditCard} onClick={() => setStage("payments")} />
              <ModuleQuickAction title="Profit" hint="Billed minus costs" icon={TrendingUp} onClick={() => setStage("profit")} />
              <ModuleQuickAction title="Credit" hint={`${overLimitCount} over limit`} icon={IndianRupee} onClick={() => setStage("credit")} />
            </div>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <div>
                  <CardTitle className="text-base">Top open receivables</CardTitle>
                  <CardDescription className="text-xs">Highest balances due</CardDescription>
                </div>
                <Button variant="ghost" size="sm" className="h-8 text-xs text-primary" onClick={() => setStage("receivables")}>
                  View all →
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {[...openInvoices]
                  .sort((a, b) => dueBalance(b) - dueBalance(a))
                  .slice(0, 5)
                  .map((invoice) => (
                    <button
                      key={invoice.id}
                      type="button"
                      className="flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted/40"
                      onClick={() => navigate(`/app/billing/invoices/${invoice.id}`)}
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-semibold text-primary">{invoice.reference}</p>
                        <p className="truncate text-xs text-muted-foreground">{invoice.customerName}</p>
                      </div>
                      <span className="shrink-0 font-mono text-sm font-medium">{formatCurrency(dueBalance(invoice))}</span>
                    </button>
                  ))}
                {openInvoices.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No open receivables.</p>
                ) : null}
              </CardContent>
            </Card>
          </>
        ) : null}

        {stage !== "overview" ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">{section?.label}</h2>
              <p className="text-sm text-muted-foreground">{section?.hint}</p>
            </div>
            {stage !== "payments" ? (
              <div className="relative w-full sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search this section…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {stage === "receivables" ? (
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="grid gap-3 sm:grid-cols-3">
                <StatCard label="Open invoices" value={String(openInvoices.length)} icon={Receipt} />
                <StatCard label="Receivables" value={formatCurrencyShort(receivableTotal)} icon={IndianRupee} accent="warning" />
                <StatCard label="Overdue" value={String(overdueCount)} icon={Users} accent="warning" />
              </div>
              <ReportTable
                rows={openInvoices.map((invoice) => ({
                  id: invoice.id,
                  reference: invoice.reference,
                  customerName: invoice.customerName,
                  due: dueBalance(invoice),
                  bucket: agingBucket(invoice.dueAt),
                  status: invoice.status,
                  dueAt: invoice.dueAt,
                }))}
                empty="No open receivables."
                onRowClick={(row) => navigate(`/app/billing/invoices/${row.id}`)}
                columns={[
                  { key: "reference", header: "Invoice", render: (row) => row.reference },
                  { key: "customer", header: "Customer", render: (row) => row.customerName },
                  { key: "bucket", header: "Aging", render: (row) => row.bucket },
                  { key: "dueAt", header: "Due", render: (row) => formatDate(row.dueAt) },
                  { key: "due", header: "Balance", className: "text-right", render: (row) => formatCurrency(row.due) },
                  { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
                ]}
              />
            </CardContent>
          </Card>
        ) : null}

        {stage === "payments" ? (
          <div className="space-y-6">
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-medium">Incoming collections</p>
                  <div className="relative w-full sm:max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="Search invoice, customer, method…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <StatCard label="Payments" value={String(paymentRows.length)} icon={CreditCard} />
                  <StatCard label="Collected" value={formatCurrencyShort(collectedTotal)} icon={IndianRupee} accent="success" />
                </div>
                <ReportTable
                  rows={paymentRows}
                  empty="No incoming payments yet. Record them on an invoice."
                  onRowClick={(row) => navigate(`/app/billing/invoices/${row.invoiceId}`)}
                  columns={[
                    { key: "paidAt", header: "Date", render: (row) => formatDate(row.paidAt) },
                    { key: "reference", header: "Invoice", render: (row) => row.reference },
                    { key: "customer", header: "Customer", render: (row) => row.customerName },
                    { key: "method", header: "Method", render: (row) => row.method },
                    { key: "amount", header: "Amount", className: "text-right", render: (row) => formatCurrency(row.amount) },
                  ]}
                />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <ExpensesCommissions embedded />
              </CardContent>
            </Card>
          </div>
        ) : null}

        {stage === "vat" ? (
          <Card>
            <CardContent className="space-y-4 pt-6">
              <StatCard label="VAT output" value={formatCurrencyShort(vatTotal)} icon={Percent} />
              <ReportTable
                rows={vatRows}
                empty="No invoice tax recorded."
                onRowClick={(row) => navigate(`/app/billing/invoices/${row.id}`)}
                columns={[
                  { key: "reference", header: "Invoice", render: (row) => row.reference },
                  { key: "customer", header: "Customer", render: (row) => row.customerName },
                  { key: "channel", header: "Channel", render: (row) => row.channel },
                  { key: "taxable", header: "Taxable", className: "text-right", render: (row) => formatCurrency(row.taxable) },
                  { key: "tax", header: "VAT", className: "text-right", render: (row) => formatCurrency(row.tax) },
                  { key: "total", header: "Total", className: "text-right", render: (row) => formatCurrency(row.total) },
                  { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
                ]}
              />
            </CardContent>
          </Card>
        ) : null}

        {stage === "profit" ? (
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Billed" value={formatCurrencyShort(billedTotal)} icon={Receipt} />
                <StatCard label="Collected" value={formatCurrencyShort(collectedTotal)} icon={IndianRupee} accent="success" />
                <StatCard label="Costs" value={formatCurrencyShort(expenseTotal + commissionTotal)} icon={CreditCard} accent="warning" />
                <StatCard label="Net profit" value={formatCurrencyShort(netProfit)} icon={TrendingUp} accent={netProfit >= 0 ? "success" : "warning"} />
              </div>
              <p className="text-xs text-muted-foreground">
                Net profit = billed − expenses − commissions. Record costs under Payments.
              </p>
              <ReportTable
                rows={profitRows}
                empty="No invoices for profit."
                onRowClick={(row) => navigate(`/app/billing/invoices/${row.id}`)}
                columns={[
                  { key: "reference", header: "Invoice", render: (row) => row.reference },
                  { key: "customer", header: "Customer", render: (row) => row.customerName },
                  { key: "channel", header: "Channel", render: (row) => row.channel },
                  { key: "total", header: "Billed", className: "text-right", render: (row) => formatCurrency(row.total) },
                  { key: "paid", header: "Collected", className: "text-right", render: (row) => formatCurrency(row.paid) },
                  { key: "realized", header: "Realized", className: "text-right", render: (row) => `${row.realized.toFixed(1)}%` },
                  { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
                ]}
              />
            </CardContent>
          </Card>
        ) : null}

        {stage === "credit" ? (
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <StatCard label="Accounts on credit" value={String(creditRows.length)} icon={Users} />
                <StatCard label="Over limit" value={String(overLimitCount)} icon={CreditCard} accent={overLimitCount ? "warning" : undefined} />
              </div>
              <ReportTable
                rows={creditRows}
                empty="No credit limits or outstanding balances."
                onRowClick={(row) => navigate(`/app/customers/${row.id}`)}
                columns={[
                  { key: "name", header: "Customer", render: (row) => row.name },
                  { key: "terms", header: "Terms", render: (row) => row.paymentTerms },
                  { key: "limit", header: "Limit", className: "text-right", render: (row) => (row.creditLimit != null ? formatCurrency(row.creditLimit) : "—") },
                  { key: "outstanding", header: "Outstanding", className: "text-right", render: (row) => formatCurrency(row.outstanding) },
                  { key: "available", header: "Available", className: "text-right", render: (row) => (row.available != null ? formatCurrency(row.available) : "—") },
                  { key: "status", header: "Status", render: (row) => (row.over ? <StatusBadge status="over_limit" /> : <StatusBadge status="ok" />) },
                ]}
              />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </RoleGuard>
  );
}
