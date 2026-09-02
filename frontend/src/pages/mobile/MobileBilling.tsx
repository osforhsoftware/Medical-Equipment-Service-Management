import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, IndianRupee, Loader2 } from "lucide-react";
import { MobileHeader } from "@/components/mobile/MobileHeader";
import { MobileSearchBar } from "@/components/mobile/MobileSearchBar";
import { FilterPills } from "@/components/mobile/FilterPills";
import { WorkflowStatusChip } from "@/components/mobile/WorkflowStatusChip";
import { useMobilePullRefresh, useMobileUnreadCount } from "@/components/mobile/MobileLayout";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { SERVICE_BILLING_ROLES } from "@/config/roles";
import { ApiError, api, type BillingQueueKey, type BillingQueueRow } from "@/lib/api";
import { formatCurrency, formatCurrencyShort, formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";

const QUEUE_TABS = [
  { value: "all", label: "All" },
  { value: "readyForBilling", label: "Ready" },
  { value: "waitingVerification", label: "Verify" },
  { value: "pendingPayment", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "closed", label: "Closed" },
] as const;

function rowDetailPath(row: BillingQueueRow) {
  if (row.invoiceId) return `/app/billing/invoices/${row.invoiceId}`;
  return `/app/billing/jobs/${row.jobId}`;
}

export default function MobileBilling() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const unread = useMobileUnreadCount();
  const [counts, setCounts] = useState<Partial<Record<BillingQueueKey, number>>>({});
  const [items, setItems] = useState<BillingQueueRow[]>([]);
  const queueParam = searchParams.get("queue");
  const [activeQueue, setActiveQueue] = useState<string>(
    queueParam && QUEUE_TABS.some((t) => t.value === queueParam) ? queueParam : "all",
  );
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getBillingQueue();
      setCounts(data.counts ?? {});
      setItems(data.items ?? []);
    } catch (error) {
      toast({
        title: "Unable to load billing",
        description: error instanceof ApiError ? error.message : "Request failed",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useMobilePullRefresh(load);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((row) => {
      if (activeQueue !== "all" && row.queue !== activeQueue) return false;
      if (!q) return true;
      return [row.jobNumber, row.customer, row.equipment, row.invoiceRef]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [items, activeQueue, search]);

  const totals = useMemo(() => {
    const invoiceRows = items.filter((r) => r.invoiceId);
    return {
      paid: invoiceRows.reduce((sum, r) => sum + r.paidTotal, 0),
      due: invoiceRows.reduce((sum, r) => sum + r.balanceDue, 0),
    };
  }, [items]);

  const filterCounts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const tab of QUEUE_TABS) {
      if (tab.value === "all") continue;
      c[tab.value] = items.filter((r) => r.queue === tab.value).length;
    }
    return c;
  }, [items]);

  return (
    <RoleGuard roles={SERVICE_BILLING_ROLES}>
      <div className="mobile-page">
        <MobileHeader
          title="Billing"
          subtitle="Invoices & payments"
          badge={`${filtered.length} in queue`}
          unreadCount={unread}
          onNotifications={() => navigate("/app/notifications")}
        />

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="mobile-card !p-4">
            <p className="text-xs text-muted-foreground">Collected</p>
            <p className="font-display text-lg font-bold text-success">{formatCurrencyShort(totals.paid)}</p>
          </div>
          <div className="mobile-card !p-4">
            <p className="text-xs text-muted-foreground">Outstanding</p>
            <p className="font-display text-lg font-bold text-warning-foreground">{formatCurrencyShort(totals.due)}</p>
          </div>
        </div>

        <div className="mt-4">
          <MobileSearchBar value={search} onChange={setSearch} placeholder="Search jobs, customers, invoices…" />
        </div>

        <div className="mt-4">
          <FilterPills
            options={QUEUE_TABS.map((t) => ({ ...t, count: filterCounts[t.value] }))}
            value={activeQueue}
            onChange={setActiveQueue}
          />
        </div>

        <section className="mt-5 space-y-3">
          {loading ? (
            <div className="flex justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="mobile-card py-12 text-center text-sm text-muted-foreground">
              No billing items in this queue.
            </div>
          ) : (
            filtered.map((row) => (
              <button
                key={row.jobId + (row.invoiceId ?? "")}
                type="button"
                onClick={() => navigate(rowDetailPath(row))}
                className="mobile-card w-full text-left transition-all active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-muted-foreground">{row.jobNumber}</p>
                    <p className="truncate font-display text-base font-semibold">{row.equipment}</p>
                    <p className="truncate text-sm text-muted-foreground">{row.customer}</p>
                  </div>
                  <WorkflowStatusChip status={row.queue} label={row.invoiceStatus ?? row.verificationStatus} />
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 font-semibold text-foreground">
                    <IndianRupee className="h-3.5 w-3.5" />
                    {formatCurrency(row.total)}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDate(row.completionDate)}</span>
                </div>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                  View details <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </button>
            ))
          )}
        </section>
      </div>
    </RoleGuard>
  );
}
