import { Link } from "react-router-dom";
import { History, MapPin } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { api, type BackendEquipmentHistory } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { termLabel } from "@/lib/taxonomy";

const AMC_LABELS: Record<string, string> = {
  active: "Active",
  expiring: "Expiring",
  expired: "Expired",
  none: "None",
};

export function ScannedEquipmentDetails({
  history,
  qrDataUrl,
}: {
  history: BackendEquipmentHistory;
  qrDataUrl?: string;
}) {
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

      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <Field label="Customer" value={equipment.customerName} />
        <Field label="Location" value={equipment.location} icon={MapPin} />
        <Field label="Category" value={categoryName} />
        <Field label="Serial" value={equipment.serialNumber} />
        <Field label="Condition" value={conditionName} />
        <Field label="AMC" value={AMC_LABELS[equipment.amcStatus] ?? equipment.amcStatus} />
        <Field label="Installed" value={formatDate(equipment.installDate)} />
        <Field label="Warranty end" value={formatDate(equipment.warrantyEnd)} />
        <Field label="Last service" value={equipment.lastServiceDate ? formatDate(equipment.lastServiceDate) : "Not recorded"} />
      </div>

      <Button asChild variant="outline">
        <Link to={`/app/equipment/${equipment.id}`}>View full equipment record</Link>
      </Button>

      <HistoryList
        title="Service tickets"
        empty="No service tickets for this equipment."
        items={history.requests.map((item) => ({
          id: item.id,
          to: `/app/service-tickets/${item.id}`,
          title: `${item.reference} · ${item.type}`,
          detail: item.description,
          meta: `${formatDate(item.createdAt)} · ${item.status}`,
        }))}
      />
      <HistoryList
        title="Service jobs"
        empty="No service jobs for this equipment."
        items={history.jobs.map((item) => ({
          id: item.id,
          to: `/app/jobs/${item.id}`,
          title: item.reference,
          detail: item.engineer ? `Lead: ${item.engineer}` : null,
          meta: `${formatDate(item.scheduledFor)} · ${item.status}`,
        }))}
      />
      <HistoryList
        title="Invoices"
        empty="No invoices for this equipment."
        items={history.invoices.map((item) => ({
          id: item.id,
          to: `/app/billing/invoices/${item.id}`,
          title: item.reference,
          detail: formatCurrency(item.total),
          meta: `${formatDate(item.issuedAt)} · ${item.status}`,
        }))}
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

function HistoryList({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: { id: string; to: string; title: string; detail?: string | null; meta: string }[];
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="mb-3 flex items-center gap-1.5 text-sm font-medium">
        <History className="h-4 w-4 text-primary" /> {title}
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ol className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link to={item.to} className="block rounded-md border border-border/70 p-3 text-sm hover:bg-muted/40">
                <p className="font-medium">{item.title}</p>
                {item.detail ? <p className="text-xs text-muted-foreground line-clamp-2">{item.detail}</p> : null}
                <p className="mt-0.5 text-xs text-muted-foreground">{item.meta}</p>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
