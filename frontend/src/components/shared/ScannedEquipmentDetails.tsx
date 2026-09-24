import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ExternalLink, History, MapPin } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import {
  api,
  type BackendEquipmentHistory,
  type BackendInvoice,
  type BackendServiceJob,
  type BackendServiceRequest,
} from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { termLabel } from "@/lib/taxonomy";
import { userCanAccessPath } from "@/lib/userRoles";
import { cn } from "@/lib/utils";

export function ScannedEquipmentDetails({
  history,
  qrDataUrl,
}: {
  history: BackendEquipmentHistory;
  qrDataUrl?: string;
}) {
  const { user } = useAuth();
  const { rbacMatrix } = useSettings();
  const equipment = history.equipment;
  const categoriesQuery = useQuery({
    queryKey: ["taxonomy", "equipment_category"],
    queryFn: () => api.listTaxonomy({ type: "equipment_category" }),
    staleTime: 60_000,
  });
  const conditionsQuery = useQuery({
    queryKey: ["taxonomy", "equipment_condition"],
    queryFn: () => api.listTaxonomy({ type: "equipment_condition" }),
    staleTime: 60_000,
  });
  const categoryName = termLabel(categoriesQuery.data, equipment.category);
  const conditionName = termLabel(conditionsQuery.data, equipment.condition);

  const canOpen = (path: string) =>
    Boolean(user && userCanAccessPath(user, path, rbacMatrix));

  const equipmentPath = `/app/equipment/${equipment.id}`;
  const canOpenEquipment = canOpen(equipmentPath);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold tracking-tight">{equipment.name}</h3>
          <p className="text-sm text-muted-foreground">
            {equipment.manufacturer} · {equipment.model}
          </p>
          <span className="mt-1 inline-block rounded-md bg-muted px-2 py-1 font-mono text-xs">{equipment.assetTag}</span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <StatusBadge status={equipment.condition} label={conditionName} />
          {qrDataUrl ? <img src={qrDataUrl} alt={`QR for ${equipment.assetTag}`} className="h-16 w-16 rounded-md border" /> : null}
        </div>
      </div>

      <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        Scan result shows full service history, jobs, and invoices here. Open a linked record only when your role allows.
      </p>

      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <Field label="Customer" value={equipment.customerName} />
        <Field label="Location" value={equipment.location} icon={MapPin} />
        <Field label="Category" value={categoryName} />
        <Field label="Serial" value={equipment.serialNumber} />
        <Field label="Condition" value={conditionName} />
        <Field label="Installed" value={formatDate(equipment.installDate)} />
        <Field
          label="Machine warranty"
          value={
            equipment.noMachineWarranty
              ? "No warranty"
              : [formatDate(equipment.warrantyStart), formatDate(equipment.warrantyEnd)].filter((v) => v && v !== "—").join(" → ") || "—"
          }
        />
        <Field
          label="Service warranty"
          value={
            equipment.noServiceWarranty
              ? "No warranty"
              : [formatDate(equipment.serviceWarrantyStart), formatDate(equipment.serviceWarrantyEnd)].filter((v) => v && v !== "—").join(" → ") || "—"
          }
        />
        <Field label="Last service" value={equipment.lastServiceDate ? formatDate(equipment.lastServiceDate) : "Not recorded"} />
      </div>

      {canOpenEquipment ? (
        <Button asChild variant="outline">
          <Link to={equipmentPath}>View full equipment record</Link>
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">
          Equipment summary is shown above. Your role cannot open the full equipment editor.
        </p>
      )}

      <TicketHistory
        items={history.requests}
        canOpen={(id) => canOpen(`/app/service-tickets/${id}`)}
      />
      <JobHistory
        items={history.jobs}
        canOpen={(id) => canOpen(`/app/jobs/${id}`)}
      />
      <InvoiceHistory
        items={history.invoices}
        canOpen={(id) => canOpen(`/app/billing/invoices/${id}`)}
      />
    </div>
  );
}

function Field({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof MapPin }) {
  return (
    <div className="rounded-lg border border-border p-2.5">
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        {Icon ? <Icon className="h-3 w-3" /> : null} {label}
      </p>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );
}

