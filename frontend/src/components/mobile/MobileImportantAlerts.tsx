import {
  AlertTriangle,
  Bell,
  ChevronRight,
  FileCheck,
  ShieldCheck,
  Wrench,
  Settings as Cog,
} from "lucide-react";
import type { BackendNotification } from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const iconMap = {
  amc: ShieldCheck,
  stock: AlertTriangle,
  approval: FileCheck,
  job: Wrench,
  system: Cog,
} as const;

const toneMap = {
  amc: "border-info/30 bg-info/8 text-info",
  stock: "border-warning/35 bg-warning/10 text-warning-foreground",
  approval: "border-success/30 bg-success/8 text-success",
  job: "border-accent/30 bg-accent/8 text-accent",
  system: "border-destructive/30 bg-destructive/8 text-destructive",
} as const;

interface MobileImportantAlertsProps {
  alerts: BackendNotification[];
  totalUnread: number;
  onOpenAlert: (id: string) => void;
  onViewAll: () => void;
}

export function MobileImportantAlerts({
  alerts,
  totalUnread,
  onOpenAlert,
  onViewAll,
}: MobileImportantAlertsProps) {
  if (alerts.length === 0 && totalUnread === 0) return null;

  return (
    <section className="mt-4" aria-label="Important alerts">
      <div className="mb-2 flex items-center justify-between px-0.5">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Important Alerts
          </h2>
          {totalUnread > 0 && (
            <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground">
              {totalUnread}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onViewAll}
          className="text-xs font-semibold text-primary"
        >
          View all
        </button>
      </div>

      <div className="space-y-2">
        {alerts.length === 0 ? (
          <button
            type="button"
            onClick={onViewAll}
            className="flex w-full items-center gap-3 rounded-[16px] border border-primary/25 bg-primary/5 px-4 py-3 text-left active:scale-[0.99]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Bell className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                {totalUnread} unread notification{totalUnread !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-muted-foreground">Tap to review your alerts</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        ) : (
          alerts.map((alert) => {
            const Icon = iconMap[alert.type];
            return (
              <button
                key={alert.id}
                type="button"
                onClick={() => onOpenAlert(alert.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-[16px] border px-4 py-3 text-left active:scale-[0.99]",
                  toneMap[alert.type],
                )}
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-background/60">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug">{alert.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs opacity-90">{alert.body}</p>
                  <p className="mt-1 text-[10px] font-medium opacity-75">
                    {formatRelativeTime(alert.createdAt)}
                  </p>
                </div>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 opacity-60" />
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
