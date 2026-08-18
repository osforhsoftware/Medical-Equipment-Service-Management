import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface InspectionSectionProps {
  step?: string;
  title: string;
  description?: string;
  required?: boolean;
  optional?: boolean;
  children: ReactNode;
  className?: string;
  tone?: "default" | "warning";
}

export function InspectionSection({
  step,
  title,
  description,
  required,
  optional,
  children,
  className,
  tone = "default",
}: InspectionSectionProps) {
  return (
    <section
      className={cn(
        "space-y-3 border-b border-border/50 pb-6 last:border-b-0 last:pb-0",
        tone === "warning" && "rounded-xl border border-warning/40 bg-warning/5 px-4 py-4 last:border last:pb-4",
        className,
      )}
    >
      <header className="flex items-start gap-3">
        {step ? (
          <span
            className="mt-0.5 font-mono text-xs font-semibold tabular-nums text-muted-foreground"
            aria-hidden="true"
          >
            {step}
          </span>
        ) : null}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h3 className="text-[15px] font-semibold leading-tight text-foreground">{title}</h3>
            {required ? (
              <span className="text-xs font-medium text-destructive" aria-hidden="true">
                *
              </span>
            ) : null}
            {optional ? (
              <span className="text-xs text-muted-foreground">Optional</span>
            ) : null}
          </div>
          {description ? (
            <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </header>
      <div className={cn("pl-0", step && "sm:pl-7")}>{children}</div>
    </section>
  );
}
