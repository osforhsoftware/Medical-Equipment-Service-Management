import { Link } from "react-router-dom";
import { ArrowRight, ClipboardList, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type ModuleFlowStep = {
  id: string;
  label: string;
  to: string;
  icon: LucideIcon;
};

type ModuleFlowStripProps = {
  overviewTo: string;
  overviewActive?: boolean;
  steps: ModuleFlowStep[];
  activeId: string;
  /** Optional short label before flow steps */
  flowLabel?: string;
};

/** Compact Overview + flow navigation shared by Sales-style desks. */
export function ModuleFlowStrip({
  overviewTo,
  overviewActive = false,
  steps,
  activeId,
  flowLabel = "Flow",
}: ModuleFlowStripProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border bg-muted/30 px-3 py-2.5">
      <Link
        to={overviewTo}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
          overviewActive
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:bg-background hover:text-foreground",
        )}
      >
        <ClipboardList className="h-3.5 w-3.5" />
        Overview
      </Link>
      <span className="mx-0.5 h-4 w-px bg-border" />
      <span className="mr-0.5 text-xs font-medium text-muted-foreground">{flowLabel}</span>
      {steps.map((step, index) => {
        const Icon = step.icon;
        const active = step.id === activeId;
        return (
          <div key={step.id} className="flex items-center gap-1.5">
            {index > 0 ? <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/60" /> : null}
            <Link
              to={step.to}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {step.label}
            </Link>
          </div>
        );
      })}
    </div>
  );
}

type QuickActionCardProps = {
  title: string;
  hint: string;
  icon: LucideIcon;
  to?: string;
  onClick?: () => void;
};

export function ModuleQuickAction({ title, hint, icon: Icon, to, onClick }: QuickActionCardProps) {
  const inner = (
    <>
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1 text-left">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40"
      >
        {inner}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/40"
    >
      {inner}
    </button>
  );
}
