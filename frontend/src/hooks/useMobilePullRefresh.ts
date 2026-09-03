import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { NOTIFICATIONS_UPDATED } from "@/lib/notifications-events";

/** Hook for pages to reload on pull-to-refresh */
export function useMobilePullRefresh(callback: () => void | Promise<void>) {
  useEffect(() => {
    const handler = () => {
      void callback();
    };
    window.addEventListener("mobile-pull-refresh", handler);
    return () => window.removeEventListener("mobile-pull-refresh", handler);
  }, [callback]);
}

/** Shared unread notifications count for mobile headers */
export function useMobileUnreadCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const { count: c } = await api.getNotificationsUnreadCount();
        setCount(c);
      } catch {
        setCount(0);
      }
    };
    void load();
    const onUpdated = () => void load();
    window.addEventListener(NOTIFICATIONS_UPDATED, onUpdated);
    return () => window.removeEventListener(NOTIFICATIONS_UPDATED, onUpdated);
  }, []);

  return count;
}
