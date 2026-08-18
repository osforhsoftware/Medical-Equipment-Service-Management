import type { BackendNotification } from "@/lib/api";

const IMPORTANT_TYPES = new Set<BackendNotification["type"]>(["stock", "approval", "job", "amc"]);

const CRITICAL_KEYWORDS = /critical|urgent|overdue|assigned|low stock|expiring|approval|work assigned/i;

/** Unread notifications that staff should see immediately on mobile. */
export function isImportantNotification(n: BackendNotification): boolean {
  if (n.read) return false;
  if (IMPORTANT_TYPES.has(n.type)) return true;
  if (n.type === "system" && CRITICAL_KEYWORDS.test(`${n.title} ${n.body}`)) return true;
  return false;
}

const TYPE_PRIORITY: Record<BackendNotification["type"], number> = {
  stock: 0,
  job: 1,
  approval: 2,
  amc: 3,
  system: 4,
};

export function sortNotificationsByImportance(items: BackendNotification[]): BackendNotification[] {
  return [...items].sort((a, b) => {
    const pa = TYPE_PRIORITY[a.type] ?? 5;
    const pb = TYPE_PRIORITY[b.type] ?? 5;
    if (pa !== pb) return pa - pb;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function getImportantNotifications(items: BackendNotification[], limit = 3): BackendNotification[] {
  return sortNotificationsByImportance(items.filter(isImportantNotification)).slice(0, limit);
}

export function countImportantUnread(items: BackendNotification[]): number {
  return items.filter(isImportantNotification).length;
}
