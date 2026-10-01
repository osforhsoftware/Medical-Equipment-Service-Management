import {
  AlertTriangle,
  Bell,
  FileCheck,
  Settings as Cog,
  ShieldCheck,
  Wrench,
  X,
} from "lucide-react";
import type { BackendNotification } from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const iconMap = {
  amc: ShieldCheck,
  stock: AlertTriangle,
  approval: FileCheck,
  job: Wrench,
  system: Cog,
} as const;

const typeLabel = {
  amc: "AMC",
  stock: "Low stock",
  approval: "Approval",
  job: "Job",
  system: "System",
} as const;

const toneMap = {
  amc: "border-info/35 bg-info/10",
  stock: "border-warning/40 bg-warning/10",
  approval: "border-success/35 bg-success/10",
  job: "border-accent/35 bg-accent/10",
  system: "border-destructive/35 bg-destructive/10",
} as const;

const iconToneMap = {
  amc: "bg-info/15 text-info",
  stock: "bg-warning/20 text-warning-foreground",
  approval: "bg-success/15 text-success",
  job: "bg-accent/15 text-accent",
  system: "bg-destructive/15 text-destructive",
} as const;

interface ImportantNotificationBannerProps {
  notifications: BackendNotification[];
  onDismiss: (id: string) => void;
  onOpen: (id: string) => void;
}

export function ImportantNotificationBanner({
  notifications,
  onDismiss,
  onOpen,
}: ImportantNotificationBannerProps) {
  if (notifications.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Recent notifications"
      className="max-h-[7.25rem] space-y-1.5 overflow-y-auto pr-0.5"
    >
      {notifications.map((notification) => {
        const Icon = iconMap[notification.type] ?? Bell;
        return (
          <div
            key={notification.id}
            role="alert"
            className={cn(
              "flex items-center gap-2.5 rounded-lg border px-3 py-2 shadow-sm",
              toneMap[notification.type],
            )}
          >
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                iconToneMap[notification.type],
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>

            <button
              type="button"
              onClick={() => onOpen(notification.id)}
              className="min-w-0 flex-1 text-left"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-sm font-semibold leading-tight text-foreground">
                  {notification.title}
                </p>
                <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                  {typeLabel[notification.type]}
                </Badge>
                {!notification.read ? (
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                    New
                  </Badge>
                ) : null}
                <span className="text-[11px] text-muted-foreground">
                  {formatRelativeTime(notification.createdAt)}
                </span>
              </div>
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{notification.body}</p>
            </button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
              aria-label={`Dismiss ${notification.title}`}
              onClick={() => onDismiss(notification.id)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
