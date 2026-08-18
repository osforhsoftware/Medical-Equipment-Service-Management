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

const accentIcon: Record<NonNullable<StatCardProps["accent"]>, string> = {
  primary: "bg-primary-light text-primary",
  accent: "bg-[hsl(var(--info-light))] text-info",
  success: "bg-[hsl(var(--success-light))] text-success",
  warning: "bg-[hsl(var(--warning-light))] text-warning-foreground",
  destructive: "bg-destructive/10 text-destructive",
};

export function StatCard({ label, value, icon: Icon, trend, accent = "primary" }: StatCardProps) {
  return (
    <Card className="flex items-start justify-between gap-3 p-5">
      <div className="min-w-0">
        <p className="text-[13px] text-muted-foreground">{label}</p>
        <p className="mt-1.5 text-[1.65rem] font-semibold leading-none tracking-tight text-foreground">{value}</p>
        {trend && (
          <p
            className={cn(
              "mt-2 flex items-center gap-0.5 text-xs font-medium",
              trend.up ? "text-success" : "text-destructive",
            )}
          >
            {trend.up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
            {trend.value}
            <span className="font-normal text-muted-foreground"> vs last month</span>
          </p>
        )}
      </div>
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md", accentIcon[accent])}>
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </div>
    </Card>
  );
}
