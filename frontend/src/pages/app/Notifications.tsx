import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  FileCheck,
  Inbox,
  Loader2,
  Settings as Cog,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api, type BackendNotification } from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";
import { emitNotificationsUpdated } from "@/lib/notifications-events";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type NotificationType = BackendNotification["type"];
type FilterKey = "all" | "unread" | NotificationType;

const iconMap: Record<NotificationType, typeof Bell> = {
  amc: ShieldCheck,
  stock: AlertTriangle,
  approval: FileCheck,
  job: Wrench,
  system: Cog,
};

const typeLabel: Record<NotificationType, string> = {
  amc: "AMC",
  stock: "Low stock",
  approval: "Approval",
  job: "Job",
  system: "System",
};

const toneMap: Record<
  NotificationType,
  { icon: string; badge: string; unreadBar: string; unreadBg: string }
> = {
  amc: {
    icon: "bg-info/10 text-info ring-info/20",
    badge: "border-info/25 bg-info/10 text-info",
    unreadBar: "bg-info",
    unreadBg: "bg-info/[0.04]",
  },
  stock: {
    icon: "bg-warning/15 text-warning-foreground ring-warning/25",
    badge: "border-warning/30 bg-warning/10 text-warning-foreground",
    unreadBar: "bg-warning",
    unreadBg: "bg-warning/[0.06]",
  },
  approval: {
    icon: "bg-success/10 text-success ring-success/20",
    badge: "border-success/25 bg-success/10 text-success",
    unreadBar: "bg-success",
    unreadBg: "bg-success/[0.04]",
  },
  job: {
    icon: "bg-accent/10 text-accent ring-accent/20",
    badge: "border-accent/25 bg-accent/10 text-accent",
    unreadBar: "bg-accent",
    unreadBg: "bg-accent/[0.04]",
  },
  system: {
    icon: "bg-muted text-muted-foreground ring-border",
    badge: "border-border bg-muted text-muted-foreground",
    unreadBar: "bg-primary",
    unreadBg: "bg-primary/[0.03]",
  },
};

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "stock", label: "Low stock" },
  { key: "approval", label: "Approvals" },
  { key: "job", label: "Jobs" },
  { key: "amc", label: "AMC" },
  { key: "system", label: "System" },
];

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function groupLabel(createdAt: string, now = new Date()): string {
  const day = startOfDay(new Date(createdAt));
  const today = startOfDay(now);
  const yesterday = today - 86_400_000;
  const weekAgo = today - 6 * 86_400_000;

  if (day === today) return "Today";
  if (day === yesterday) return "Yesterday";
  if (day >= weekAgo) return "Earlier this week";
  return "Older";
}

const GROUP_ORDER = ["Today", "Yesterday", "Earlier this week", "Older"] as const;

