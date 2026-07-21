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
  primary: "bg-primary/10 text-primary",
  accent: "bg-accent/10 text-accent",
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-warning-foreground",
  destructive: "bg-destructive/10 text-destructive",
};

export function StatCard({ label, value, icon: Icon, trend, accent = "primary" }: StatCardProps) {
  return (
    <Card className="flex items-center gap-4 p-5 shadow-card transition-shadow hover:shadow-elevated">
      <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", accentBg[accent])}>
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
