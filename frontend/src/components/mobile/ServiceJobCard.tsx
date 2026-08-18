import { ArrowRight, HardDrive, MapPin, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate, formatJobStatus } from "@/lib/format";
import { WorkflowTimeline } from "./WorkflowTimeline";
import { WorkflowStatusChip } from "./WorkflowStatusChip";

export interface ServiceJobCardData {
  id: string;
  reference: string;
  equipmentName: string;
  serialNumber?: string;
  customerName: string;
  hospitalName?: string;
  complaint?: string;
  priority?: string;
  status: string;
  engineer?: string;
  serviceDate?: string;
  progress?: number;
  featured?: boolean;
  overdue?: boolean;
}

interface ServiceJobCardProps {
  job: ServiceJobCardData;
  onClick?: () => void;
  actionLabel?: string;
  className?: string;
}

export function ServiceJobCard({ job, onClick, actionLabel = "View Details", className }: ServiceJobCardProps) {
  const featured = job.featured;
  const displayStatus = formatJobStatus(job.status);

  return (
    <article
      className={cn(
        "mobile-card group cursor-pointer transition-all duration-200 active:scale-[0.99]",
        featured
          ? "border-0 bg-gradient-primary text-primary-foreground shadow-elevated"
          : "border border-border/60 bg-card shadow-card hover:shadow-elevated",
        className,
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      {/* Top: Equipment + badges */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
              featured ? "bg-primary-foreground/15" : "bg-primary/10",
            )}
          >
            <HardDrive className={cn("h-5 w-5", featured ? "text-primary-foreground" : "text-primary")} />
          </div>
          <div className="min-w-0">
            <p className={cn("truncate font-display text-base font-semibold", featured ? "text-primary-foreground" : "text-foreground")}>
              {job.equipmentName}
            </p>
            <p className={cn("font-mono text-xs", featured ? "text-primary-foreground/75" : "text-muted-foreground")}>
              {job.serialNumber ?? job.reference}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {job.priority && job.priority !== "low" && (
            <WorkflowStatusChip
              status={job.priority}
              label={job.priority}
              className={featured ? "border-primary-foreground/30 bg-primary-foreground/15 text-primary-foreground" : undefined}
            />
          )}
          <WorkflowStatusChip
            status={displayStatus}
            overdue={job.overdue}
            className={featured ? "border-primary-foreground/30 bg-primary-foreground text-primary" : undefined}
          />
        </div>
      </div>

      {/* Middle: Customer + complaint */}
      <div className={cn("mt-4 space-y-1.5", featured ? "text-primary-foreground/90" : "text-muted-foreground")}>
        <div className="flex items-center gap-1.5 text-sm">
          <MapPin className="h-3.5 w-3.5 shrink-0 opacity-70" />
          <span className="truncate font-medium">{job.hospitalName ?? job.customerName}</span>
        </div>
        {job.complaint && (
          <p className={cn("line-clamp-2 text-xs", featured ? "text-primary-foreground/75" : "text-muted-foreground")}>
            {job.complaint}
          </p>
        )}
      </div>

      {/* Timeline */}
      <div className={cn("mt-4 rounded-xl p-3", featured ? "bg-primary-foreground/10" : "bg-muted/40")}>
        <WorkflowTimeline status={displayStatus} kind="job" compact />
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className={cn("flex items-center gap-3 text-xs", featured ? "text-primary-foreground/80" : "text-muted-foreground")}>
          {job.engineer && (
            <span className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              {job.engineer}
            </span>
          )}
          {job.serviceDate && (
            <span>{formatDate(job.serviceDate)}</span>
          )}
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-[14px] px-3 py-2 text-xs font-semibold transition-colors",
            featured
              ? "bg-primary-foreground text-primary"
              : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground",
          )}
        >
          {actionLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </article>
  );
}
