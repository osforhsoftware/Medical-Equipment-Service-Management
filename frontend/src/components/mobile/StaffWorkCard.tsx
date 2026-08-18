import { ArrowRight, Loader2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate, formatJobStatus } from "@/lib/format";
import { WorkflowStatusChip } from "./WorkflowStatusChip";
import { WorkflowTimeline } from "./WorkflowTimeline";
import type { DashboardQueueItem } from "@/lib/api";

interface StaffWorkCardProps {
  item: DashboardQueueItem;
  featured?: boolean;
  updating?: boolean;
  onOpen: () => void;
  onQuickUpdate?: () => void;
  quickUpdateLabel?: string;
}

export function StaffWorkCard({
  item,
  featured = false,
  updating = false,
  onOpen,
  onQuickUpdate,
  quickUpdateLabel,
}: StaffWorkCardProps) {
  const overdue = item.dueAt ? new Date(item.dueAt) < new Date() : false;
  const displayStatus = formatJobStatus(item.status);

  return (
    <article
      className={cn(
        "mobile-card overflow-hidden transition-all",
        featured && "border-0 bg-gradient-primary text-primary-foreground shadow-elevated",
        overdue && !featured && "border-destructive/30 bg-destructive/[0.03]",
      )}
    >
      <button type="button" onClick={onOpen} className="w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={cn("font-mono text-[11px]", featured ? "text-primary-foreground/70" : "text-muted-foreground")}>
              {item.reference}
            </p>
            <h3 className={cn("mt-0.5 font-display text-base font-semibold leading-snug", featured ? "text-primary-foreground" : "text-foreground")}>
              {item.title}
            </h3>
            <p className={cn("mt-1 flex items-center gap-1 text-sm", featured ? "text-primary-foreground/85" : "text-muted-foreground")}>
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{item.subtitle}</span>
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <WorkflowStatusChip
              status={displayStatus}
              overdue={overdue}
              className={featured ? "border-primary-foreground/30 bg-primary-foreground text-primary" : undefined}
            />
            {item.priority && item.priority !== "low" && (
              <WorkflowStatusChip status={item.priority} label={item.priority} />
            )}
          </div>
        </div>

        {item.dueAt && (
          <p className={cn("mt-2 text-xs font-medium", overdue ? "text-destructive" : featured ? "text-primary-foreground/75" : "text-muted-foreground")}>
            {overdue ? "Overdue · " : "Due · "}{formatDate(item.dueAt)}
          </p>
        )}

        <div className={cn("mt-3 rounded-xl p-2.5", featured ? "bg-primary-foreground/10" : "bg-muted/40")}>
          <WorkflowTimeline status={displayStatus} kind={item.kind === "job" ? "job" : "request"} compact />
        </div>

        {typeof item.progress === "number" && item.progress > 0 && (
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[10px] font-medium">
              <span className={featured ? "text-primary-foreground/70" : "text-muted-foreground"}>Progress</span>
              <span className={featured ? "text-primary-foreground" : "text-foreground"}>{item.progress}%</span>
            </div>
            <div className={cn("h-1.5 overflow-hidden rounded-full", featured ? "bg-primary-foreground/20" : "bg-muted")}>
              <div
                className={cn("h-full rounded-full transition-all", featured ? "bg-primary-foreground" : "bg-primary")}
                style={{ width: `${item.progress}%` }}
              />
            </div>
          </div>
        )}
      </button>

      <div className="mt-4 flex gap-2">
        {onQuickUpdate && quickUpdateLabel && (
          <button
            type="button"
            disabled={updating}
            onClick={(e) => {
              e.stopPropagation();
              onQuickUpdate();
            }}
            className={cn(
              "mobile-btn-primary flex-1 !h-12 !min-h-[48px] !text-sm",
              featured && "!bg-primary-foreground !text-primary",
            )}
          >
            {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : quickUpdateLabel}
          </button>
        )}
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            "inline-flex h-12 min-h-[48px] items-center justify-center gap-1 rounded-[14px] px-4 text-sm font-semibold transition-colors",
            onQuickUpdate
              ? featured
                ? "border border-primary-foreground/30 text-primary-foreground"
                : "mobile-btn-secondary !h-12 !min-h-[48px] flex-1"
              : featured
                ? "w-full bg-primary-foreground text-primary"
                : "mobile-btn-primary w-full !h-12 !min-h-[48px]",
          )}
        >
          Open
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}
