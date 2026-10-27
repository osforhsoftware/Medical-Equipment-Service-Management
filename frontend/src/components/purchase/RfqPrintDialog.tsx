import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Printer } from "lucide-react";
import { ShareButtons } from "@/components/shared/ShareButtons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSettings } from "@/context/SettingsContext";
import { formatCurrency, formatDate } from "@/lib/format";

export interface RfqPrintLine {
  description: string;
  quantity: number;
  unitCostEstimate?: number;
  moq?: number | "";
  deliveryDays?: number | "";
}

export interface RfqPrintData {
  reference: string;
  supplierName: string;
  status: string;
  notes?: string | null;
  dueDate?: string | null;
  currency?: string | null;
  warranty?: string | null;
  incoterm?: string | null;
  shippingTerms?: string | null;
  paymentTerms?: string | null;
  countryOfOrigin?: string | null;
  validUntil?: string | null;
  lines: RfqPrintLine[];
  createdAt: string;
}

function estimateTotal(rfq: RfqPrintData) {
  return (rfq.lines || []).reduce(
    (acc, line) => acc + line.quantity * (Number(line.unitCostEstimate) || 0),
    0,
  );
}

export function buildRfqShareMessage(rfq: RfqPrintData) {
  const currency = rfq.currency || "INR";
  const total = estimateTotal(rfq);
  const lineSummary = (rfq.lines || [])
    .map((line, index) => {
      const label = line.description?.trim() || `Item #${index + 1}`;
      const unit = Number(line.unitCostEstimate) || 0;
      return `${index + 1}. ${label} — ${line.quantity} × ${formatCurrency(unit)}`;
    })
    .join("\n");

  return [
    `Request for Quotation ${rfq.reference}`,
    `Supplier: ${rfq.supplierName}`,
    `Estimated total: ${formatCurrency(total)} (${currency})`,
    rfq.dueDate ? `Response due: ${formatDate(rfq.dueDate)}` : null,
    rfq.validUntil ? `Quote validity requested until: ${formatDate(rfq.validUntil)}` : null,
    rfq.incoterm ? `Incoterm: ${rfq.incoterm}` : null,
    rfq.paymentTerms ? `Payment: ${rfq.paymentTerms}` : null,
    rfq.warranty ? `Warranty: ${rfq.warranty}` : null,
    "",
    lineSummary || null,
    "",
    "Please find the RFQ PDF attached (use Print / PDF from MESMS).",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

interface RfqDocumentProps {
  rfq: RfqPrintData;
  supplierEmail?: string | null;
  supplierPhone?: string | null;
  supplierAddress?: string | null;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
}

function RfqDocument({
  rfq,
  supplierEmail,
  supplierPhone,
  supplierAddress,
  companyName,
  companyAddress,
  companyPhone,
  companyEmail,
}: RfqDocumentProps) {
  const currency = rfq.currency || "INR";
  const total = estimateTotal(rfq);

  return (
    <div className="mx-auto w-full max-w-[210mm] space-y-5 bg-white text-slate-900">
      <div className="flex justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{companyName}</h1>
          {companyAddress ? <p className="mt-1 text-xs text-slate-500">{companyAddress}</p> : null}
          <p className="text-xs text-slate-500">
            {[companyPhone && `Tel: ${companyPhone}`, companyEmail && `Email: ${companyEmail}`]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Request for quotation
          </p>
          <p className="font-mono font-medium">{rfq.reference}</p>
          <p className="text-xs capitalize text-slate-500">Status: {rfq.status}</p>
          <p className="text-xs text-slate-500">Created {formatDate(rfq.createdAt)}</p>
        </div>
      </div>

      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">To supplier</p>
          <p className="font-medium">{rfq.supplierName}</p>
          {supplierAddress ? <p className="text-xs text-slate-500">{supplierAddress}</p> : null}
          {supplierEmail ? <p className="text-xs text-slate-500">{supplierEmail}</p> : null}
          {supplierPhone ? <p className="text-xs text-slate-500">{supplierPhone}</p> : null}
        </div>
        <div className="sm:text-right">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Estimated total
          </p>
          <p className="text-lg font-bold tabular-nums">
            {formatCurrency(total)} <span className="text-sm font-medium text-slate-500">({currency})</span>
          </p>
          {rfq.dueDate ? (
            <p className="text-xs text-slate-500">Response due {formatDate(rfq.dueDate)}</p>
          ) : null}
          {rfq.validUntil ? (
            <p className="text-xs text-slate-500">Quote validity until {formatDate(rfq.validUntil)}</p>
          ) : null}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Please quote for
        </p>
        <div className="grid gap-2 text-xs sm:grid-cols-2">
          {rfq.incoterm ? (
            <span>
              <span className="text-slate-500">Incoterm:</span> {rfq.incoterm}
            </span>
          ) : null}
          {rfq.shippingTerms ? (
            <span>
              <span className="text-slate-500">Shipping:</span> {rfq.shippingTerms}
            </span>
          ) : null}
          {rfq.paymentTerms ? (
            <span>
              <span className="text-slate-500">Payment:</span> {rfq.paymentTerms}
            </span>
          ) : null}
          {rfq.warranty ? (
            <span>
              <span className="text-slate-500">Warranty:</span> {rfq.warranty}
            </span>
          ) : null}
          {rfq.countryOfOrigin ? (
            <span>
              <span className="text-slate-500">Origin:</span> {rfq.countryOfOrigin}
            </span>
          ) : null}
          {rfq.currency ? (
            <span>
              <span className="text-slate-500">Currency:</span> {rfq.currency}
            </span>
          ) : null}
        </div>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
            <th className="py-2 pr-2 font-semibold">Item</th>
            <th className="py-2 px-2 font-semibold text-right">Qty</th>
            <th className="py-2 px-2 font-semibold text-right">Est. unit</th>
            <th className="py-2 px-2 font-semibold text-right">MOQ</th>
            <th className="py-2 pl-2 font-semibold text-right">Lead</th>
          </tr>
        </thead>
        <tbody>
          {(rfq.lines || []).map((line, index) => {
            const label = line.description?.trim() || `Item #${index + 1}`;
            const unit = Number(line.unitCostEstimate) || 0;
            return (
              <tr key={`${rfq.reference}-${index}`} className="border-b border-slate-100">
                <td className="py-2 pr-2">
                  <p className="font-medium">{label}</p>
                </td>
                <td className="py-2 px-2 text-right tabular-nums">{line.quantity}</td>
                <td className="py-2 px-2 text-right font-mono tabular-nums">
                  {unit ? formatCurrency(unit) : "—"}
                </td>
                <td className="py-2 px-2 text-right tabular-nums">
                  {line.moq !== "" && line.moq != null ? line.moq : "—"}
                </td>
                <td className="py-2 pl-2 text-right tabular-nums">
                  {line.deliveryDays !== "" && line.deliveryDays != null
                    ? `${line.deliveryDays}d`
                    : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {rfq.notes ? (
        <p className="text-xs text-slate-600">
          <span className="font-semibold text-slate-500">Notes / specifications:</span> {rfq.notes}
        </p>
      ) : null}

      <p className="border-t border-slate-200 pt-3 text-center text-[11px] text-slate-400">
        Generated by {companyName} · RFQ {rfq.reference}
      </p>
    </div>
  );
}

interface RfqPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rfq: RfqPrintData | null;
  supplierEmail?: string | null;
  supplierPhone?: string | null;
  supplierAddress?: string | null;
}

export function RfqPrintDialog({
  open,
  onOpenChange,
  rfq,
  supplierEmail,
  supplierPhone,
  supplierAddress,
}: RfqPrintDialogProps) {
  const { settings } = useSettings();
  const companyName = settings?.companyName || "MESMS";
  const companyAddress = settings?.companyAddress || "";
  const companyPhone = settings?.companyPhone || "";
  const companyEmail = settings?.supportEmail || "";

  useEffect(() => {
    if (!open) return;
    const clear = () => document.body.classList.remove("print-rfq");
    window.addEventListener("afterprint", clear);
    return () => {
      window.removeEventListener("afterprint", clear);
      clear();
    };
  }, [open]);

  if (!rfq) return null;

  const subject = `RFQ ${rfq.reference} — ${rfq.supplierName}`;
  const message = buildRfqShareMessage(rfq);
  const documentProps: RfqDocumentProps = {
    rfq,
    supplierEmail,
    supplierPhone,
    supplierAddress,
    companyName,
    companyAddress,
    companyPhone,
    companyEmail,
  };

  const handlePrint = () => {
    document.body.classList.add("print-rfq");
    window.print();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[92vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="no-print flex flex-row flex-wrap items-start justify-between gap-3 border-b bg-muted/30 p-4 pb-3 sm:p-6">
            <div className="space-y-1 pr-8">
              <DialogTitle>RFQ — print &amp; share</DialogTitle>
              <DialogDescription>
                Print or save as PDF, then send to the supplier via Gmail or WhatsApp.
              </DialogDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
                <Printer className="h-4 w-4" />
                Print / PDF
              </Button>
              <ShareButtons
                subject={subject}
                message={message}
                email={supplierEmail}
                phone={supplierPhone}
              />
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 sm:p-8">
            <RfqDocument {...documentProps} />
          </div>
        </DialogContent>
      </Dialog>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="rfq-print-root print-area" aria-hidden>
              <RfqDocument {...documentProps} />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
