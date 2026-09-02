import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Building2, FileText, Mail, MapPin, Phone, User } from "lucide-react";
import {
  DetailInfoGrid,
  DetailSection,
  RecordDetailLayout,
} from "@/components/shared/RecordDetailLayout";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ESTIMATE_WRITE_ROLES, SALES_WRITE_ROLES } from "@/config/roles";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError, type BackendCustomer, type BackendEquipment, type BackendEstimate, type BackendInvoice, type BackendServiceJob, type BackendServiceRequest } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";
import { termLabel } from "@/lib/taxonomy";
import { useQuery } from "@tanstack/react-query";

export default function CustomerDetail() {
  const { hasRole } = useAuth();
  const canQuote = hasRole(ESTIMATE_WRITE_ROLES);
  const canSell = hasRole(SALES_WRITE_ROLES);
  const { id = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [customer, setCustomer] = useState<BackendCustomer | null>(null);
  const [equipment, setEquipment] = useState<BackendEquipment[]>([]);
  const [tickets, setTickets] = useState<BackendServiceRequest[]>([]);
  const [jobs, setJobs] = useState<BackendServiceJob[]>([]);
  const [estimates, setEstimates] = useState<BackendEstimate[]>([]);
  const [invoices, setInvoices] = useState<BackendInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tab = searchParams.get("tab") ?? "overview";
  const typesQuery = useQuery({
    queryKey: ["taxonomy", "customer_type"],
    queryFn: () => api.listTaxonomy({ type: "customer_type" }),
    staleTime: 60_000,
  });
  const conditionsQuery = useQuery({
    queryKey: ["taxonomy", "equipment_condition"],
    queryFn: () => api.listTaxonomy({ type: "equipment_condition" }),
    staleTime: 60_000,
  });
  const customerTypeName = termLabel(typesQuery.data, customer?.type, customer?.typeOther);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const record = await api.getCustomer(id);
      setCustomer(record);
      const [eq, sr, jb, est, inv] = await Promise.all([
        api.listEquipment({ customerId: id, limit: 100, page: 1 }).then((r) => r.data).catch(() => [] as BackendEquipment[]),
        api.listServiceRequests({ customerId: id, limit: 100, page: 1 }).then((r) => r.data).catch(() => [] as BackendServiceRequest[]),
        api.listJobs({ customerId: id, limit: 100, page: 1 }).then((r) => r.data).catch(() => [] as BackendServiceJob[]),
        api.listEstimates({ customerId: id, limit: 100, page: 1 }).then((r) => r.data).catch(() => [] as BackendEstimate[]),
        api.listInvoices().catch(() => [] as BackendInvoice[]),
      ]);
      setEquipment(eq);
      setTickets(sr.filter((r) => r.customerId === id || r.customerName === record.name));
      setJobs(jb.filter((j) => j.customerId === id || j.customerName === record.name));
      setEstimates(est.filter((e) => e.customerId === id || e.customerName === record.name));
      setInvoices(inv.filter((i) => i.customerId === id || i.customerName === record.name));
    } catch (err) {
      setCustomer(null);
      setError(err instanceof ApiError && err.status === 404 ? null : "Please try again.");
      if (!(err instanceof ApiError && err.status === 404)) {
        toast.apiError(err, { fallback: "Failed to load customer" });
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <RecordDetailLayout
      backTo="/app/customers"
      backLabel="Back to Customers"
      title={customer?.name ?? "Customer"}
      subtitle={customer ? (
        <>
          <span className="font-mono text-xs">{customer.reference}</span>
          {" · "}
          {customerTypeName}
          {" · "}
          {[customer.city, customer.country].filter(Boolean).join(", ") || "No location"}
        </>
      ) : undefined}
      status={customer?.status}
      meta={customer ? [
        { label: "Customer ID", value: customer.reference },
        { label: "Contact", value: customer.contactPerson },
        { label: "Equipment", value: String(customer.equipmentCount) },
        { label: "Active jobs", value: String(customer.activeJobs) },
      ] : undefined}
      loading={loading}
      error={error}
      notFound={!loading && !error && !customer}
      notFoundTitle="Customer not found"
      notFoundDescription="The requested customer could not be found."
      actions={
        customer && (canSell || canQuote) ? (
          <div className="flex flex-wrap gap-2">
            {canSell ? (
              <Button asChild>
                <Link to="/app/sales?new=1">
                  <FileText className="mr-1 h-4 w-4" /> New sale
                </Link>
              </Button>
            ) : null}
            {canQuote ? (
              <Button variant={canSell ? "outline" : "default"} asChild>
                <Link to="/app/estimates">
                  <FileText className="mr-1 h-4 w-4" /> Service estimate
                </Link>
              </Button>
            ) : null}
          </div>
        ) : undefined
      }
      onRetry={() => void load()}
      activeTab={tab}
      onTabChange={(value) => setSearchParams(value === "overview" ? {} : { tab: value })}
      tabs={customer ? [
        {
          id: "overview",
          label: "Overview",
          content: (
            <div className="space-y-4">
              <DetailSection title="Contact">
                <div className="space-y-2 text-sm">
                  <Row icon={User} label="Contact person" value={customer.contactPerson} />
                  <Row icon={Mail} label="Email" value={customer.email} />
                  <Row icon={Phone} label="Phone" value={customer.phone} />
                </div>
              </DetailSection>
              <DetailSection title="Site address">
                <div className="space-y-2 text-sm">
                  <Row icon={MapPin} label="Address" value={customer.address || "—"} />
                  <Row icon={MapPin} label="City" value={customer.city || "—"} />
                  <Row icon={MapPin} label="Country" value={customer.country || "—"} />
                  <Row icon={Building2} label="License / GST" value={customer.licenseGst?.trim() || "—"} />
                </div>
              </DetailSection>
              <DetailSection title="Record">
                <DetailInfoGrid
                  items={[
                    { label: "Added", value: formatDate(customer.createdAt) },
                    { label: "Last updated", value: formatDate(customer.updatedAt) },
                    { label: "Type", value: customerTypeName },
                    { label: "Status", value: customer.status },
                  ]}
                />
              </DetailSection>
            </div>
          ),
        },
        {
          id: "equipment",
          label: "Equipment",
          content: (
            <DetailSection title="Equipment">
              {equipment.length === 0 ? (
                <p className="text-sm text-muted-foreground">No equipment linked.</p>
              ) : (
                <div className="space-y-2">
                  {equipment.map((e) => (
                    <Link key={e.id} to={`/app/equipment/${e.id}`} className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-secondary/40">
                      <div>
                        <p className="font-medium">{e.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">{e.assetTag}</p>
                      </div>
                      <StatusBadge status={e.condition} label={termLabel(conditionsQuery.data, e.condition)} />
                    </Link>
                  ))}
                </div>
              )}
            </DetailSection>
          ),
        },
        {
          id: "tickets",
          label: "Tickets",
          content: (
            <DetailSection title="Service tickets">
              {tickets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tickets.</p>
              ) : (
                <div className="space-y-2">
                  {tickets.map((r) => (
                    <Link key={r.id} to={`/app/service-tickets/${r.id}`} className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-secondary/40">
                      <div>
                        <p className="font-mono font-medium">{r.reference}</p>
                        <p className="text-xs text-muted-foreground">{r.equipmentName}</p>
                      </div>
                      <StatusBadge status={r.status} />
                    </Link>
                  ))}
                </div>
              )}
            </DetailSection>
          ),
        },
        {
          id: "jobs",
          label: "Jobs",
          content: (
            <DetailSection title="Service jobs">
              {jobs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No jobs.</p>
              ) : (
                <div className="space-y-2">
                  {jobs.map((j) => (
                    <Link key={j.id} to={`/app/jobs/${j.id}`} className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-secondary/40">
                      <div>
                        <p className="font-mono font-medium">{j.reference}</p>
                        <p className="text-xs text-muted-foreground">{j.equipmentName}</p>
                      </div>
                      <StatusBadge status={j.status} />
                    </Link>
                  ))}
                </div>
              )}
            </DetailSection>
          ),
        },
        {
          id: "estimates",
          label: "Estimates",
          content: (
            <DetailSection title="Estimates">
              {estimates.length === 0 ? (
                <p className="text-sm text-muted-foreground">No estimates.</p>
              ) : (
                <div className="space-y-2">
                  {estimates.map((e) => (
                    <Link key={e.id} to={`/app/estimates/${e.id}`} className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-secondary/40">
                      <div>
                        <p className="font-mono font-medium">{e.reference}</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(e.total)}</p>
                      </div>
                      <StatusBadge status={e.status} />
                    </Link>
                  ))}
                </div>
              )}
            </DetailSection>
          ),
        },
        {
          id: "invoices",
          label: "Invoices",
          content: (
            <DetailSection title="Invoices">
              {invoices.length === 0 ? (
                <p className="text-sm text-muted-foreground">No invoices.</p>
              ) : (
                <div className="space-y-2">
                  {invoices.map((i) => (
                    <Link key={i.id} to={`/app/billing/invoices/${i.id}`} className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-secondary/40">
                      <div>
                        <p className="font-mono font-medium">{i.reference}</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(Number(i.total))}</p>
                      </div>
                      <StatusBadge status={i.status} />
                    </Link>
                  ))}
                </div>
              )}
            </DetailSection>
          ),
        },
      ] : undefined}
      sidebar={customer ? (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">At a glance</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Equipment</span><span>{equipment.length}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Tickets</span><span>{tickets.length}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Jobs</span><span>{jobs.length}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Estimates</span><span>{estimates.length}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Invoices</span><span>{invoices.length}</span></div>
          </CardContent>
        </Card>
      ) : undefined}
    />
  );
}

function Row({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border/70 p-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  );
}
