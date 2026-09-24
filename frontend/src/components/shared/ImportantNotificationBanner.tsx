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
  notification: BackendNotification;
  onDismiss: (id: string) => void;
  onOpen: (id: string) => void;
}

export function ImportantNotificationBanner({
  notification,
  onDismiss,
  onOpen,
}: ImportantNotificationBannerProps) {
  const Icon = iconMap[notification.type] ?? Bell;

  return (
    <div
      role="alert"
      className={cn(
        "relative flex items-start gap-3 rounded-lg border px-4 py-3 shadow-sm",
        toneMap[notification.type],
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          iconToneMap[notification.type],
        )}
      >
        <Icon className="h-4 w-4" />
      </span>

      <button
        type="button"
        onClick={() => onOpen(notification.id)}
        className="min-w-0 flex-1 text-left"
      >
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-foreground">{notification.title}</p>
          <Badge variant="outline" className="text-[10px]">
            {typeLabel[notification.type]}
          </Badge>
          {!notification.read ? (
            <Badge variant="secondary" className="text-[10px]">
              New
            </Badge>
          ) : null}
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{notification.body}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {formatRelativeTime(notification.createdAt)}
        </p>
      </button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
        aria-label="Dismiss important notification"
        onClick={() => onDismiss(notification.id)}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
