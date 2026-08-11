import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MobileStat } from "@/lib/mobileStaffDashboard";

const TONE_CARD: Record<MobileStat["tone"], string> = {
  primary: "border-primary/20 bg-gradient-to-br from-primary/18 via-primary/10 to-info/6 shadow-primary/10",
  accent: "border-accent/20 bg-gradient-to-br from-accent/18 via-accent/10 to-accent/5 shadow-accent/10",
  warning: "border-warning/25 bg-gradient-to-br from-warning/20 via-warning/12 to-warning/5 shadow-warning/10",
  destructive: "border-destructive/20 bg-gradient-to-br from-destructive/16 via-destructive/10 to-destructive/4 shadow-destructive/10",
  success: "border-success/20 bg-gradient-to-br from-success/18 via-success/10 to-success/5 shadow-success/10",
};

const TONE_ICON: Record<MobileStat["tone"], string> = {
  primary: "border-primary/20 bg-gradient-to-br from-primary/30 to-info/12 text-primary",
  accent: "border-accent/20 bg-gradient-to-br from-accent/30 to-accent/10 text-accent",
  warning: "border-warning/25 bg-gradient-to-br from-warning/35 to-warning/12 text-warning-foreground",
  destructive: "border-destructive/20 bg-gradient-to-br from-destructive/30 to-destructive/10 text-destructive",
  success: "border-success/20 bg-gradient-to-br from-success/30 to-success/10 text-success",
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
    <div className="grid grid-cols-2 gap-2">
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
        "relative flex items-center gap-2.5 overflow-hidden rounded-[16px] border px-3 py-2.5 text-left shadow-sm transition-all active:scale-[0.97]",
        TONE_CARD[stat.tone],
        onClick && "cursor-pointer hover:shadow-md",
      )}
    >
      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border", TONE_ICON[stat.tone])}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate font-display text-lg font-bold leading-none tracking-tight", TONE_VALUE[stat.tone])}>
          {stat.value}
        </p>
        <p className="mt-1 truncate text-[10px] font-semibold text-foreground/65">{stat.label}</p>
      </div>
    </Wrapper>
  );
}

interface MobileQuickActionsProps {
  actions: { label: string; to: string; icon: LucideIcon; primary?: boolean }[];
  onNavigate: (to: string) => void;
}

export function MobileQuickActions({ actions, onNavigate }: MobileQuickActionsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.label}
            type="button"
            onClick={() => onNavigate(action.to)}
            className={cn(
              "flex min-w-[88px] shrink-0 flex-col items-center gap-2 rounded-[16px] border px-3 py-3 transition-all active:scale-95",
              action.primary
                ? "border-primary/30 bg-primary text-primary-foreground shadow-md shadow-primary/20"
                : "border-border/60 bg-card text-foreground",
            )}
          >
            <span
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-2xl",
                action.primary ? "bg-primary-foreground/15" : "bg-primary/10 text-primary",
              )}
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className="text-center text-[11px] font-semibold leading-tight">{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}
