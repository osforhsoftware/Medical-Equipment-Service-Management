import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  WORKFLOW_STAGES,
  resolveWorkflowStage,
  workflowStageIndex,
  type WorkflowStageKey,
} from "@/lib/workflow";

interface WorkflowTimelineProps {
  status: string;
  kind?: "request" | "job";
  compact?: boolean;
  className?: string;
  /** Override auto-detected current stage */
  currentStage?: WorkflowStageKey;
}

export function WorkflowTimeline({
  status,
  kind = "request",
  compact = false,
  className,
  currentStage,
}: WorkflowTimelineProps) {
  const stage = currentStage ?? resolveWorkflowStage(status, kind);
  const currentIdx = workflowStageIndex(stage);

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between gap-0.5">
        {WORKFLOW_STAGES.map((s, idx) => {
          const done = idx < currentIdx;
          const active = idx === currentIdx;
          const pending = idx > currentIdx;

          return (
            <div key={s.key} className="flex min-w-0 flex-1 flex-col items-center">
              <div className="relative flex w-full items-center justify-center">
                {idx > 0 && (
                  <span
                    className={cn(
                      "absolute right-1/2 top-1/2 h-0.5 w-full -translate-y-1/2",
                      done || active ? "bg-primary" : "bg-border",
                    )}
                    aria-hidden
                  />
                )}
                <span
                  className={cn(
                    "relative z-10 flex shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    compact ? "h-4 w-4" : "h-5 w-5",
                    done && "border-primary bg-primary text-primary-foreground",
                    active && "border-primary bg-primary text-primary-foreground ring-2 ring-primary/20",
                    pending && "border-muted-foreground/30 bg-background",
                  )}
                >
                  {done ? (
                    <Check className={cn(compact ? "h-2 w-2" : "h-2.5 w-2.5")} strokeWidth={3} />
                  ) : active ? (
                    <span className={cn("rounded-full bg-primary-foreground", compact ? "h-1.5 w-1.5" : "h-2 w-2")} />
                  ) : null}
                </span>
              </div>
              {!compact && (
                <span
                  className={cn(
                    "mt-1 max-w-full truncate text-center text-[9px] font-medium leading-tight",
                    active ? "text-primary" : done ? "text-muted-foreground" : "text-muted-foreground/60",
                  )}
                >
                  {s.label}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
