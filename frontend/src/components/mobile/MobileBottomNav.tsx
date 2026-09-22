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

  const tabs = getMobileNavTabs(getUserRoles(user), rbacMatrix, user);

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
                "mobile-nav-item py-1",
                active && "mobile-nav-item-active",
              )}
              aria-current={active ? "page" : undefined}
              aria-label={showBadge ? `${tab.label}, ${unreadCount} unread` : tab.label}
            >
              <span
                className={cn(
                  "relative flex h-10 w-12 items-center justify-center rounded-2xl transition-all duration-200",
                  active
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/25 scale-105"
                    : "text-muted-foreground hover:bg-muted/50",
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 1.8} />
                {showBadge && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-extrabold text-destructive-foreground animate-pulse border border-background">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "text-[10px] tracking-tight transition-colors",
                  active ? "text-primary font-bold" : "text-muted-foreground font-semibold",
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