export default function Notifications() {
  const [items, setItems] = useState<BackendNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listNotifications();
      setItems(data);
    } catch (err) {
      toast.apiError(err, { fallback: "Failed to load notifications" });
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const typeCounts = useMemo(() => {
    const counts: Record<NotificationType, number> = {
      amc: 0,
      stock: 0,
      approval: 0,
      job: 0,
      system: 0,
    };
    for (const item of items) counts[item.type] += 1;
    return counts;
  }, [items]);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "unread") return items.filter((n) => !n.read);
    return items.filter((n) => n.type === filter);
  }, [items, filter]);

  const groups = useMemo(() => {
    const buckets = new Map<string, BackendNotification[]>();
    for (const item of filtered) {
      const label = groupLabel(item.createdAt);
      const list = buckets.get(label) ?? [];
      list.push(item);
      buckets.set(label, list);
    }
    return GROUP_ORDER.filter((label) => buckets.has(label)).map((label) => ({
      label,
      items: buckets.get(label) ?? [],
    }));
  }, [filtered]);

  const markRead = async (id: string) => {
    const target = items.find((n) => n.id === id);
    if (!target || target.read) return;

    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await api.markNotificationRead(id);
      emitNotificationsUpdated();
    } catch (err) {
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: false } : n)));
      toast.apiError(err, { fallback: "Failed to mark notification as read" });
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
      toast.apiError(err, { fallback: "Failed to mark all as read" });
    } finally {
      setMarkingAll(false);
    }
  };

  const filterCount = (key: FilterKey) => {
    if (key === "all") return items.length;
    if (key === "unread") return unreadCount;
    return typeCounts[key];
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
        description="Low-stock alerts, approvals and job updates."
        icon={<Bell className="h-5 w-5" />}
        actions={
          items.length > 0 ? (
            <Button
              variant="outline"
              onClick={() => void markAll()}
              disabled={markingAll || unreadCount === 0}
            >
              {markingAll ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <CheckCheck className="mr-1 h-4 w-4" />
              )}
              Mark all read
              {unreadCount > 0 ? (
                <Badge variant="secondary" className="ml-2 tabular-nums">
                  {unreadCount}
                </Badge>
              ) : null}
            </Button>
          ) : undefined
        }
      />

      {items.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryTile
            label="Unread"
            value={unreadCount}
            hint={unreadCount === 0 ? "You're caught up" : "Needs attention"}
            accent="primary"
          />
          <SummaryTile
            label="Low stock"
            value={typeCounts.stock}
            hint="Inventory alerts"
            accent="warning"
          />
          <SummaryTile
            label="Approvals & jobs"
            value={typeCounts.approval + typeCounts.job}
            hint="Workflow updates"
            accent="success"
          />
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => {
            const count = filterCount(item.key);
            if (item.key !== "all" && item.key !== "unread" && count === 0) return null;
            const active = filter === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {item.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                    active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      <Card className="overflow-hidden shadow-card">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              {items.length === 0 ? (
                <Bell className="h-5 w-5 text-muted-foreground" />
              ) : (
                <Inbox className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {items.length === 0 ? "You're all caught up" : "No notifications in this filter"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {items.length === 0
                  ? "New stock alerts, approvals, and job updates will show up here."
                  : "Try another filter to review the rest of your inbox."}
              </p>
            </div>
            {items.length > 0 && filter !== "all" ? (
              <Button variant="outline" size="sm" onClick={() => setFilter("all")}>
                Show all
              </Button>
            ) : null}
          </div>
        ) : (
          groups.map((group) => (
            <section key={group.label} aria-label={group.label}>
              <div className="sticky top-0 z-[1] flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2 backdrop-blur-sm">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </h2>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {group.items.length}
                </span>
              </div>
              <ul className="divide-y divide-border">
                {group.items.map((n) => {
                  const Icon = iconMap[n.type];
                  const tone = toneMap[n.type];
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => void markRead(n.id)}
                        className={cn(
                          "group relative flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/35",
                          !n.read && tone.unreadBg,
                        )}
                      >
                        {!n.read ? (
                          <span
                            aria-hidden
                            className={cn("absolute inset-y-0 left-0 w-0.5", tone.unreadBar)}
                          />
                        ) : null}

                        <div
                          className={cn(
                            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
                            tone.icon,
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p
                              className={cn(
                                "truncate text-sm text-foreground",
                                !n.read ? "font-semibold" : "font-medium",
                              )}
                            >
                              {n.title}
                            </p>
                            <span
                              className={cn(
                                "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                                tone.badge,
                              )}
                            >
                              {typeLabel[n.type]}
                            </span>
                            {!n.read ? (
                              <span className="inline-flex items-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                                New
                              </span>
                            ) : null}
                          </div>
                          {n.body?.trim() ? (
                            <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{n.body}</p>
                          ) : null}
                        </div>

                        <time
                          dateTime={n.createdAt}
                          className="shrink-0 pt-0.5 text-[11px] tabular-nums text-muted-foreground"
                          title={new Date(n.createdAt).toLocaleString()}
                        >
                          {formatRelativeTime(n.createdAt)}
                        </time>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </Card>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: number;
  hint: string;
  accent: "primary" | "warning" | "success";
}) {
  const accentClass =
    accent === "warning"
      ? "border-warning/25 bg-warning/[0.06]"
      : accent === "success"
        ? "border-success/25 bg-success/[0.05]"
        : "border-primary/20 bg-primary/[0.04]";

  const valueClass =
    accent === "warning"
      ? "text-warning-foreground"
      : accent === "success"
        ? "text-success"
        : "text-primary";

  return (
    <div className={cn("rounded-xl border px-4 py-3", accentClass)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums tracking-tight", valueClass)}>{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}
