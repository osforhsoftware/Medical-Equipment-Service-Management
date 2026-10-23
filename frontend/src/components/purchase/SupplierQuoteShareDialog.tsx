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

export interface SupplierQuoteShareLine {
  rfqLineIndex: number;
  description?: string;
  quantity: number;
  unitPrice: number;
  moq?: number;
  deliveryDays?: number;
  notes?: string;
}

export interface SupplierQuoteShareQuote {
  id: string;
  currency?: string | null;
  warranty?: string | null;
  incoterm?: string | null;
  shippingTerms?: string | null;
  paymentTerms?: string | null;
  countryOfOrigin?: string | null;
  validUntil?: string | null;
  notes?: string | null;
  lines: SupplierQuoteShareLine[];
  createdAt: string;
}

export interface SupplierQuoteShareRfq {
  reference: string;
  supplierName: string;
}

function quoteTotal(quote: SupplierQuoteShareQuote) {
  return (quote.lines || []).reduce((acc, line) => acc + line.quantity * line.unitPrice, 0);
}

export function buildSupplierQuoteShareMessage(rfq: SupplierQuoteShareRfq, quote: SupplierQuoteShareQuote) {
  const currency = quote.currency || "INR";
  const total = quoteTotal(quote);
  const lineSummary = (quote.lines || [])
    .map((line, index) => {
      const label = line.description?.trim() || `Item #${line.rfqLineIndex + 1}`;
      return `${index + 1}. ${label} — ${line.quantity} × ${formatCurrency(line.unitPrice)}`;
    })
    .join("\n");

  return [
    `Supplier quote for RFQ ${rfq.reference}`,
    `Supplier: ${rfq.supplierName}`,
    `Total: ${formatCurrency(total)} (${currency})`,
    quote.validUntil ? `Valid until: ${formatDate(quote.validUntil)}` : null,
    quote.incoterm ? `Incoterm: ${quote.incoterm}` : null,
    quote.paymentTerms ? `Payment: ${quote.paymentTerms}` : null,
    quote.warranty ? `Warranty: ${quote.warranty}` : null,
    "",
    lineSummary || null,
    "",
    "Please find the supplier quote PDF attached (use Print / PDF from MESMS).",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

interface QuoteDocumentProps {
  rfq: SupplierQuoteShareRfq;
  quote: SupplierQuoteShareQuote;
  supplierEmail?: string | null;
  supplierPhone?: string | null;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
}

function SupplierQuoteDocument({
  rfq,
  quote,
  supplierEmail,
  supplierPhone,
  companyName,
  companyAddress,
  companyPhone,
  companyEmail,
}: QuoteDocumentProps) {
  const currency = quote.currency || "INR";
  const total = quoteTotal(quote);

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
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Supplier quote</p>
          <p className="font-mono font-medium">{rfq.reference}</p>
          <p className="text-xs text-slate-500">Recorded {formatDate(quote.createdAt)}</p>
        </div>
      </div>

      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Supplier</p>
          <p className="font-medium">{rfq.supplierName}</p>
          {supplierEmail ? <p className="text-xs text-slate-500">{supplierEmail}</p> : null}
          {supplierPhone ? <p className="text-xs text-slate-500">{supplierPhone}</p> : null}
        </div>
        <div className="sm:text-right">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Quote total</p>
          <p className="text-lg font-bold tabular-nums">
            {formatCurrency(total)} <span className="text-sm font-medium text-slate-500">({currency})</span>
          </p>
          {quote.validUntil ? (
            <p className="text-xs text-slate-500">Valid until {formatDate(quote.validUntil)}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-2 text-xs sm:grid-cols-2">
        {quote.incoterm ? (
          <span>
            <span className="text-slate-500">Incoterm:</span> {quote.incoterm}
          </span>
        ) : null}
        {quote.shippingTerms ? (
          <span>
            <span className="text-slate-500">Shipping:</span> {quote.shippingTerms}
          </span>
        ) : null}
        {quote.paymentTerms ? (
          <span>
            <span className="text-slate-500">Payment:</span> {quote.paymentTerms}
          </span>
        ) : null}
        {quote.warranty ? (
          <span>
            <span className="text-slate-500">Warranty:</span> {quote.warranty}
          </span>
        ) : null}
        {quote.countryOfOrigin ? (
          <span>
            <span className="text-slate-500">Origin:</span> {quote.countryOfOrigin}
          </span>
        ) : null}
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
            <th className="py-2 pr-2 font-semibold">Item</th>
            <th className="py-2 px-2 font-semibold text-right">Qty</th>
            <th className="py-2 px-2 font-semibold text-right">Unit</th>
            <th className="py-2 pl-2 font-semibold text-right">Line</th>
          </tr>
        </thead>
        <tbody>
          {(quote.lines || []).map((line, index) => {
            const label = line.description?.trim() || `Item #${line.rfqLineIndex + 1}`;
            const lineTotal = line.quantity * line.unitPrice;
            return (
              <tr key={`${quote.id}-${index}`} className="border-b border-slate-100">
                <td className="py-2 pr-2">
                  <p className="font-medium">{label}</p>
                  <p className="text-xs text-slate-500">
                    {[
                      line.moq != null ? `MOQ ${line.moq}` : null,
                      line.deliveryDays != null ? `Lead ${line.deliveryDays}d` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </td>
                <td className="py-2 px-2 text-right tabular-nums">{line.quantity}</td>
                <td className="py-2 px-2 text-right font-mono tabular-nums">{formatCurrency(line.unitPrice)}</td>
                <td className="py-2 pl-2 text-right font-mono tabular-nums font-medium">
                  {formatCurrency(lineTotal)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {quote.notes ? (
        <p className="text-xs text-slate-600">
          <span className="font-semibold text-slate-500">Notes:</span> {quote.notes}
        </p>
      ) : null}

      <p className="border-t border-slate-200 pt-3 text-center text-[11px] text-slate-400">
        Generated by {companyName} · Supplier quote for {rfq.reference}
      </p>
    </div>
  );
}

interface SupplierQuoteShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rfq: SupplierQuoteShareRfq | null;
  quote: SupplierQuoteShareQuote | null;
  supplierEmail?: string | null;
  supplierPhone?: string | null;
}

export function SupplierQuoteShareDialog({
  open,
  onOpenChange,
  rfq,
  quote,
  supplierEmail,
  supplierPhone,
}: SupplierQuoteShareDialogProps) {
  const { settings } = useSettings();
  const companyName = settings?.companyName || "MESMS";
  const companyAddress = settings?.companyAddress || "";
  const companyPhone = settings?.companyPhone || "";
  const companyEmail = settings?.supportEmail || "";

  useEffect(() => {
    if (!open) return;
    const clear = () => document.body.classList.remove("print-supplier-quote");
    window.addEventListener("afterprint", clear);
    return () => {
      window.removeEventListener("afterprint", clear);
      clear();
    };
  }, [open]);

  if (!rfq || !quote) return null;

  const subject = `Supplier quote for ${rfq.reference} — ${rfq.supplierName}`;
  const message = buildSupplierQuoteShareMessage(rfq, quote);
  const documentProps: QuoteDocumentProps = {
    rfq,
    quote,
    supplierEmail,
    supplierPhone,
    companyName,
    companyAddress,
    companyPhone,
    companyEmail,
  };

  const handlePrint = () => {
    document.body.classList.add("print-supplier-quote");
    window.print();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[92vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="no-print flex flex-row flex-wrap items-start justify-between gap-3 border-b bg-muted/30 p-4 pb-3 sm:p-6">
            <div className="space-y-1 pr-8">
              <DialogTitle>Supplier quote — print &amp; share</DialogTitle>
              <DialogDescription>
                Print or save as PDF, then send via Gmail or WhatsApp without leaving this quote.
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
            <SupplierQuoteDocument {...documentProps} />
          </div>
        </DialogContent>
      </Dialog>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="supplier-quote-print-root print-area" aria-hidden>
              <SupplierQuoteDocument {...documentProps} />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
