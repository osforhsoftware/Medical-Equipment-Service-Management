import { useEffect, useState, type ReactNode } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileFAB } from "./MobileFAB";
import { MobileMoreSheet } from "./MobileMoreSheet";
import { canCreateFromMobileFab } from "@/config/mobileNav";
import { getUserRoles } from "@/lib/userRoles";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { api } from "@/lib/api";
import type { Role } from "@/data/types";
import { NOTIFICATIONS_UPDATED } from "@/lib/notifications-events";
import { cn } from "@/lib/utils";

interface MobileLayoutProps {
  children?: ReactNode;
}

const FAB_ROUTES: Record<string, { icon: "plus" | "scan"; action: string }> = {
  "/app/qr-tracking": { icon: "scan", action: "scan" },
};

function resolveFab(pathname: string, canCreate: boolean) {
  if (pathname.startsWith("/app/jobs/")) return null;
  if (pathname.startsWith("/app/qr-tracking")) return FAB_ROUTES["/app/qr-tracking"];
  if (canCreate && (pathname === "/app" || pathname === "/app/" || pathname.startsWith("/app/jobs"))) {
    return { icon: "plus" as const, action: "create-request" };
  }
  return null;
}

export function MobileLayout({ children }: MobileLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { rbacMatrix } = useSettings();
  const [moreOpen, setMoreOpen] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const canCreate = user
    ? canCreateFromMobileFab(getUserRoles(user), rbacMatrix)
    : false;
  const fab = resolveFab(location.pathname, canCreate);
  const showFab = fab && !location.pathname.startsWith("/app/profile");

  const handleFab = () => {
    if (fab?.action === "scan") return;
    navigate("/app/service-tickets");
  };

  // Pull-to-refresh visual cue
  useEffect(() => {
    let startY = 0;
    let currentPull = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) startY = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (startY && window.scrollY === 0) {
        currentPull = Math.min(80, Math.max(0, e.touches[0].clientY - startY));
        setPullDistance(currentPull);
      }
    };
    const onTouchEnd = () => {
      if (currentPull > 60) {
        setRefreshing(true);
        window.dispatchEvent(new CustomEvent("mobile-pull-refresh"));
        setTimeout(() => {
          setRefreshing(false);
          setPullDistance(0);
        }, 800);
      } else {
        setPullDistance(0);
      }
      startY = 0;
      currentPull = 0;
    };
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  return (
    <div className="mobile-shell">
      {(pullDistance > 0 || refreshing) && (
        <div
          className="pointer-events-none fixed left-0 right-0 top-0 z-50 flex justify-center pt-safe"
          style={{ transform: `translateY(${Math.min(pullDistance, 60)}px)` }}
        >
          <span className="rounded-full bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-card">
            {refreshing ? "Refreshing…" : "Pull to refresh"}
          </span>
        </div>
      )}

      <main className={cn("mobile-main animate-fade-in", showFab && "mobile-main-with-fab")}>
        {children ?? <Outlet />}
      </main>

      {showFab && <MobileFAB onClick={handleFab} icon={fab!.icon} />}

      <MobileBottomNav />
      <MobileMoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </div>
  );
}

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
