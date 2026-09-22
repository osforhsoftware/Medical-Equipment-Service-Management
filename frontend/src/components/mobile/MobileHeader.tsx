import { Bell, Plus, QrCode, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MesmsLogo } from "@/components/shared/MesmsLogo";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { roleLabels } from "@/data/mock";

interface MobileHeaderProps {
  greeting?: string;
  title: string;
  subtitle?: string;
  badge?: string;
  unreadCount?: number;
  onNotifications?: () => void;
  onSearch?: () => void;
  onScan?: () => void;
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
  onScan,
  onQuickAction,
  quickActionLabel,
  className,
}: MobileHeaderProps) {
  const { user } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const displayGreeting = greeting ?? getGreeting();

  return (
    <header className={cn("mobile-header", className)}>
      {/* Brand + actions share one compact row */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 shrink">
          <MesmsLogo size="xs" variant="horizontal" customLogoUrl={settings?.logoUrl} />
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {onScan && (
            <button
              type="button"
              onClick={onScan}
              className="mobile-icon-btn h-10 w-10 border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
              aria-label="Scan QR Code"
              title="Scan QR Code"
            >
              <QrCode className="h-[18px] w-[18px]" />
            </button>
          )}
          {onSearch && (
            <button type="button" onClick={onSearch} className="mobile-icon-btn h-10 w-10" aria-label="Search">
              <Search className="h-[18px] w-[18px]" />
            </button>
          )}
          {onQuickAction && (
            <button
              type="button"
              onClick={onQuickAction}
              className="mobile-icon-btn h-10 w-10 border-primary bg-primary text-primary-foreground hover:bg-primary/90"
              aria-label={quickActionLabel ?? "Quick action"}
            >
              <Plus className="h-[18px] w-[18px]" />
            </button>
          )}
          {onNotifications && (
            <button
              type="button"
              onClick={onNotifications}
              className="mobile-icon-btn relative h-10 w-10"
              aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
            >
              <Bell className="h-[18px] w-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground animate-pulse">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          )}
          {user && (
            <button
              type="button"
              onClick={() => navigate("/app/profile")}
              className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm transition-transform active:scale-95 ring-2 ring-background"
              style={{ backgroundColor: `hsl(${user.avatarColor})` }}
              aria-label={`${user.name}, ${roleLabels[user.role]}. Open profile`}
            >
              {user.name.charAt(0)}
            </button>
          )}
        </div>
      </div>

      {/* Greeting + identity — full width, no side collision with buttons */}
      <div className="mt-2.5 min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{displayGreeting}</p>
        <h1 className="mt-0.5 truncate text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {(subtitle || badge) && (
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            {subtitle && <p className="text-sm font-medium text-muted-foreground">{subtitle}</p>}
            {badge && (
              <span className="inline-flex max-w-full items-center truncate rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary border border-primary/20">
                {badge}
              </span>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

