import { NavLink, useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { MesmsLogo } from "@/components/shared/MesmsLogo";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { navGroups, navItems } from "@/config/nav";
import { roleLabels } from "@/data/mock";

interface AppSidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

export function AppSidebar({ mobileOpen, onClose }: AppSidebarProps) {
  const { user } = useAuth();
  const { rbacMatrix } = useSettings();
  const { pathname } = useLocation();
  if (!user) return null;

  const visible = navItems.filter((item) => {
    const roles = rbacMatrix[item.label] ?? item.roles;
    return roles.includes(user.role);
  });

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-300 lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-5 bg-white">
   
          <MesmsLogo size="md" />
          <button onClick={onClose} className="text-sidebar-foreground/70 lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {navGroups.map((group) => {
            const items = visible.filter((i) => i.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group}>
                <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">
                  {group}
                </p>
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const active = item.to === "/app" ? pathname === "/app" : pathname.startsWith(item.to);
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={onClose}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          active
                            ? "bg-sidebar-primary/15 text-sidebar-primary"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        )}
                      >
                        <item.icon className="h-[18px] w-[18px] shrink-0" />
                        {item.label}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent px-3 py-2.5">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
              style={{ backgroundColor: `hsl(${user.avatarColor})` }}
            >
              {user.name.charAt(0)}
            </div>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-medium text-sidebar-accent-foreground">{user.name}</p>
              <p className="truncate text-xs text-sidebar-foreground/60">{roleLabels[user.role]}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
