import { Bell, Plus, Search } from "lucide-react";
import { MesmsLogo } from "@/components/shared/MesmsLogo";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { roleLabels } from "@/data/mock";

interface MobileHeaderProps {
  greeting?: string;
  title: string;
  subtitle?: string;
  badge?: string;
  unreadCount?: number;
  onNotifications?: () => void;
  onSearch?: () => void;
  onQuickAction?: () => void;
  quickActionLabel?: string;
  className?: string;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

export function MobileHeader({
  greeting,
  title,
  subtitle,
  badge,
  unreadCount = 0,
  onNotifications,
  onSearch,
  onQuickAction,
  quickActionLabel,
  className,
}: MobileHeaderProps) {
  const { user } = useAuth();
  const displayGreeting = greeting ?? getGreeting();

  return (
    <header className={cn("mobile-header", className)}>
      <div className="mb-3 flex items-center">
        <div className="px-1 py-0.5">
          <MesmsLogo size="xs" />
        </div>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-muted-foreground">{displayGreeting}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
          {badge && (
            <p className="mt-1 text-xs font-semibold text-primary">{badge}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {onSearch && (
            <button type="button" onClick={onSearch} className="mobile-icon-btn" aria-label="Search">
              <Search className="h-5 w-5" />
            </button>
          )}
          {onQuickAction && (
            <button
              type="button"
              onClick={onQuickAction}
              className="mobile-icon-btn bg-primary text-primary-foreground hover:bg-primary/90"
              aria-label={quickActionLabel ?? "Quick action"}
            >
              <Plus className="h-5 w-5" />
            </button>
          )}
          {onNotifications && (
            <button
              type="button"
              onClick={onNotifications}
              className="mobile-icon-btn relative"
              aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          )}
          {user && (
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm"
              style={{ backgroundColor: `hsl(${user.avatarColor})` }}
              aria-label={`${user.name}, ${roleLabels[user.role]}`}
            >
              {user.name.charAt(0)}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
