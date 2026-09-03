import { Link } from "react-router-dom";
import { CheckCircle2, Circle } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EstimateItemsTable } from "@/components/estimates/EstimateItemsTable";
import { api, type BillingJobContext, type BillingVerificationItem, type EstimateLineInput } from "@/lib/api";
import {
  BILLING_CHARGE_GROUPS,
  billingLineTypeLabel,
  extraLineTotal,
  type BillingChargeGroupKey,
} from "@/lib/billingCharges";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

export function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export function ChargeBreakdown({
  groups,
  total,
  label = "Final amount",
}: {
  groups: Record<BillingChargeGroupKey, number>;
  total: number;
  label?: string;
}) {
  return (
    <div className="space-y-1">
      {BILLING_CHARGE_GROUPS.map((group) => (
        <InfoRow key={group.key} label={group.label} value={formatCurrency(groups[group.key])} />
      ))}
      <div className="flex items-start justify-between gap-4 border-t pt-2 text-sm">
        <span className="font-semibold">{label}</span>
        <span className="text-right text-base font-semibold">{formatCurrency(total)}</span>
      </div>
    </div>
  );
}

export function BillingTimeline({ events }: { events: { id: string; actor: string; action: string; note: string | null; at: string }[] }) {
  if (!events.length) return <p className="text-sm text-muted-foreground">No timeline events.</p>;
  return (
    <ol className="relative space-y-3 border-l pl-4">
      {events.map((event) => (
        <li key={event.id} className="relative">
          <span className="absolute -left-[1.3rem] top-1 h-2.5 w-2.5 rounded-full border-2 border-primary bg-background" />
          <p className="text-sm font-medium">{event.action}</p>
          <p className="text-xs text-muted-foreground">{event.actor} · {formatDateTime(event.at)}</p>
          {event.note ? <p className="mt-0.5 text-xs">{event.note}</p> : null}
        </li>
      ))}
    </ol>
  );
}

