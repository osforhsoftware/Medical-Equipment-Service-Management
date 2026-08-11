import { CheckCircle2, Circle } from "lucide-react";
import { api, type BillingJobContext, type BillingVerificationItem } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/format";

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

export function BillingServiceContext({ context }: { context: BillingJobContext }) {
  return (
    <div className="space-y-4">
      <Section title="Customer & equipment">
        <InfoRow label="Customer" value={context.job.customerName} />
        <InfoRow label="Hospital / Org" value={context.job.serviceRequest?.customerName ?? context.job.customerName} />
        <InfoRow label="Equipment" value={context.job.equipmentName} />
        <InfoRow label="Serial number" value={context.job.equipment?.serialNumber ?? "—"} />
        <InfoRow label="Engineer" value={context.job.engineer} />
        <InfoRow label="Service request" value={context.job.requestRef} />
      </Section>

      <Section title="Complaint">
        <p className="text-sm text-muted-foreground">{context.job.serviceRequest?.description ?? "—"}</p>
      </Section>

      <Section title="Inspection">
        <p className="text-sm">{context.job.serviceRequest?.inspectionReport?.findings ?? "No inspection report on file."}</p>
      </Section>

      <Section title="Estimate">
        <InfoRow label="Total" value={formatCurrency(context.costs.estimateAmount)} />
        <InfoRow label="Discount" value={formatCurrency(context.costs.discount)} />
        <div className="mt-2 space-y-1">
          {(context.job.estimate?.lineItems ?? []).map((line) => (
            <div key={line.id} className="flex justify-between text-xs text-muted-foreground">
              <span>{line.description}</span>
              <span>{formatCurrency(line.lineTotal)}</span>
            </div>
          ))}
        </div>
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

      <Section title="Service timeline">
        <BillingTimeline events={context.job.serviceRequest?.timelineEvents ?? []} />
      </Section>
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
