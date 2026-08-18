import { ArrowRight, Check } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card } from "@/components/ui/card";
import type { BackendServiceRequest } from "@/lib/api";
import { formatDateTime, formatRelativeTime, formatServiceStatus } from "@/lib/format";
import { cn } from "@/lib/utils";

function equipmentLabel(task: BackendServiceRequest) {
  if (task.equipmentItems?.length) {
    return task.equipmentItems.map((e) => e.equipmentName).join(", ");
  }
  return task.equipmentName ?? "No equipment";
}

function queueStatus(task: BackendServiceRequest) {
  const status = formatServiceStatus(task.status);
  return status === "new" ? "inspection" : status;
}

function accentClass(task: BackendServiceRequest) {
  if (task.inspectionReport) return "border-l-success";
  const status = formatServiceStatus(task.status);
  if (status === "estimate") return "border-l-accent";
  return "border-l-info";
}

function formatCreatedLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfThatDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round((startOfToday.getTime() - startOfThatDay.getTime()) / 86_400_000);

  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (dayDiff === 0) return `Today, ${time}`;
  if (dayDiff === 1) return `Yesterday, ${time}`;
  if (dayDiff > 1 && dayDiff < 7) return formatRelativeTime(value);
  return formatDateTime(value);
}

interface InspectionCardProps {
  task: BackendServiceRequest;
  onOpen: (task: BackendServiceRequest) => void;
  mobile?: boolean;
}

export function InspectionCard({ task, onOpen, mobile = false }: InspectionCardProps) {
  const report = task.inspectionReport;
  const title = equipmentLabel(task);
  const status = queueStatus(task);
  const cta = report ? "Update Report" : "Conduct Inspection";

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onOpen(task)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(task);
        }
      }}
      className={cn(
        "flex cursor-pointer flex-col border-l-[3px] p-0 outline-none transition-colors",
        "hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring",
        accentClass(task),
        mobile && "active:scale-[0.99]",
      )}
      aria-label={`${cta} for ${title}`}
    >
      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <h3 className="truncate text-[15px] font-semibold leading-snug text-foreground sm:text-base" title={title}>
              {title}
            </h3>
            <p className="truncate text-xs text-muted-foreground sm:text-[13px]">
              <span className="font-mono">{task.reference}</span>
              <span aria-hidden="true"> · </span>
              <span>{task.customerName}</span>
            </p>
          </div>
          <StatusBadge status={status} className="shrink-0" />
        </div>

        {task.description ? (
          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{task.description}</p>
        ) : null}

        <div className="grid grid-cols-2 gap-3 border-t border-border/50 pt-3 text-xs">
          <div className="min-w-0">
            <p className="text-muted-foreground">Assigned to</p>
            <p className="mt-0.5 truncate font-medium text-foreground">{task.assignedName || "Unassigned"}</p>
          </div>
          <div className="min-w-0">
            <p className="text-muted-foreground">Created</p>
            <p className="mt-0.5 truncate font-medium text-foreground" title={formatDateTime(task.createdAt)}>
              {formatCreatedLabel(task.createdAt)}
            </p>
          </div>
        </div>

        {report ? (
          <div className="rounded-lg border border-success/20 bg-success/5 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-success">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              Report filed
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <StatusBadge status={report.severity} className="text-[10px]" />
              <span className="text-[11px] capitalize text-muted-foreground">{report.severity} severity</span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-foreground/80">{report.findings}</p>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border/50 px-4 py-3 sm:px-5">
        <span className="text-sm font-semibold text-primary transition-colors group-hover:text-primary/90">
          {cta}
        </span>
        <ArrowRight
          className="h-4 w-4 text-primary transition-transform duration-200 group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </div>
    </Card>
  );
}
