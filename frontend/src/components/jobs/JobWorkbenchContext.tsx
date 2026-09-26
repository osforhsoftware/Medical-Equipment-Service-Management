import { StatusBadge } from "@/components/shared/StatusBadge";
import { DetailInfoGrid, DetailSection } from "@/components/shared/RecordDetailLayout";
import type { BackendJobWorkbench } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

function hasWorkbenchContent(workbench?: BackendJobWorkbench | null) {
  if (!workbench) return false;
  return Boolean(
    workbench.complaint ||
      workbench.inspectionDiagnosis ||
      workbench.approvedRepairScope.length ||
      workbench.priority ||
      workbench.targetDate ||
      workbench.customerRestrictions ||
      workbench.equipment?.assetTag ||
      workbench.equipment?.model ||
      workbench.equipment?.serialNumber ||
      workbench.equipment?.location,
  );
}

export function JobWorkbenchContext({
  workbench,
  compact = false,
  className,
}: {
  workbench?: BackendJobWorkbench | null;
  compact?: boolean;
  className?: string;
}) {
  if (!hasWorkbenchContent(workbench)) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        No ticket complaint, inspection, or approved scope is linked to this job yet.
      </p>
    );
  }

  const items = [
    { label: "Priority", value: workbench!.priority ? <StatusBadge status={workbench!.priority} /> : "—" },
    { label: "Target date", value: workbench!.targetDate ? formatDate(workbench!.targetDate) : "—" },
    ...(workbench!.equipment?.assetTag ? [{ label: "Asset tag", value: workbench!.equipment.assetTag }] : []),
    ...(workbench!.equipment?.model ? [{ label: "Model", value: workbench!.equipment.model }] : []),
    ...(workbench!.equipment?.serialNumber ? [{ label: "Serial", value: workbench!.equipment.serialNumber }] : []),
    ...(workbench!.equipment?.location ? [{ label: "Location", value: workbench!.equipment.location }] : []),
  ];

  return (
    <div className={cn("space-y-4", className)}>
      <DetailInfoGrid items={items} />
      {workbench!.complaint ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Complaint</p>
          <p className={cn("mt-1 whitespace-pre-wrap text-sm", compact && "leading-relaxed")}>{workbench!.complaint}</p>
        </div>
      ) : null}
      {workbench!.inspectionDiagnosis ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Inspection diagnosis</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{workbench!.inspectionDiagnosis}</p>
        </div>
      ) : null}
      {workbench!.approvedRepairScope.length ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Approved repair scope</p>
          <ul className="mt-1 space-y-1 text-sm">
            {workbench!.approvedRepairScope.map((line, index) => (
              <li key={`${line.description}-${index}`}>
                {line.description}
                {line.quantity ? <span className="text-muted-foreground"> · Qty {line.quantity}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {workbench!.customerRestrictions ? (
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2">
          <p className="text-xs font-medium uppercase tracking-wide text-warning">Customer restrictions</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{workbench!.customerRestrictions}</p>
        </div>
      ) : null}
    </div>
  );
}

export function JobWorkbenchContextSection({
  workbench,
}: {
  workbench?: BackendJobWorkbench | null;
}) {
  return (
    <DetailSection title="Job context">
      <JobWorkbenchContext workbench={workbench} />
    </DetailSection>
  );
}
