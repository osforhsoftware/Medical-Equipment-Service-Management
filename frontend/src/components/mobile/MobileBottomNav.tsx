import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { getMobileNavTabs, isMobileTabActive } from "@/config/mobileNav";
import { useMobileUnreadCount } from "@/hooks/useMobilePullRefresh";
import { getUserRoles } from "@/lib/userRoles";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { rbacMatrix } = useSettings();
  const unreadCount = useMobileUnreadCount();

  if (!user) return null;

  const tabs = getMobileNavTabs(getUserRoles(user), rbacMatrix);

  return (
    <nav className="mobile-bottom-nav" aria-label="Main navigation">
      <div className="mobile-bottom-nav-inner">
        {tabs.map((tab) => {
          const active = isMobileTabActive(location.pathname, tab.to);
          const Icon = tab.icon;
          const showBadge = tab.id === "alerts" && unreadCount > 0;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => navigate(tab.to)}
              className={cn(
                "mobile-nav-item",
                active && "mobile-nav-item-active",
              )}
              aria-current={active ? "page" : undefined}
              aria-label={showBadge ? `${tab.label}, ${unreadCount} unread` : tab.label}
            >
              <span
                className={cn(
                  "relative flex h-11 w-11 items-center justify-center rounded-2xl transition-all duration-200",
                  active
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                    : "text-muted-foreground",
                )}
              >
                <Icon className="h-6 w-6" strokeWidth={active ? 2.25 : 1.75} />
                {showBadge && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "text-[10px] font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
