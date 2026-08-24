import type { ReactNode } from "react";
import { Printer } from "lucide-react";
import { MesmsLogo } from "@/components/shared/MesmsLogo";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/context/SettingsContext";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface DocumentLine {
  id: string;
  description: string;
  type?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxRate?: number;
}

interface ProfessionalDocumentProps {
  kind: "Estimate" | "Invoice" | "Service Report";
  reference: string;
  customerName: string;
  customerAddress?: string;
  customerPhone?: string;
  issueDate: string;
  validOrDueLabel?: string;
  validOrDueDate?: string;
  ticketRef?: string;
  lines?: DocumentLine[];
  discount?: number;
  notes?: string;
  terms?: string;
  hideToolbar?: boolean;
  showSignature?: boolean;
  children?: ReactNode;
  className?: string;
}

export function ProfessionalDocument({
  kind,
  reference,
  customerName,
  customerAddress,
  customerPhone,
  issueDate,
  validOrDueLabel,
  validOrDueDate,
  ticketRef,
  lines = [],
  discount = 0,
  notes,
  terms,
  hideToolbar,
  showSignature,
  children,
  className,
}: ProfessionalDocumentProps) {
  const { settings } = useSettings();
  const subtotal = lines.reduce(
    (sum, line) => sum + line.quantity * line.unitPrice - (line.discount ?? 0),
    0,
  );
  const tax = lines.reduce((sum, line) => {
    const taxable = line.quantity * line.unitPrice - (line.discount ?? 0);
    return sum + taxable * ((line.taxRate ?? 0) / 100);
  }, 0);
  const total = Math.max(0, subtotal - discount) + tax;

  return (
    <section
      className={cn(
        "professional-document bg-white p-6 text-slate-950 sm:p-10",
        className,
      )}
    >
      {!hideToolbar ? (
        <div className="no-print mb-5 flex justify-end">
          <Button type="button" variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
          </Button>
        </div>
      ) : null}

      <header className="flex items-start justify-between gap-6 border-b-2 border-slate-900 pb-5">
        <div className="flex items-center gap-3">
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt="" className="h-14 w-14 object-contain" />
          ) : (
            <MesmsLogo size="lg" />
          )}
          <div>
            <h1 className="text-xl font-bold">{settings?.companyName ?? "MESMS"}</h1>
            {settings?.supportEmail ? <p className="text-sm text-slate-600">{settings.supportEmail}</p> : null}
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold uppercase tracking-wide">{kind}</p>
          <p className="font-mono text-sm">{reference}</p>
        </div>
      </header>

      <div className="grid gap-6 py-6 text-sm sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Bill to</p>
          <p className="font-semibold">{customerName}</p>
          {customerAddress ? <p className="whitespace-pre-line text-slate-600">{customerAddress}</p> : null}
          {customerPhone ? <p className="text-slate-600">{customerPhone}</p> : null}
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 sm:ml-auto sm:text-right">
          <dt className="text-slate-500">Issue date</dt>
          <dd>{formatDate(issueDate)}</dd>
          {validOrDueLabel && validOrDueDate ? (
            <>
              <dt className="text-slate-500">{validOrDueLabel}</dt>
              <dd>{formatDate(validOrDueDate)}</dd>
            </>
          ) : null}
          {ticketRef ? (
            <>
              <dt className="text-slate-500">Ticket</dt>
              <dd className="font-mono">{ticketRef}</dd>
            </>
          ) : null}
        </dl>
      </div>

      {lines.length > 0 ? (
        <>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-y border-slate-300 bg-slate-100 text-left text-[11px] uppercase tracking-wide">
                <th className="p-2.5 font-semibold">Description</th>
                <th className="p-2.5 text-right font-semibold">Qty</th>
                <th className="p-2.5 text-right font-semibold">Price</th>
                <th className="p-2.5 text-right font-semibold">Tax</th>
                <th className="p-2.5 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const net = line.quantity * line.unitPrice - (line.discount ?? 0);
                return (
                  <tr key={line.id} className="border-b border-slate-200">
                    <td className="p-2.5">
                      <p>{line.description}</p>
                      {line.type ? <p className="text-xs capitalize text-slate-500">{line.type}</p> : null}
                    </td>
                    <td className="p-2.5 text-right">{line.quantity}</td>
                    <td className="p-2.5 text-right">{formatCurrency(line.unitPrice)}</td>
                    <td className="p-2.5 text-right">{line.taxRate ? `${line.taxRate}%` : "—"}</td>
                    <td className="p-2.5 text-right">{formatCurrency(net)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <dl className="ml-auto mt-5 grid w-full max-w-xs grid-cols-2 gap-y-1.5 text-sm">
            <dt className="text-slate-500">Subtotal</dt>
            <dd className="text-right">{formatCurrency(subtotal)}</dd>
            {discount > 0 ? (
              <>
                <dt className="text-slate-500">Discount</dt>
                <dd className="text-right">-{formatCurrency(discount)}</dd>
              </>
            ) : null}
            <dt className="text-slate-500">Tax</dt>
            <dd className="text-right">{formatCurrency(tax)}</dd>
            <dt className="border-t border-slate-400 pt-2 text-base font-bold">Total</dt>
            <dd className="border-t border-slate-400 pt-2 text-right text-base font-bold">{formatCurrency(total)}</dd>
          </dl>
        </>
      ) : null}

      {children}

      {notes ? (
        <div className="mt-8 border-t border-slate-200 pt-4 text-sm">
          <p className="font-semibold">Notes</p>
          <p className="mt-1 whitespace-pre-line text-slate-600">{notes}</p>
        </div>
      ) : null}
      {terms ? (
        <div className="mt-4 text-sm">
          <p className="font-semibold">Terms & Conditions</p>
          <p className="mt-1 whitespace-pre-line text-slate-600">{terms}</p>
        </div>
      ) : null}

      {showSignature ? (
        <div className="mt-12 grid grid-cols-2 gap-10 text-sm">
          <div>
            <div className="h-12 border-b border-slate-400" />
            <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">Authorized signature</p>
          </div>
          <div>
            <div className="h-12 border-b border-slate-400" />
            <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">Customer acknowledgement</p>
          </div>
        </div>
      ) : null}

      <footer className="mt-10 border-t border-slate-200 pt-3 text-xs text-slate-500">
        {settings?.companyName ?? "MESMS"} · {kind} {reference}
      </footer>
    </section>
  );
}
