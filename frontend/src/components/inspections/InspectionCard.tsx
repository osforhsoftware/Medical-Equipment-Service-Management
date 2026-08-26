import { Link, useNavigate } from "react-router-dom";
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
  return task.status === "new" || status === "new" ? "inspection" : status;
}

function accentClass(task: BackendServiceRequest) {
  if (task.inspectionReport) return "border-l-success";
  const status = formatServiceStatus(task.status);
  if (status === "estimate" || task.status === "estimate") return "border-l-accent";
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
  onInspect: (task: BackendServiceRequest) => void;
  mobile?: boolean;
}

export function InspectionCard({ task, onInspect, mobile = false }: InspectionCardProps) {
  const navigate = useNavigate();
  const report = task.inspectionReport;
  const title = equipmentLabel(task);
  const status = queueStatus(task);
  const cta = report ? "Update" : "Inspect";

  const openDetails = () => navigate(`/app/inspections/${task.id}`);

  return (
    <Card
      role="link"
      tabIndex={0}
      onClick={openDetails}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openDetails();
        }
      }}
      className={cn(
        "flex cursor-pointer flex-col border-l-[3px] p-0 outline-none transition-colors",
        "hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring",
        accentClass(task),
        mobile && "active:scale-[0.99]",
      )}
      aria-label={`View details for ${title}`}
    >
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold leading-snug text-foreground" title={title}>
              {title}
            </h3>
            <p className="truncate text-[11px] text-muted-foreground">
              <span className="font-mono">{task.reference}</span>
              <span aria-hidden="true"> · </span>
              <span>{task.customerName}</span>
            </p>
          </div>
          <StatusBadge status={status} className="shrink-0" />
        </div>

        {task.description ? (
          <p className="line-clamp-1 text-xs leading-snug text-muted-foreground">{task.description}</p>
        ) : null}

        <div className="grid grid-cols-2 gap-2 border-t border-border/50 pt-2 text-[11px]">
          <div className="min-w-0">
            <p className="text-muted-foreground">Assigned</p>
            <p className="truncate font-medium text-foreground">{task.assignedName || "Unassigned"}</p>
          </div>
          <div className="min-w-0">
            <p className="text-muted-foreground">Created</p>
            <p className="truncate font-medium text-foreground" title={formatDateTime(task.createdAt)}>
              {formatCreatedLabel(task.createdAt)}
            </p>
          </div>
        </div>

        {report ? (
          <div className="flex items-center gap-1.5 rounded-md border border-success/20 bg-success/5 px-2 py-1.5">
            <Check className="h-3 w-3 shrink-0 text-success" aria-hidden="true" />
            <StatusBadge status={report.severity} className="text-[10px]" />
            <span className="truncate text-[11px] text-muted-foreground">Report filed</span>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border/50 px-3 py-2">
        <Link
          to={`/app/inspections/${task.id}`}
          onClick={(event) => event.stopPropagation()}
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          Details
        </Link>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onInspect(task);
          }}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
        >
          {cta}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </Card>
  );
}
