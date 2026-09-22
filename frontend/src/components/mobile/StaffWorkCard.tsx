import { ArrowRight, ChevronRight, Loader2, MapPin } from "lucide-react";
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
        "mobile-card overflow-hidden transition-all hover:shadow-md",
        featured && "border-0 bg-gradient-to-br from-primary via-primary/95 to-accent text-primary-foreground shadow-lg shadow-primary/20",
        overdue && !featured && "border-destructive/40 bg-destructive/[0.04]",
      )}
    >
      <button type="button" onClick={onOpen} className="w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className={cn("font-mono text-[11px] font-bold tracking-tight px-2 py-0.5 rounded-md", featured ? "bg-white/15 text-white" : "bg-muted text-muted-foreground")}>
                {item.reference}
              </span>
              {item.kind && (
                <span className={cn("text-[10px] font-bold uppercase tracking-wider", featured ? "text-white/80" : "text-primary")}>
                  • {item.kind}
                </span>
              )}
            </div>
            <h3 className={cn("mt-1.5 font-display text-base font-bold leading-snug", featured ? "text-primary-foreground" : "text-foreground")}>
              {item.title}
            </h3>
            <p className={cn("mt-1 flex items-center gap-1 text-xs font-medium", featured ? "text-primary-foreground/90" : "text-muted-foreground")}>
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{item.subtitle}</span>
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <WorkflowStatusChip
              status={displayStatus}
              overdue={overdue}
              className={featured ? "border-white/30 bg-white/20 text-white font-bold" : undefined}
            />
            {item.priority && item.priority !== "low" && (
              <WorkflowStatusChip status={item.priority} label={item.priority} />
            )}
          </div>
        </div>

        {item.dueAt && (
          <p className={cn("mt-2.5 text-xs font-semibold", overdue ? "text-destructive font-bold" : featured ? "text-primary-foreground/85" : "text-muted-foreground")}>
            {overdue ? "⚠️ Overdue · " : "📅 Due · "}{formatDate(item.dueAt)}
          </p>
        )}

        <div className={cn("mt-3 rounded-xl p-2.5 backdrop-blur-xs", featured ? "bg-white/10 border border-white/10" : "bg-muted/50 border border-border/40")}>
          <WorkflowTimeline status={displayStatus} kind={item.kind === "job" ? "job" : "request"} compact />
        </div>

        {typeof item.progress === "number" && item.progress > 0 && (
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[10px] font-bold">
              <span className={featured ? "text-primary-foreground/80" : "text-muted-foreground"}>Work Progress</span>
              <span className={featured ? "text-primary-foreground" : "text-foreground"}>{item.progress}%</span>
            </div>
            <div className={cn("h-2 overflow-hidden rounded-full p-0.5", featured ? "bg-white/20" : "bg-muted")}>
              <div
                className={cn("h-full rounded-full transition-all duration-300", featured ? "bg-white shadow-xs" : "bg-primary")}
                style={{ width: `${item.progress}%` }}
              />
            </div>
          </div>
        )}
      </button>

      <div className="mt-3.5 flex items-center gap-2 pt-1 border-t border-border/30">
        {onQuickUpdate && quickUpdateLabel && (
          <button
            type="button"
            disabled={updating}
            onClick={(e) => {
              e.stopPropagation();
              onQuickUpdate();
            }}
            className={cn(
              "flex-1 inline-flex h-11 min-h-[44px] items-center justify-center gap-1.5 rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95",
              featured
                ? "bg-white text-primary hover:bg-white/90"
                : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20",
            )}
          >
            {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              <>
                <span>⚡ {quickUpdateLabel}</span>
              </>
            )}
          </button>
        )}
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            "inline-flex h-11 min-h-[44px] items-center justify-center gap-1 rounded-xl px-4 text-xs font-bold transition-all active:scale-95",
            onQuickUpdate
              ? featured
                ? "border border-white/40 text-white hover:bg-white/10"
                : "border border-border/80 bg-card text-foreground hover:bg-muted/60"
              : featured
                ? "w-full bg-white text-primary font-extrabold hover:bg-white/90"
                : "w-full bg-primary text-primary-foreground font-extrabold hover:bg-primary/90 shadow-md shadow-primary/20",
          )}
        >
          View Details
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

