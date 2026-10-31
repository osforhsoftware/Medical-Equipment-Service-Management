import { useEffect, type ReactNode } from "react";
import { MesmsLogo } from "@/components/shared/MesmsLogo";
import { splitInspectionFindings } from "@/components/inspections/useInspectionReportEditor";
import { useSettings } from "@/context/SettingsContext";
import {
  api,
  type BackendCustomer,
  type BackendEquipment,
  type BackendInspectionRecommendation,
  type BackendInspectionReport,
  type BackendServiceRequest,
} from "@/lib/api";
import {
  ADMIN_SIGNATURE_LABEL,
  INSPECTOR_SIGNATURE_LABEL,
  INSPECTION_SIGNATURE_LABELS,
  getSignatureFieldValue,
} from "@/components/inspections/InspectionSignaturePanel";
import { formatErrorCodes, formatJsonField } from "@/lib/inspectionReport";
import { parseCustomerAdditionalFields } from "@/lib/customerFields";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

interface InspectionReportDocumentProps {
  request: BackendServiceRequest;
  report: BackendInspectionReport;
  customer?: BackendCustomer | null;
  equipment?: BackendEquipment[];
  className?: string;
}

function presentText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.toLowerCase() === "nil") return null;
  if (text === "—" || text === "–" || text === "-" || text === "---") return null;
  return text;
}

function chipLabel(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatQty(value: string | number) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return presentText(value) ?? "";
  return Number.isInteger(amount) ? String(amount) : String(amount);
}

function sparePartName(item: BackendInspectionRecommendation): string | null {
  return presentText(item.inventoryItem?.name) ?? presentText(item.catalogItem?.name) ?? presentText(
    presentText(item.description)?.replace(/^recommended (spare part|service):\s*/i, ""),
  );
}

function partNote(item: BackendInspectionRecommendation): string | null {
  const description = presentText(item.description);
  if (!description) return null;
  const spare = sparePartName(item);
  if (spare && description.toLowerCase() === spare.toLowerCase()) return null;
  return description;
}

