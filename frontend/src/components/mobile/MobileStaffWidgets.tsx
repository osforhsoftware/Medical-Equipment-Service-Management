import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MobileStat } from "@/lib/mobileStaffDashboard";

const TONE_CARD: Record<MobileStat["tone"], string> = {
  primary: "border-primary/25 bg-gradient-to-br from-primary/15 via-primary/8 to-primary/4 shadow-sm text-foreground",
  accent: "border-accent/25 bg-gradient-to-br from-accent/15 via-accent/8 to-accent/4 shadow-sm text-foreground",
  warning: "border-warning/30 bg-gradient-to-br from-warning/20 via-warning/10 to-warning/4 shadow-sm text-foreground",
  destructive: "border-destructive/25 bg-gradient-to-br from-destructive/15 via-destructive/8 to-destructive/4 shadow-sm text-foreground",
  success: "border-success/25 bg-gradient-to-br from-success/15 via-success/8 to-success/4 shadow-sm text-foreground",
};

const TONE_ICON: Record<MobileStat["tone"], string> = {
  primary: "border-primary/30 bg-primary/20 text-primary",
  accent: "border-accent/30 bg-accent/20 text-accent",
  warning: "border-warning/35 bg-warning/25 text-warning-foreground",
  destructive: "border-destructive/30 bg-destructive/20 text-destructive",
  success: "border-success/30 bg-success/20 text-success",
};

const TONE_VALUE: Record<MobileStat["tone"], string> = {
  primary: "text-primary",
  accent: "text-accent",
  warning: "text-warning-foreground",
  destructive: "text-destructive",
  success: "text-success",
};

interface MobileStatGridProps {
  stats: MobileStat[];
  onStatClick?: (stat: MobileStat) => void;
}

export function MobileStatGrid({ stats, onStatClick }: MobileStatGridProps) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {stats.map((stat) => (
        <StatTile key={stat.label} stat={stat} onClick={onStatClick ? () => onStatClick(stat) : undefined} />
      ))}
    </div>
  );
}

function StatTile({ stat, onClick }: { stat: MobileStat; onClick?: () => void }) {
  const Icon = stat.icon;
  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-3 overflow-hidden rounded-2xl border px-3.5 py-3 text-left transition-all active:scale-[0.97]",
        TONE_CARD[stat.tone],
        onClick && "cursor-pointer hover:shadow-md hover:border-primary/40",
      )}
    >
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-xs", TONE_ICON[stat.tone])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate font-display text-xl font-extrabold leading-none tracking-tight", TONE_VALUE[stat.tone])}>
          {stat.value}
        </p>
        <p className="mt-1 truncate text-xs font-semibold text-foreground/80">{stat.label}</p>
      </div>
    </Wrapper>
  );
}

interface MobileQuickActionsProps {
  actions: { label: string; to: string; icon: LucideIcon; primary?: boolean }[];
  onNavigate: (to: string) => void;
}

/** Vyapar Application Style Quick Action Grid */
export function MobileQuickActions({ actions, onNavigate }: MobileQuickActionsProps) {
  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-2.5">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.label}
            type="button"
            onClick={() => onNavigate(action.to)}
            className={cn(
              "flex flex-col items-center justify-center gap-2 rounded-2xl border p-2.5 text-center transition-all active:scale-92 hover:shadow-sm",
              action.primary
                ? "border-primary/40 bg-gradient-to-b from-primary to-primary/90 text-primary-foreground shadow-md shadow-primary/20"
                : "border-border/60 bg-card text-foreground hover:border-primary/30 hover:bg-muted/30",
            )}
          >
            <span
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-2xl shadow-xs transition-transform",
                action.primary
                  ? "bg-white/20 text-white"
                  : "bg-primary/10 text-primary group-hover:scale-105",
              )}
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className={cn(
              "text-center text-[11px] font-bold leading-tight truncate w-full",
              action.primary ? "text-white" : "text-foreground",
            )}>
              {action.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

