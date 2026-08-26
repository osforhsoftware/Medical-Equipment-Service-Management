import { ESTIMATE_WORKFLOW_STEPS } from "@/lib/estimates";
import { cn } from "@/lib/utils";

export function EstimateWorkflowSteps({ current = 0 }: { current?: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-1 text-[12px]" aria-label="Estimate workflow">
      {ESTIMATE_WORKFLOW_STEPS.map((step, index) => {
        const active = index === current;
        const done = index < current;
        return (
          <li key={step} className="flex items-center gap-1">
            {index > 0 ? <span className="mx-1 text-muted-foreground/50">→</span> : null}
            <span
              className={cn(
                "rounded-md px-2 py-1 font-medium",
                active && "bg-primary/10 text-primary",
                done && "text-foreground",
                !active && !done && "text-muted-foreground",
              )}
            >
              {step}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
