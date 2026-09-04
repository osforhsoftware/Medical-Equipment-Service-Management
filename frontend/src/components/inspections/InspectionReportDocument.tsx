import { useEffect } from "react";
import { MesmsLogo } from "@/components/shared/MesmsLogo";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { splitInspectionFindings } from "@/components/inspections/useInspectionReportEditor";
import { useSettings } from "@/context/SettingsContext";
import {
  api,
  type BackendCustomer,
  type BackendEquipment,
  type BackendInspectionReport,
  type BackendServiceRequest,
} from "@/lib/api";
import { displayOrFallback, formatErrorCodes, formatJsonField } from "@/lib/inspectionReport";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

interface InspectionReportDocumentProps {
  request: BackendServiceRequest;
  report: BackendInspectionReport;
  customer?: BackendCustomer | null;
  equipment?: BackendEquipment[];
  className?: string;
}

function InfoGrid({ items }: { items: Array<{ label: string; value: React.ReactNode }> }) {
  return (
    <dl className="doc-info-grid">
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`} className="doc-info-item">
          <dt className="doc-field-label">{item.label}</dt>
          <dd className="doc-field-value">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="doc-inspection-section">
      <h2 className="doc-section-heading">{title}</h2>
      <div className="doc-section-body-wrap">{children}</div>
    </section>
  );
}

function ReportPhoto({
  src,
  alt,
  caption,
  uploadedAt,
  href,
}: {
  src: string;
  alt: string;
  caption?: string | null;
  uploadedAt?: string;
  href: string;
}) {
  const comment = caption?.trim() || "";
  const showUploadedAt = uploadedAt && comment !== formatDateTime(uploadedAt);
  return (
    <figure className="doc-photo-cell">
      <a href={href} target="_blank" rel="noreferrer" className="doc-photo-frame" title={alt}>
        <img src={src} alt={alt} className="doc-photo-thumb" loading="lazy" />
      </a>
      <figcaption className="doc-photo-caption-label">Comment</figcaption>
      <p className="doc-photo-caption">{comment || "No comment provided"}</p>
      {showUploadedAt ? <p className="doc-photo-meta">{formatDateTime(uploadedAt)}</p> : null}
    </figure>
  );
}

function equipmentRows(
  request: BackendServiceRequest,
  equipment: BackendEquipment[],
  machineCondition?: string | null,
) {
  if (equipment.length) {
    return equipment.flatMap((item) => [
      { label: "Equipment", value: displayOrFallback(item.name) },
      {
        label: "Brand / Model",
        value: [displayOrFallback(item.manufacturer), displayOrFallback(item.model)].filter(Boolean).join(" · "),
      },
      { label: "Serial No.", value: displayOrFallback(item.serialNumber) },
      { label: "Asset ID", value: displayOrFallback(item.assetTag) },
      { label: "Location", value: displayOrFallback(item.location) },
      { label: "Condition", value: displayOrFallback(machineCondition ?? item.condition) },
    ]);
  }
  if (request.equipmentItems?.length) {
    return request.equipmentItems.flatMap((item) => [
      { label: "Equipment", value: displayOrFallback(item.equipmentName) },
      { label: "Asset ID", value: displayOrFallback(item.assetTag) },
    ]);
  }
  return [
    { label: "Equipment", value: displayOrFallback(request.equipmentName) },
    { label: "Condition", value: displayOrFallback(machineCondition) },
  ];
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
  const reportStatus = report.submittedAt ? "Submitted" : "Draft";
  const checklistFields = formatJsonField(report.checklist);
  const measurementFields = formatJsonField(report.measurements);
  const errorCodes = formatErrorCodes(report.errorCodes);

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
            <p className="doc-kind">Inspection Report</p>
            <dl className="doc-invoice-meta">
              <div>
                <dt>Inspection Report No</dt>
                <dd>{request.reference}</dd>
              </div>
              <div>
                <dt>Inspection date</dt>
                <dd>{formatDateTime(report.reportedAt)}</dd>
              </div>
            </dl>
          </div>
        </header>

        <div className="doc-report-summary">
          <div className="doc-report-summary-badges">
            <StatusBadge status={report.severity} className="text-xs" />
            <StatusBadge status={report.submittedAt ? "completed" : "draft"} className="text-xs" />
          </div>
          <dl className="doc-report-summary-meta">
            <div>
              <dt>Inspector</dt>
              <dd>{displayOrFallback(report.reportedBy)}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{reportStatus}</dd>
            </div>
          </dl>
        </div>

        <Section title="Customer">
          <InfoGrid
            items={[
              { label: "Name", value: displayOrFallback(customer?.name ?? request.customerName) },
              { label: "Phone", value: displayOrFallback(customer?.phone) },
              { label: "Email", value: displayOrFallback(customer?.email) },
              { label: "Site address", value: displayOrFallback(siteAddress) },
            ]}
          />
        </Section>

        <Section title="Equipment">
          <InfoGrid items={equipmentRows(request, equipment, report.machineCondition)} />
        </Section>

        <Section title="Inspection Findings">
          <p className="doc-text-block whitespace-pre-wrap">
            {split.findings.trim() || "—"}
          </p>
        </Section>

        {split.workDetails.trim() ? (
          <Section title="Work Required">
            <p className="doc-text-block whitespace-pre-wrap">{split.workDetails}</p>
          </Section>
        ) : null}

        <Section title="Recommendations">
          <p className="doc-text-block whitespace-pre-wrap">
            {report.recommendation.trim() || "—"}
          </p>
          {report.recommendations?.length ? (
            <div className="doc-parts-list">
              <p className="doc-parts-heading">Recommended parts &amp; work</p>
              <ul>
                {report.recommendations.map((item) => (
                  <li key={item.id}>
                    <span className="doc-parts-title">
                      {item.title} · Qty {item.quantity} · {item.priority}
                    </span>
                    {item.description ? (
                      <span className="doc-parts-desc">{item.description}</span>
                    ) : null}
                    {item.estimatedCost != null ? (
                      <span className="doc-parts-cost">{formatCurrency(item.estimatedCost)}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Section>

        {checklistFields.length ? (
          <Section title="Checklist">
            <InfoGrid items={checklistFields} />
          </Section>
        ) : null}

        {measurementFields.length ? (
          <Section title="Measurements">
            <InfoGrid items={measurementFields} />
          </Section>
        ) : null}

        {errorCodes.length ? (
          <Section title="Error codes">
            <ul className="doc-error-codes">
              {errorCodes.map((code) => (
                <li key={code}>{code}</li>
              ))}
            </ul>
          </Section>
        ) : null}

        {report.calibrationStatus ? (
          <Section title="Calibration">
            <p className="doc-text-block">{report.calibrationStatus}</p>
          </Section>
        ) : null}

        {report.attachments?.length ? (
          <Section title="Inspection photos">
            <div className="doc-photo-grid">
              {report.attachments.map((att) => (
                <ReportPhoto
                  key={att.id}
                  src={api.fileDownloadUrl(att.fileId)}
                  alt={att.file?.originalName ?? att.caption ?? "Inspection image"}
                  caption={att.caption ?? att.file?.originalName}
                  uploadedAt={att.createdAt}
                  href={api.fileDownloadUrl(att.fileId)}
                />
              ))}
            </div>
          </Section>
        ) : null}

        {report.technicianRemarks?.trim() ? (
          <Section title="Remarks">
            <p className="doc-text-block whitespace-pre-wrap">{report.technicianRemarks}</p>
          </Section>
        ) : null}

        <div className="doc-signatures">
          <div className="doc-sign">
            <p className="doc-label">Inspector Signature</p>
            <div className="doc-sign-line" />
            <p className="doc-sign-caption">{displayOrFallback(report.reportedBy)}</p>
          </div>
          <div className="doc-sign">
            <p className="doc-label">Approval Signature</p>
            <div className="doc-sign-line" />
            <p className="doc-sign-caption">{company}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
