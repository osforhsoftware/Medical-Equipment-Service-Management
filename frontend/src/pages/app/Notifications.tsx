import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck, ShieldCheck, AlertTriangle, FileCheck, Wrench, Settings as Cog, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api";
import { api, type BackendNotification } from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";
import { emitNotificationsUpdated } from "@/lib/notifications-events";
import { toast } from "@/hooks/use-toast";

const iconMap = {
  amc: ShieldCheck,
  stock: AlertTriangle,
  approval: FileCheck,
  job: Wrench,
  system: Cog,
};

const toneMap = {
  amc: "bg-info/10 text-info",
  stock: "bg-warning/15 text-warning-foreground",
  approval: "bg-success/10 text-success",
  job: "bg-accent/10 text-accent",
  system: "bg-muted text-muted-foreground",
};

export default function Notifications() {
  const [items, setItems] = useState<BackendNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listNotifications();
      setItems(data);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to load notifications";
      toast({ title: "Error", description: message, variant: "destructive" });
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const markRead = async (id: string) => {
    const target = items.find((n) => n.id === id);
    if (!target || target.read) return;

    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await api.markNotificationRead(id);
      emitNotificationsUpdated();
    } catch (err) {
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: false } : n)));
      const message = err instanceof ApiError ? err.message : "Failed to mark notification as read";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const markAll = async () => {
    if (items.every((n) => n.read)) return;

    setMarkingAll(true);
    const previous = items;
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await api.markAllNotificationsRead();
      emitNotificationsUpdated();
    } catch (err) {
      setItems(previous);
      const message = err instanceof ApiError ? err.message : "Failed to mark all as read";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setMarkingAll(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading notifications…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="AMC reminders, low-stock alerts, approvals and job updates."
        actions={
          items.length > 0 ? (
            <Button variant="outline" onClick={() => void markAll()} disabled={markingAll || items.every((n) => n.read)}>
              <CheckCheck className="mr-1 h-4 w-4" /> Mark all read
            </Button>
          ) : undefined
        }
      />
      <Card className="divide-y divide-border shadow-card">
        {items.map((n) => {
          const Icon = iconMap[n.type];
          return (
            <button
              key={n.id}
              onClick={() => void markRead(n.id)}
              className={cn("flex w-full items-start gap-4 p-4 text-left transition-colors hover:bg-muted/40", !n.read && "bg-primary/[0.03]")}
            >
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", toneMap[n.type])}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{n.title}</p>
                  {!n.read && <span className="h-2 w-2 rounded-full bg-primary" />}
                </div>
                <p className="text-sm text-muted-foreground">{n.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatRelativeTime(n.createdAt)}</p>
              </div>
            </button>
          );
        })}
        {items.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <Bell className="h-8 w-8" />
            <p className="text-sm">You're all caught up.</p>
          </div>
        )}
      </Card>
    </div>
  );
}