export function VerificationChecklist({ items }: { items: BillingVerificationItem[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.key} className="flex items-start gap-2 text-sm">
          {item.passed ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          ) : (
            <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className={item.passed ? "" : "text-muted-foreground"}>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

function estimateViewLines(context: BillingJobContext): EstimateLineInput[] {
  return (context.job.estimate?.lineItems ?? []).map((line) => ({
    type: line.type as EstimateLineInput["type"],
    description: line.description,
    catalogItemId: line.catalogItemId,
    inventoryItemId: line.inventoryItemId,
    partNumber: line.partNumber,
    quantity: Number(line.quantity),
    unitPrice: Number(line.unitPrice),
    taxRate: Number(line.taxRate),
    discount: Number(line.discount),
  }));
}

export function BillingEstimateDetails({ context }: { context: BillingJobContext }) {
  const estimate = context.job.estimate;
  if (!estimate) {
    return <p className="text-sm text-muted-foreground">No estimate is linked to this job.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{estimate.reference}</p>
          <p className="text-xs text-muted-foreground">
            Rev {estimate.revision} · Valid until {formatDate(estimate.validUntil)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={estimate.status} />
          <ButtonLink to={`/app/estimates/${estimate.id}`}>Open estimate</ButtonLink>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <InfoRow label="Customer" value={estimate.customerName} />
        <InfoRow label="Equipment" value={estimate.equipmentName} />
        <InfoRow label="Labor" value={formatCurrency(estimate.laborCost)} />
        <InfoRow label="Parts" value={formatCurrency(estimate.partsCost)} />
        <InfoRow label="Subtotal" value={formatCurrency(estimate.subtotal ?? 0)} />
        <InfoRow label="Discount" value={formatCurrency(estimate.discount ?? 0)} />
        <InfoRow label="Tax" value={formatCurrency(estimate.tax ?? 0)} />
        <InfoRow label="Estimate total" value={formatCurrency(estimate.total)} />
      </div>
      <EstimateItemsTable mode="view" lines={estimateViewLines(context)} />
      {estimate.notes ? (
        <Section title="Notes">
          <p className="whitespace-pre-line text-sm text-muted-foreground">{estimate.notes}</p>
        </Section>
      ) : null}
      {estimate.terms ? (
        <Section title="Terms & conditions">
          <p className="whitespace-pre-line text-sm text-muted-foreground">{estimate.terms}</p>
        </Section>
      ) : null}
    </div>
  );
}

function ButtonLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="text-xs font-medium text-primary hover:underline">
      {children}
    </Link>
  );
}

export function BillingEngineerExtras({ context }: { context: BillingJobContext }) {
  const extras = context.job.extras ?? [];
  if (!extras.length) {
    return <p className="text-sm text-muted-foreground">The service engineer did not add extra products, equipment, or machines.</p>;
  }

  return (
    <div className="space-y-3">
      {extras.map((extra) => (
        <div key={extra.id} className="rounded-lg border p-3 text-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">{extra.description}</p>
              <p className="text-xs text-muted-foreground">
                {billingLineTypeLabel(extra.type || "product")}
                {extra.inventoryItem?.sku ? ` · ${extra.inventoryItem.sku}` : ""}
              </p>
              {extra.reason ? <p className="mt-1 text-xs text-muted-foreground">{extra.reason}</p> : null}
            </div>
            <StatusBadge status={extra.status} />
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>
              {Number(extra.quantity)} × {formatCurrency(extra.unitPrice)}
            </span>
            <span className="font-medium text-foreground">{formatCurrency(extraLineTotal(extra))}</span>
          </div>
          {extra.status !== "approved" ? (
            <p className="mt-2 text-xs text-amber-700">Not billed until this extra is approved.</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function BillingJobFacts({ context }: { context: BillingJobContext }) {
  const facts = [
    { label: "Customer", value: context.job.customerName },
    { label: "Equipment", value: context.job.equipmentName },
    { label: "Serial number", value: context.job.equipment?.serialNumber ?? "—" },
    { label: "Engineer", value: context.job.engineer },
    { label: "Service request", value: context.job.requestRef },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {facts.map((fact) => (
        <div key={fact.label} className="min-w-0 rounded-md bg-muted/40 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{fact.label}</p>
          <p className="mt-0.5 truncate text-sm font-medium" title={String(fact.value ?? "")}>
            {fact.value || "—"}
          </p>
        </div>
      ))}
    </div>
  );
}

export function BillingServiceNotes({ context }: { context: BillingJobContext }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Section title="Complaint">
        <p className="text-sm text-muted-foreground">{context.job.serviceRequest?.description ?? "—"}</p>
      </Section>

      <Section title="Inspection">
        <p className="text-sm">{context.job.serviceRequest?.inspectionReport?.findings ?? "No inspection report on file."}</p>
      </Section>

      <Section title="Engineer report">
        {(context.job.workLogs ?? []).length ? (
          context.job.workLogs!.map((log) => (
            <div key={log.id} className="mb-3 rounded-md border p-3 text-sm">
              <p className="font-medium">{formatDateTime(log.startedAt)}</p>
              <p className="mt-1 text-muted-foreground">{log.workPerformed}</p>
              {log.testingResult ? <p className="mt-1 text-xs">Testing: {log.testingResult}</p> : null}
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No work logs recorded.</p>
        )}
      </Section>

      <Section title="Parts used">
        {(context.job.stockMovements ?? []).length ? (
          context.job.stockMovements!.map((m) => (
            <div key={m.id} className="flex justify-between text-sm">
              <span>{m.inventoryItem?.name ?? "Part"}</span>
              <span>{Math.abs(m.quantity)} × {formatCurrency(m.inventoryItem?.unitCost ?? 0)}</span>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No parts consumption recorded.</p>
        )}
      </Section>

      <div className="lg:col-span-2">
        <Section title="Service timeline">
          <BillingTimeline events={context.job.serviceRequest?.timelineEvents ?? []} />
        </Section>
      </div>
    </div>
  );
}

export function BillingServiceContext({ context }: { context: BillingJobContext }) {
  return (
    <div className="space-y-4">
      <BillingJobFacts context={context} />
      <BillingServiceNotes context={context} />
    </div>
  );
}

/** Keep seeded/generated "Service for JOB-…" lines aligned with the invoice job reference. */
export function normalizeInvoiceLineDescription(description: string, jobRef?: string | null) {
  if (!jobRef || !/^Service for JOB-/i.test(description)) return description;
  return `Service for ${jobRef}`;
}

export async function downloadInvoicePdf(invoiceId: string) {
  const doc = await api.generateDocument("invoice", invoiceId);
  if (doc.file?.id) window.open(api.fileDownloadUrl(doc.file.id), "_blank");
  return doc;
}
