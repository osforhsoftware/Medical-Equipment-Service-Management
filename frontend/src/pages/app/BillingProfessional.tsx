import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  Clock,
  Eye,
  FileText,
  IndianRupee,
  Loader2,
  Printer,
  Search,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StatCard } from "@/components/shared/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { SERVICE_BILLING_ROLES } from "@/config/roles";
import { ApiError, api, type BillingQueueKey, type BillingQueueRow } from "@/lib/api";
import { formatCurrency, formatCurrencyShort, formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const QUEUE_TABS: { key: BillingQueueKey | "all"; label: string }[] = [
  { key: "all", label: "All queues" },
  { key: "readyForBilling", label: "Ready For Billing" },
  { key: "waitingVerification", label: "Waiting Verification" },
  { key: "invoiceDraft", label: "Invoice Draft" },
  { key: "waitingApproval", label: "Waiting Approval" },
  { key: "invoiceSent", label: "Invoice Sent" },
  { key: "pendingPayment", label: "Pending Payment" },
  { key: "partialPayment", label: "Partial Payment" },
  { key: "paid", label: "Paid" },
  { key: "overdue", label: "Overdue" },
  { key: "closed", label: "Closed" },
];

const PRIORITY_TONE: Record<string, string> = {
  critical: "border-destructive/30 bg-destructive/10 text-destructive",
  high: "border-warning/30 bg-warning/10 text-warning-foreground",
  medium: "border-info/20 bg-info/10 text-info",
  low: "border-muted bg-muted/50 text-muted-foreground",
};

function rowDetailPath(row: BillingQueueRow, options?: { edit?: boolean; print?: boolean }) {
  if (row.invoiceId) {
    const base = `/app/billing/invoices/${row.invoiceId}`;
    const params = new URLSearchParams();
    if (
      options?.edit
      && row.invoiceStatus
      && ["draft", "pendingApproval"].includes(row.invoiceStatus)
    ) {
      params.set("edit", "1");
    }
    if (options?.print) params.set("print", "1");
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }
  return `/app/billing/jobs/${row.jobId}`;
}

export default function BillingProfessional() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queueParam = searchParams.get("queue") as BillingQueueKey | "all" | null;
  const [counts, setCounts] = useState<Record<BillingQueueKey, number>>({} as Record<BillingQueueKey, number>);
  const [items, setItems] = useState<BillingQueueRow[]>([]);
  const [activeQueue, setActiveQueue] = useState<BillingQueueKey | "all">(
    queueParam && (queueParam === "all" || QUEUE_TABS.some((t) => t.key === queueParam)) ? queueParam : "waitingVerification",
  );
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getBillingQueue();
      setCounts(data.counts ?? ({} as Record<BillingQueueKey, number>));
      setItems(data.items ?? []);
    } catch (error) {
      toast({
        title: "Unable to load billing queue",
        description: error instanceof ApiError ? error.message : "Request failed",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((row) => {
      if (activeQueue !== "all" && row.queue !== activeQueue) return false;
      if (!q) return true;
      return [row.jobNumber, row.serviceRequestRef, row.customer, row.equipment, row.invoiceRef, row.engineer]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [items, activeQueue, search]);

  const totals = useMemo(() => {
    const invoiceRows = items.filter((r) => r.invoiceId);
    return {
      paid: invoiceRows.reduce((sum, r) => sum + r.paidTotal, 0),
      due: invoiceRows.reduce((sum, r) => sum + r.balanceDue, 0),
      overdue: counts.overdue ?? 0,
    };
  }, [items, counts]);

  const readyCount = counts.readyForBilling ?? 0;

  useEffect(() => {
    if (queueParam && (queueParam === "all" || QUEUE_TABS.some((t) => t.key === queueParam))) {
      setActiveQueue(queueParam);
    }
  }, [queueParam]);

  return (
    <RoleGuard roles={SERVICE_BILLING_ROLES}>
      <div className="space-y-6">
        <PageHeader
          title="Service ticket billing"
          description="Verify completed jobs, create service invoices, and collect payment. Product sale invoices stay on the Sales floor."
          actions={
            readyCount > 0 ? (
              <Button variant="brand" asChild>
                <Link to="/app/billing?queue=readyForBilling">
                  <FileText className="mr-2 h-4 w-4" />
                  {readyCount} ready to invoice
                </Link>
              </Button>
            ) : null
          }
        />

        <Card className="border-info/30 bg-info/5">
          <CardContent className="space-y-2 p-4 text-sm">
            <p className="font-medium text-foreground">Where to add products / services on the bill</p>
            <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>
                In <span className="font-medium text-foreground">Waiting Verification</span>, click{" "}
                <span className="font-medium text-foreground">Verify &amp; review</span>.
              </li>
              <li>
                Confirm verification, then on that page use{" "}
                <span className="font-medium text-foreground">Add Item</span> and{" "}
                <span className="font-medium text-foreground">Generate final bill</span>.
              </li>
              <li>
                Later open the <span className="font-medium text-foreground">Invoice Draft</span> tab →{" "}
                <span className="font-medium text-foreground">Edit invoice</span> to add more products or services.
              </li>
            </ol>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Collected" value={formatCurrencyShort(totals.paid)} icon={IndianRupee} accent="success" />
          <StatCard label="Outstanding" value={formatCurrencyShort(totals.due)} icon={Clock} accent="warning" />
          <StatCard label="Overdue" value={String(totals.overdue)} icon={AlertCircle} accent="destructive" />
        </div>

        <div className="sticky top-0 z-20 -mx-1 space-y-3 rounded-lg border bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="flex flex-wrap gap-2">
            {QUEUE_TABS.map((tab) => {
              const count = tab.key === "all" ? items.length : counts[tab.key as BillingQueueKey] ?? 0;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveQueue(tab.key)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    activeQueue === tab.key
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/40 text-muted-foreground hover:bg-muted",
                  )}
                >
                  {tab.label}
                  <Badge variant="secondary" className="h-5 min-w-5 justify-center px-1.5 text-[10px]">{count}</Badge>
                </button>
              );
            })}
          </div>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search jobs, customers, equipment…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading billing queue…
          </div>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Billing work queue</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full min-w-[1280px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="p-3">Priority</th>
                    <th className="p-3">Service Request</th>
                    <th className="p-3">Job</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Equipment</th>
                    <th className="p-3">Serial</th>
                    <th className="p-3">Hospital</th>
                    <th className="p-3">Engineer</th>
                    <th className="p-3">Completed</th>
                    <th className="p-3">Verification</th>
                    <th className="p-3">Estimate</th>
                    <th className="p-3">Parts</th>
                    <th className="p-3">Labour</th>
                    <th className="p-3">Invoice</th>
                    <th className="p-3">Payment</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr
                      key={`${row.jobId}-${row.invoiceId ?? "job"}`}
                      className="cursor-pointer border-b hover:bg-muted/20"
                      onClick={() => navigate(rowDetailPath(row))}
                    >
                      <td className="p-3">
                        <span className={cn("rounded-full border px-2 py-0.5 text-xs capitalize", PRIORITY_TONE[row.priority] ?? PRIORITY_TONE.medium)}>
                          {row.priority}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-xs">{row.serviceRequestRef}</td>
                      <td className="p-3 font-mono font-medium">{row.jobNumber}</td>
                      <td className="p-3">{row.customer}</td>
                      <td className="p-3">{row.equipment}</td>
                      <td className="p-3 font-mono text-xs">{row.serialNumber ?? "—"}</td>
                      <td className="p-3">{row.hospital}</td>
                      <td className="p-3">{row.engineer}</td>
                      <td className="p-3">{row.completionDate ? formatDate(row.completionDate) : "—"}</td>
                      <td className="p-3"><StatusBadge status={row.verificationStatus} /></td>
                      <td className="p-3">{formatCurrency(row.estimateAmount)}</td>
                      <td className="p-3">{formatCurrency(row.actualPartsCost)}</td>
                      <td className="p-3">{formatCurrency(row.labourCharges)}</td>
                      <td className="p-3">{row.invoiceStatus ? <StatusBadge status={row.invoiceStatus} /> : "—"}</td>
                      <td className="p-3">{row.invoiceId ? <StatusBadge status={row.paymentStatus} /> : "—"}</td>
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-wrap gap-1">
                          <Button size="sm" variant="outline" asChild>
                            <Link
                              to={rowDetailPath(row, {
                                edit: Boolean(
                                  row.invoiceId
                                  && row.invoiceStatus
                                  && ["draft", "pendingApproval"].includes(row.invoiceStatus),
                                ),
                              })}
                            >
                              {row.invoiceId && row.invoiceStatus && ["draft", "pendingApproval"].includes(row.invoiceStatus) ? (
                                <><FileText className="mr-1 h-3.5 w-3.5" /> Edit invoice</>
                              ) : row.invoiceId ? (
                                <><Eye className="mr-1 h-3.5 w-3.5" /> Open invoice</>
                              ) : row.verificationStatus === "verified" || row.verificationStatus === "passed" ? (
                                <><FileText className="mr-1 h-3.5 w-3.5" /> Create bill</>
                              ) : (
                                <><ShieldCheck className="mr-1 h-3.5 w-3.5" /> Verify & review</>
                              )}
                            </Link>
                          </Button>
                          {row.invoiceId ? (
                            <Button size="sm" variant="ghost" asChild>
                              <Link to={rowDetailPath(row, { print: true })}>
                                <Printer className="mr-1 h-3.5 w-3.5" /> Print
                              </Link>
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filtered.length ? (
                <p className="p-10 text-center text-muted-foreground">No items in this queue.</p>
              ) : null}
            </CardContent>
          </Card>
        )}
      </div>
    </RoleGuard>
  );
}
