import type { ReactNode } from "react";
import { Printer } from "lucide-react";
import { MesmsLogo } from "@/components/shared/MesmsLogo";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/context/SettingsContext";
import { formatCurrency } from "@/lib/format";

export interface DocumentLine {
  id: string;
  description: string;
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
  issueDate: string;
  validOrDueLabel?: string;
  validOrDueDate?: string;
  lines?: DocumentLine[];
  notes?: string;
  children?: ReactNode;
}

export function ProfessionalDocument({
  kind,
  reference,
  customerName,
  customerAddress,
  issueDate,
  validOrDueLabel,
  validOrDueDate,
  lines = [],
  notes,
  children,
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

  return (
    <section className="professional-document bg-white p-6 text-slate-950 sm:p-8">
      <div className="no-print mb-5 flex justify-end">
        <Button type="button" variant="outline" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
        </Button>
      </div>

      <header className="flex items-start justify-between gap-6 border-b-2 border-slate-900 pb-5">
        <div className="flex items-center gap-3">
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt="" className="h-14 w-14 object-contain" />
          ) : (
            <MesmsLogo size="lg" />
          )}
          <div>
            <h1 className="text-xl font-bold">{settings?.companyName ?? "MESMS"}</h1>
            <p className="text-sm text-slate-600">{settings?.supportEmail}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold uppercase tracking-wide">{kind}</p>
          <p className="font-mono text-sm">{reference}</p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-6 py-6 text-sm">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Bill to</p>
          <p className="font-semibold">{customerName}</p>
          {customerAddress ? <p className="whitespace-pre-line text-slate-600">{customerAddress}</p> : null}
        </div>
        <dl className="ml-auto grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-right">
          <dt className="text-slate-500">Issue date</dt>
          <dd>{new Date(issueDate).toLocaleDateString()}</dd>
          {validOrDueLabel && validOrDueDate ? (
            <>
              <dt className="text-slate-500">{validOrDueLabel}</dt>
              <dd>{new Date(validOrDueDate).toLocaleDateString()}</dd>
            </>
          ) : null}
        </dl>
      </div>

      {lines.length > 0 ? (
        <>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-y border-slate-300 bg-slate-100 text-left">
                <th className="p-2">Description</th>
                <th className="p-2 text-right">Qty</th>
                <th className="p-2 text-right">Unit price</th>
                <th className="p-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} className="border-b border-slate-200">
                  <td className="p-2">{line.description}</td>
                  <td className="p-2 text-right">{line.quantity}</td>
                  <td className="p-2 text-right">{formatCurrency(line.unitPrice)}</td>
                  <td className="p-2 text-right">
                    {formatCurrency(line.quantity * line.unitPrice - (line.discount ?? 0))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="ml-auto mt-4 grid w-64 grid-cols-2 gap-2 text-sm">
            <dt className="text-slate-500">Subtotal</dt>
            <dd className="text-right">{formatCurrency(subtotal)}</dd>
            <dt className="text-slate-500">Tax</dt>
            <dd className="text-right">{formatCurrency(tax)}</dd>
            <dt className="border-t border-slate-400 pt-2 text-base font-bold">Total</dt>
            <dd className="border-t border-slate-400 pt-2 text-right text-base font-bold">
              {formatCurrency(subtotal + tax)}
            </dd>
          </dl>
        </>
      ) : null}

      {children}
      {notes ? (
        <div className="mt-6 border-t border-slate-200 pt-4 text-sm">
          <p className="font-semibold">Notes & terms</p>
          <p className="whitespace-pre-line text-slate-600">{notes}</p>
        </div>
      ) : null}
    </section>
  );
}
