import { useEffect, type ReactNode } from "react";
import { Printer } from "lucide-react";
import { MesmsLogo } from "@/components/shared/MesmsLogo";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/context/SettingsContext";
import { groupDocumentLines } from "@/lib/billingCharges";
import { formatDate, formatDocumentCurrency } from "@/lib/format";
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
  equipmentName?: string;
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

function lineNet(line: DocumentLine) {
  return Math.max(0, line.quantity * line.unitPrice - (line.discount ?? 0));
}

function termParagraphs(terms: string) {
  return terms
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function ProfessionalDocument({
  kind,
  reference,
  customerName,
  customerAddress,
  customerPhone,
  equipmentName,
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
  const company = settings?.companyName ?? "MESMS";
  const subtotal = lines.reduce((sum, line) => sum + lineNet(line), 0);
  const tax = lines.reduce((sum, line) => sum + lineNet(line) * ((line.taxRate ?? 0) / 100), 0);
  const total = Math.max(0, subtotal - discount) + tax;
  const termParts = terms ? termParagraphs(terms) : [];

  useEffect(() => {
    const previousTitle = document.title;
    const printTitle = `${kind} ${reference} · ${company}`;
    const onBeforePrint = () => {
      document.title = printTitle;
    };
    const onAfterPrint = () => {
      document.title = previousTitle;
    };
    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
      document.title = previousTitle;
    };
  }, [company, kind, reference]);

  return (
    <section className={cn("professional-document bg-white text-slate-900", className)}>
      {!hideToolbar ? (
        <div className="no-print mb-5 flex justify-end">
          <Button type="button" variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
          </Button>
        </div>
      ) : null}

      <div className="doc-sheet">
        <header className="doc-header">
          <div className="doc-brand">
            <div className="doc-logo">
              {settings?.logoUrl ? (
                <img src={settings.logoUrl} alt="" />
              ) : (
                <MesmsLogo size="lg" className="h-10 max-w-[8.5rem]" />
              )}
            </div>
            <div className="doc-company">
              <p className="doc-company-name">{company}</p>
              {settings?.supportEmail ? (
                <p className="doc-company-email">{settings.supportEmail}</p>
              ) : null}
            </div>
          </div>
          <div className="doc-title-block">
            <p className="doc-kind">{kind}</p>
            <p className="doc-reference">{reference}</p>
          </div>
        </header>

        <div className="doc-meta">
          <div className="doc-bill-to">
            <p className="doc-label">Bill to</p>
            <p className="doc-customer">{customerName}</p>
            {customerAddress ? <p className="doc-muted whitespace-pre-line">{customerAddress}</p> : null}
            {customerPhone ? <p className="doc-muted">{customerPhone}</p> : null}
            {equipmentName ? <p className="doc-equipment">Equipment: {equipmentName}</p> : null}
          </div>
          <dl className="doc-dates">
            <div>
              <dt>Issue Date</dt>
              <dd>{formatDate(issueDate)}</dd>
            </div>
            {validOrDueLabel && validOrDueDate ? (
              <div>
                <dt>{validOrDueLabel}</dt>
                <dd>{formatDate(validOrDueDate)}</dd>
              </div>
            ) : null}
            {ticketRef ? (
              <div>
                <dt>Reference</dt>
                <dd className="doc-ref-value">{ticketRef}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        {lines.length > 0 ? (
          <>
            <table className="billing-doc-table doc-table">
              <colgroup>
                <col className="col-num" />
                <col className="col-desc" />
                <col className="col-qty" />
                <col className="col-rate" />
                <col className="col-tax" />
                <col className="col-amt" />
              </colgroup>
              <thead>
                <tr>
                  <th className="cell-num">#</th>
                  <th className="cell-desc">Description</th>
                  <th className="cell-qty">Qty</th>
                  <th className="cell-rate">Rate</th>
                  <th className="cell-tax">Tax</th>
                  <th className="cell-amt">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const grouped = groupDocumentLines(lines);
                  const rows = grouped.length ? grouped : [{ key: "all", label: "", lines }];
                  let n = 0;
                  return rows.flatMap((group) => [
                    group.label ? (
                      <tr key={`g-${group.key}`} className="doc-group-row">
                        <td colSpan={6} className="cell-desc font-semibold uppercase tracking-wide text-xs text-slate-500">
                          {group.label}
                        </td>
                      </tr>
                    ) : null,
                    ...group.lines.map((line) => {
                      n += 1;
                      const net = lineNet(line);
                      return (
                        <tr key={line.id}>
                          <td className="cell-num">{n}</td>
                          <td className="cell-desc">
                            <p className="doc-line-name">{line.description}</p>
                            {(line.discount ?? 0) > 0 ? (
                              <p className="doc-line-sub">Discount {formatDocumentCurrency(line.discount ?? 0)}</p>
                            ) : null}
                          </td>
                          <td className="cell-qty">{line.quantity}</td>
                          <td className="cell-rate">{formatDocumentCurrency(line.unitPrice)}</td>
                          <td className="cell-tax">{`${line.taxRate ?? 0}%`}</td>
                          <td className="cell-amt">{formatDocumentCurrency(net)}</td>
                        </tr>
                      );
                    }),
                  ]);
                })()}
              </tbody>
            </table>

            <div className="doc-totals-wrap">
              <dl className="doc-totals">
                <div>
                  <dt>Subtotal</dt>
                  <dd>{formatDocumentCurrency(subtotal)}</dd>
                </div>
                {discount > 0 ? (
                  <div>
                    <dt>Discount</dt>
                    <dd>-{formatDocumentCurrency(discount)}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>Tax</dt>
                  <dd>{formatDocumentCurrency(tax)}</dd>
                </div>
                <div className="doc-total-row">
                  <dt>{kind === "Invoice" ? "Final Amount" : "Total"}</dt>
                  <dd>{formatDocumentCurrency(total)}</dd>
                </div>
              </dl>
            </div>
          </>
        ) : null}

        {children}

        {notes ? (
          <div className="doc-notes">
            <p className="doc-section-heading">Notes</p>
            <p className="doc-section-body">{notes}</p>
          </div>
        ) : null}

        {termParts.length > 0 ? (
          <div className="doc-terms">
            <p className="doc-section-heading">Terms &amp; Conditions</p>
            {termParts.length === 1 ? (
              <p className="doc-section-body">{termParts[0]}</p>
            ) : (
              <ul className="doc-terms-list">
                {termParts.map((part, index) => (
                  <li key={`${index}-${part.slice(0, 24)}`}>{part}</li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {showSignature ? (
          <div className="doc-signatures">
            <div className="doc-sign">
              <p className="doc-label">Authorized Signature</p>
              <div className="doc-sign-line" />
              <p className="doc-sign-caption">{company}</p>
            </div>
            <div className="doc-sign">
              <p className="doc-label">Customer Acknowledgement</p>
              <div className="doc-sign-line" />
              <p className="doc-sign-caption">Customer Signature</p>
            </div>
          </div>
        ) : null}

        <footer className="doc-footer">
          <span>
            {company} · {kind} {reference}
          </span>
          <span className="doc-page">Page 1 of 1</span>
        </footer>
      </div>
    </section>
  );
}