function FieldGrid({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  const visible = items.filter((item) => {
    if (typeof item.value === "string") return presentText(item.value) !== null;
    return item.value !== null && item.value !== undefined && item.value !== false;
  });
  if (!visible.length) return null;
  return (
    <dl className="doc-info-grid">
      {visible.map((item, index) => (
        <div key={`${item.label}-${index}`} className="doc-info-item">
          <dt className="doc-field-label">{item.label}</dt>
          <dd className="doc-field-value">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="doc-inspection-section">
      <h2 className="doc-section-heading">{title}</h2>
      <div className="doc-section-body-wrap">{children}</div>
    </section>
  );
}

function FieldsSection({ title, items }: { title: string; items: Array<{ label: string; value: ReactNode }> }) {
  const grid = <FieldGrid items={items} />;
  if (!grid) return null;
  return <Section title={title}>{grid}</Section>;
}

function NarrativeSection({ title, text }: { title: string; text: string | null }) {
  return (
    <Section title={title}>
      {text ? (
        <p className="doc-text-block whitespace-pre-wrap">{text}</p>
      ) : (
        <p className="doc-empty-line">No findings recorded</p>
      )}
    </Section>
  );
}

function captionWithoutDateTime(value: string | null | undefined) {
  const text = presentText(value);
  if (!text) return "";
  const stripped = text
    .replace(
      /\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}(?:[tT\s,]+(?:at\s+)?\d{1,2}[:.]\d{2}(?:[:.]\d{2})?(?:\s*[ap]m)?)?/gi,
      " ",
    )
    .replace(
      /\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}(?:[\s,]+(?:at\s+)?\d{1,2}[:.]\d{2}(?:[:.]\d{2})?(?:\s*[ap]m)?)?/gi,
      " ",
    )
    .replace(
      /\b\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?,?\s+\d{2,4}(?:[\s,]+(?:at\s+)?\d{1,2}[:.]\d{2}(?:[:.]\d{2})?(?:\s*[ap]m)?)?/gi,
      " ",
    )
    .replace(
      /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+\d{2,4}(?:[\s,]+(?:at\s+)?\d{1,2}[:.]\d{2}(?:[:.]\d{2})?(?:\s*[ap]m)?)?/gi,
      " ",
    )
    .replace(/\b\d{1,2}[:.]\d{2}(?:[:.]\d{2})?\s*[ap]m\b/gi, " ")
    .replace(/\b(?:img|image|photo|pic|screenshot)[_\-\s]*\d{6,14}\b/gi, " ")
    .replace(/\.(?:jpe?g|png|webp|gif|heic)$/i, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s,.;:_-]+|[\s,.;:_-]+$/g, "")
    .trim();
  if (!stripped || /^(?:whatsapp image|img|image|photo|pic|screenshot|camera)$/i.test(stripped)) return "";
  return stripped;
}

function ReportPhoto({
  src,
  alt,
  caption,
  href,
}: {
  src: string;
  alt: string;
  caption?: string | null;
  href: string;
}) {
  const comment = captionWithoutDateTime(caption);
  return (
    <figure className="doc-photo-cell">
      <a href={href} target="_blank" rel="noreferrer" className="doc-photo-frame" title={alt}>
        <img src={src} alt={alt} className="doc-photo-thumb" loading="lazy" />
      </a>
      {comment ? (
        <>
          <figcaption className="doc-photo-caption-label">Comment</figcaption>
          <p className="doc-photo-caption">{comment}</p>
        </>
      ) : null}
    </figure>
  );
}

function equipmentFields(request: BackendServiceRequest, equipment: BackendEquipment[]) {
  const rows: Array<{ label: string; value: string }> = [];
  const push = (label: string, value: unknown) => {
    const text = presentText(value);
    if (text) rows.push({ label, value: text });
  };

  if (equipment.length) {
    for (const item of equipment) {
      push("Description", item.name);
      push("Manufacturer", item.manufacturer);
      push("Model", item.model);
      push("Serial Number", item.serialNumber);
    }
    return rows;
  }

  if (request.equipmentItems?.length) {
    for (const item of request.equipmentItems) {
      push("Description", item.equipmentName);
    }
    return rows;
  }

  push("Description", request.equipmentName);
  return rows;
}

function ReportRow({ children }: { children: ReactNode }) {
  return (
    <tr className="doc-keep">
      <td>{children}</td>
    </tr>
  );
}

export function InspectionReportDocument({
  request,
  report,
  customer,
  equipment = [],
  className,
}: InspectionReportDocumentProps) {
  const { settings } = useSettings();
  const company = settings?.companyName ?? "MESMS";
  const split = splitInspectionFindings(report.findings ?? "");
  const siteAddress = [customer?.address, customer?.city, customer?.country].filter(Boolean).join(", ");
  const checklistFields = formatJsonField(report.checklist).flatMap((field) => {
    const value = presentText(field.value);
    return value ? [{ label: field.label, value }] : [];
  });
  const measurementFields = formatJsonField(report.measurements).flatMap((field) => {
    const value = presentText(field.value);
    return value ? [{ label: field.label, value }] : [];
  });
  const errorCodes = formatErrorCodes(report.errorCodes).map((code) => presentText(code)).filter((code): code is string => Boolean(code));
  const additionalFields = parseCustomerAdditionalFields(report.additionalFields);
  const visibleAdditional = additionalFields.flatMap((field) => {
    if (INSPECTION_SIGNATURE_LABELS.has(field.label)) return [];
    const value = presentText(field.value);
    if (!value || value.startsWith("data:image")) return [];
    return [{ label: field.label, value }];
  });
  const inspectorSignature = getSignatureFieldValue(additionalFields, INSPECTOR_SIGNATURE_LABEL);
  const adminSignature = getSignatureFieldValue(additionalFields, ADMIN_SIGNATURE_LABEL);
  const hasSignatures = Boolean(inspectorSignature || adminSignature);
  const inspectorName = presentText(report.reportedBy);
  const visibleInspector = inspectorName && !/^system\s+administrator$/i.test(inspectorName) ? inspectorName : null;
  const inspectionDate = presentText(formatDate(report.reportedAt));
  const findings = presentText(split.findings);
  const workDetails = presentText(split.workDetails);
  const recommendation = presentText(report.recommendation);
  const orgLines = [
    presentText(settings?.companyAddress),
    presentText(settings?.companyPhone),
    presentText(settings?.supportEmail),
    presentText(settings?.companyWebsite),
  ].filter((line): line is string => Boolean(line));
  const partRows = report.recommendations ?? [];
  const partNotes = partRows.flatMap((item) => {
    const note = partNote(item);
    return note ? [{ id: item.id, note }] : [];
  });
  const calibration = presentText(report.calibrationStatus);
  const remarks = presentText(report.technicianRemarks);

  useEffect(() => {
    const previousTitle = document.title;
    const printTitle = `Inspection Report ${request.reference} · ${company}`;
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
  }, [company, request.reference]);

  return (
    <section className={cn("professional-document inspection-report-document bg-white text-slate-900", className)}>
      <div className="doc-sheet inspection-doc-sheet">
        <table className="inspection-print-frame">
          <thead>
            <tr>
              <td>
                <header className="doc-header">
                  <div className="doc-brand">
                    <div className="doc-logo flex items-center">
                      <MesmsLogo size="md" variant="icon" customLogoUrl={settings?.logoUrl} />
                    </div>
                    <div className="doc-company">
                      <p className="doc-company-name">{company}</p>
                      {orgLines.map((line, index) => (
                        <p key={`${line}-${index}`} className="doc-company-line">{line}</p>
                      ))}
                    </div>
                  </div>
                  <div className="doc-title-block">
                    <p className="doc-kind">Inspection Report</p>
                    <dl className="doc-invoice-meta">
                      <div>
                        <dt>Report No</dt>
                        <dd>{request.reference}</dd>
                      </div>
                      {inspectionDate ? (
                        <div>
                          <dt>Inspection Date</dt>
                          <dd>{inspectionDate}</dd>
                        </div>
                      ) : null}
                    </dl>
                  </div>
                </header>
              </td>
            </tr>
          </thead>
          <tbody>
            {visibleInspector ? (
              <ReportRow>
                <div className="doc-report-summary">
                  <dl className="doc-report-summary-meta">
                    <div>
                      <dt>Inspector</dt>
                      <dd>{visibleInspector}</dd>
                    </div>
                  </dl>
                </div>
              </ReportRow>
            ) : null}
            <ReportRow>
              <FieldsSection
                title="Client Details"
                items={[
                  { label: "Name", value: presentText(customer?.name) ?? presentText(request.customerName) ?? "" },
                  { label: "Phone", value: presentText(customer?.phone) ?? "" },
                  { label: "Email", value: presentText(customer?.email) ?? "" },
                  { label: "Site address", value: presentText(siteAddress) ?? "" },
                ]}
              />
            </ReportRow>
            <ReportRow>
              <FieldsSection
                title="Equipment"
                items={equipmentFields(request, equipment)}
              />
            </ReportRow>
            <ReportRow>
              <NarrativeSection title="Inspection Findings" text={findings} />
            </ReportRow>
            {workDetails ? (
              <ReportRow>
                <Section title="Work Required">
                  <p className="doc-text-block whitespace-pre-wrap">{workDetails}</p>
                </Section>
              </ReportRow>
            ) : null}
            <ReportRow>
              <NarrativeSection title="Recommendations" text={recommendation} />
            </ReportRow>
            {partRows.length ? (
              <ReportRow>
                <Section title="Requested Parts & Services">
                  <table className="doc-parts-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Quantity</th>
                        <th>Priority</th>
                        <th>Recommended spare part</th>
                      </tr>
                    </thead>
                    <tbody>
                      {partRows.map((item) => (
                        <tr key={item.id}>
                          <td>{presentText(item.title) ?? sparePartName(item) ?? ""}</td>
                          <td>{formatQty(item.quantity)}</td>
                          <td>{presentText(item.priority) ? chipLabel(item.priority) : ""}</td>
                          <td>{sparePartName(item) ?? ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {partNotes.length ? (
                    <div className="doc-parts-notes">
                      {partNotes.map((entry) => (
                        <p key={entry.id} className="doc-parts-note">{entry.note}</p>
                      ))}
                    </div>
                  ) : null}
                </Section>
              </ReportRow>
            ) : null}
            {checklistFields.length ? (
              <ReportRow>
                <FieldsSection title="Checklist" items={checklistFields} />
              </ReportRow>
            ) : null}
            {measurementFields.length ? (
              <ReportRow>
                <FieldsSection title="Measurements" items={measurementFields} />
              </ReportRow>
            ) : null}
            {errorCodes.length ? (
              <ReportRow>
                <Section title="Error Codes">
                  <ul className="doc-error-codes">
                    {errorCodes.map((code) => (
                      <li key={code}>{code}</li>
                    ))}
                  </ul>
                </Section>
              </ReportRow>
            ) : null}
            {calibration ? (
              <ReportRow>
                <Section title="Calibration">
                  <p className="doc-text-block">{calibration}</p>
                </Section>
              </ReportRow>
            ) : null}
            {visibleAdditional.length ? (
              <ReportRow>
                <FieldsSection title="Additional Fields" items={visibleAdditional} />
              </ReportRow>
            ) : null}
            {report.attachments?.length ? (
              <ReportRow>
                <Section title="Inspection Photos">
                  <div className="doc-photo-grid">
                    {report.attachments.map((att) => (
                      <ReportPhoto
                        key={att.id}
                        src={api.fileDownloadUrl(att.fileId)}
                        alt={att.file?.originalName ?? att.caption ?? "Inspection image"}
                        caption={att.caption}
                        href={api.fileDownloadUrl(att.fileId)}
                      />
                    ))}
                  </div>
                </Section>
              </ReportRow>
            ) : null}
            {remarks ? (
              <ReportRow>
                <Section title="Remarks">
                  <p className="doc-text-block whitespace-pre-wrap">{remarks}</p>
                </Section>
              </ReportRow>
            ) : null}
            {hasSignatures ? (
              <ReportRow>
                <div className="doc-signatures">
                  <div className="doc-sign">
                    <div className="doc-sign-space">
                      {inspectorSignature ? (
                        <img
                          src={inspectorSignature}
                          alt="Inspector signature"
                          className="doc-sign-image"
                        />
                      ) : null}
                    </div>
                    <div className="doc-sign-line" />
                    <p className="doc-sign-role">Inspector Signature</p>
                    {visibleInspector ? <p className="doc-sign-name">{visibleInspector}</p> : null}
                  </div>
                  <div className="doc-sign">
                    <div className="doc-sign-space">
                      {adminSignature ? (
                        <img
                          src={adminSignature}
                          alt="Admin signature"
                          className="doc-sign-image"
                        />
                      ) : null}
                    </div>
                    <div className="doc-sign-line" />
                    <p className="doc-sign-role">Admin Signature</p>
                    <p className="doc-sign-name">Admin / Coordinator</p>
                  </div>
                </div>
              </ReportRow>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
