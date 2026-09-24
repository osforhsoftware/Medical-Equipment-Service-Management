import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, LogOut, PanelLeft, PanelLeftClose, Search, Settings, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MesmsLogo } from "@/components/shared/MesmsLogo";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { useAuth } from "@/context/AuthContext";
import { navItems } from "@/config/nav";
import { userCanAccessModule } from "@/lib/userRoles";
import { useSettings } from "@/context/SettingsContext";
import { api } from "@/lib/api";
import { NOTIFICATIONS_UPDATED } from "@/lib/notifications-events";

const SETTINGS_NAV = navItems.find((item) => item.label === "Settings");

export function Topbar({
  sidebarOpen,
  onToggleSidebar,
}: {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}) {
  const { user, logout } = useAuth();
  const { settings, rbacMatrix } = useSettings();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  // Same RBAC check as sidebar / ModuleGuard — hide Settings for staff who would only see Access restricted.
  const canOpenSettings = user
    ? userCanAccessModule(user, "Settings", rbacMatrix, SETTINGS_NAV?.roles)
    : false;

  const loadUnreadCount = async () => {
    try {
      const { count } = await api.getNotificationsUnreadCount();
      setUnread(count);
    } catch {
      setUnread(0);
    }
  };

  useEffect(() => {
    if (!user) return;
    void loadUnreadCount();

    const onUpdated = () => {
      void loadUnreadCount();
    };
    window.addEventListener(NOTIFICATIONS_UPDATED, onUpdated);
    return () => window.removeEventListener(NOTIFICATIONS_UPDATED, onUpdated);
  }, [user]);

  if (!user) return null;

  return (
    <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card px-4 lg:px-6">
      <button
        onClick={onToggleSidebar}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={sidebarOpen ? "Hide navigation" : "Show navigation"}
        title={sidebarOpen ? "Hide sidebar (Ctrl+B)" : "Show sidebar (Ctrl+B)"}
      >
        {sidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeft className="h-5 w-5" />}
      </button>

      {!sidebarOpen && (
        <div className="flex items-center">
          <MesmsLogo size="xs" variant="horizontal" customLogoUrl={settings?.logoUrl} />
        </div>
      )}

      <div className="relative hidden max-w-md flex-1 md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const q = searchQuery.trim();
            navigate(q ? `/app/service-tickets?search=${encodeURIComponent(q)}` : "/app/service-tickets");
          }}
        >
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tickets, equipment, customers…"
            className="h-9 border-border bg-background pl-9 pr-10 text-[13px] shadow-none"
          />
        </form>
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
          /
        </kbd>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />

        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 text-muted-foreground"
          onClick={() => navigate("/app/notifications")}
          aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
        >
          <Bell className="h-[18px] w-[18px]" strokeWidth={1.75} />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="ml-1 flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white ring-2 ring-border"
              style={{ backgroundColor: `hsl(${user.avatarColor})` }}
              aria-label="Open user menu"
            >
              {user.name.charAt(0)}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="text-sm font-medium">{user.name}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/app/profile")}>
              <User className="mr-2 h-4 w-4" /> Profile
            </DropdownMenuItem>
            {canOpenSettings ? (
              <DropdownMenuItem onClick={() => navigate("/app/settings")}>
                <Settings className="mr-2 h-4 w-4" /> Settings
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem
              onClick={() => {
                void logout().then(() => navigate("/login"));
              }}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
