import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: { value: string; up: boolean };
  accent?: "primary" | "accent" | "success" | "warning" | "destructive";
}

const accentBg: Record<NonNullable<StatCardProps["accent"]>, string> = {
  primary: "from-primary/20 to-info/8 text-primary border-primary/15",
  accent: "from-accent/20 to-accent/5 text-accent border-accent/15",
  success: "from-success/20 to-success/5 text-success border-success/15",
  warning: "from-warning/25 to-warning/5 text-warning-foreground border-warning/20",
  destructive: "from-destructive/20 to-destructive/5 text-destructive border-destructive/15",
};

export function StatCard({ label, value, icon: Icon, trend, accent = "primary" }: StatCardProps) {
  return (
    <Card className="group relative flex items-center gap-4 overflow-hidden p-5 shadow-card hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-elevated">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-primary opacity-70" />
      <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border bg-gradient-to-br shadow-sm transition-transform group-hover:scale-105", accentBg[accent])}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm text-muted-foreground">{label}</p>
        <div className="flex items-baseline gap-2">
          <span className="font-display text-2xl font-bold text-foreground">{value}</span>
          {trend && (
            <span
              className={cn(
                "flex items-center text-xs font-medium",
                trend.up ? "text-success" : "text-destructive",
              )}
            >
              {trend.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {trend.value}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
