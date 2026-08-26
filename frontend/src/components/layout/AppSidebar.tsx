import { NavLink, useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { MesmsLogo } from "@/components/shared/MesmsLogo";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { navGroups, navItems } from "@/config/nav";
import { userCanAccessModule } from "@/lib/userRoles";

interface AppSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function AppSidebar({ open, onClose }: AppSidebarProps) {
  const { user } = useAuth();
  const { rbacMatrix } = useSettings();
  const { pathname } = useLocation();
  if (!user) return null;

  const visible = navItems.filter((item) => userCanAccessModule(user, item.label, rbacMatrix, item.roles));
  const closeIfOverlay = () => {
    if (window.matchMedia("(max-width: 1023px)").matches) onClose();
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-foreground/30 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={cn(
          "no-print fixed inset-y-0 left-0 z-50 flex w-[240px] flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200",
          open ? "translate-x-0 lg:static" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-sidebar-border px-4">
          <MesmsLogo size="md" />
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Hide navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {navGroups.map((group) => {
            const items = visible.filter((i) => i.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group}>
                <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
                  {group}
                </p>
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const active = item.to === "/app" ? pathname === "/app" : pathname.startsWith(item.to);
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={closeIfOverlay}
                        className={cn(
                          "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors",
                          active
                            ? "bg-sidebar-accent text-sidebar-primary"
                            : "text-sidebar-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                        <span className="truncate">{item.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2.5 rounded-md px-2 py-2">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: `hsl(${user.avatarColor})` }}
            >
              {user.name.charAt(0)}
            </div>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[13px] font-medium text-foreground">{user.name}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