function ExpandableCard({
  title,
  meta,
  detail,
  children,
  href,
  canOpen,
}: {
  title: string;
  meta: string;
  detail?: string | null;
  children: ReactNode;
  href?: string;
  canOpen: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <li className="rounded-md border border-border/70">
      <button
        type="button"
        className="flex w-full items-start gap-2 p-3 text-left text-sm hover:bg-muted/40"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <p className="font-medium">{title}</p>
          {detail ? <p className="text-xs text-muted-foreground line-clamp-2">{detail}</p> : null}
          <p className="mt-0.5 text-xs text-muted-foreground">{meta}</p>
        </div>
        <ChevronDown className={cn("mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="space-y-2 border-t border-border/70 px-3 py-3 text-sm">
          {children}
          {href && canOpen ? (
            <Link
              to={href}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Open full record <ExternalLink className="h-3 w-3" />
            </Link>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function HistorySection({
  title,
  empty,
  count,
  children,
}: {
  title: string;
  empty: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="mb-3 flex items-center gap-1.5 text-sm font-medium">
        <History className="h-4 w-4 text-primary" /> {title}
      </p>
      {count === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : <ol className="space-y-2">{children}</ol>}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || "—"}</span>
    </div>
  );
}

function TicketHistory({
  items,
  canOpen,
}: {
  items: BackendServiceRequest[];
  canOpen: (id: string) => boolean;
}) {
  return (
    <HistorySection title="Service tickets" empty="No service tickets for this equipment." count={items.length}>
      {items.map((item) => (
        <ExpandableCard
          key={item.id}
          title={`${item.reference} · ${item.type ?? "Service"}`}
          detail={item.description}
          meta={`${formatDate(item.createdAt)} · ${item.status}`}
          href={`/app/service-tickets/${item.id}`}
          canOpen={canOpen(item.id)}
        >
          <DetailRow label="Status" value={item.status} />
          <DetailRow label="Priority" value={item.priority} />
          <DetailRow label="Customer" value={item.customerName} />
          <DetailRow label="Assigned" value={item.assignedName ?? "Unassigned"} />
          <DetailRow label="Inspector" value={item.assignedInspectorName ?? "—"} />
          <DetailRow label="SLA due" value={formatDate(item.slaDue)} />
          {item.description ? (
            <p className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground whitespace-pre-wrap">{item.description}</p>
          ) : null}
        </ExpandableCard>
      ))}
    </HistorySection>
  );
}

function JobHistory({
  items,
  canOpen,
}: {
  items: BackendServiceJob[];
  canOpen: (id: string) => boolean;
}) {
  return (
    <HistorySection title="Service jobs" empty="No service jobs for this equipment." count={items.length}>
      {items.map((item) => (
        <ExpandableCard
          key={item.id}
          title={item.reference}
          detail={item.engineer ? `Lead: ${item.engineer}` : null}
          meta={`${formatDate(item.scheduledFor)} · ${item.status}`}
          href={`/app/jobs/${item.id}`}
          canOpen={canOpen(item.id)}
        >
          <DetailRow label="Status" value={item.status} />
          <DetailRow label="Type" value={item.typeOther?.trim() || item.type} />
          <DetailRow label="Lead engineer" value={item.engineer || "—"} />
          <DetailRow label="Ticket" value={item.requestRef || "—"} />
          <DetailRow label="Customer" value={item.customerName} />
          <DetailRow label="Progress" value={`${item.progress ?? 0}%`} />
          <DetailRow label="Scheduled" value={formatDate(item.scheduledFor)} />
        </ExpandableCard>
      ))}
    </HistorySection>
  );
}

function InvoiceHistory({
  items,
  canOpen,
}: {
  items: BackendInvoice[];
  canOpen: (id: string) => boolean;
}) {
  return (
    <HistorySection title="Invoices" empty="No invoices for this equipment." count={items.length}>
      {items.map((item) => (
        <ExpandableCard
          key={item.id}
          title={item.reference}
          detail={`${formatCurrency(item.total)} · ${item.customerName}`}
          meta={`${formatDate(item.issuedAt)} · ${item.status}`}
          href={`/app/billing/invoices/${item.id}`}
          canOpen={canOpen(item.id)}
        >
          <DetailRow label="Status" value={item.status} />
          <DetailRow label="Customer" value={item.customerName} />
          <DetailRow label="Job ref" value={item.jobRef || "—"} />
          <DetailRow label="Amount" value={formatCurrency(item.amount)} />
          <DetailRow label="Tax" value={formatCurrency(item.tax)} />
          <DetailRow label="Total" value={formatCurrency(item.total)} />
          <DetailRow label="Paid" value={formatCurrency(item.paidTotal ?? 0)} />
          <DetailRow label="Balance" value={formatCurrency(item.balanceDue ?? item.total)} />
          <DetailRow label="Issued" value={formatDate(item.issuedAt)} />
          <DetailRow label="Due" value={formatDate(item.dueAt)} />
          {item.lineItems?.length ? (
            <div className="space-y-1 rounded-md border border-border/60 p-2">
              <p className="text-xs font-medium">Line items</p>
              {item.lineItems.map((line) => (
                <div key={line.id} className="flex justify-between gap-2 text-xs text-muted-foreground">
                  <span className="min-w-0 truncate">{line.description}</span>
                  <span className="shrink-0 font-medium text-foreground">{formatCurrency(line.lineTotal)}</span>
                </div>
              ))}
            </div>
          ) : null}
        </ExpandableCard>
      ))}
    </HistorySection>
  );
}
