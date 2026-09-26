import { NavLink, useLocation } from "react-router-dom";
import { ChevronDown, X } from "lucide-react";
import { useEffect, useState } from "react";
import { MesmsLogo } from "@/components/shared/MesmsLogo";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { navGroups, navItems, type NavItem } from "@/config/nav";
import { userCanAccessModule } from "@/lib/userRoles";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface AppSidebarProps {
  open: boolean;
  onClose: () => void;
}

function pathMatches(itemTo: string, pathname: string, search: string) {
  if (itemTo === "/app") return pathname === "/app";
  const [path, query = ""] = itemTo.split("?");
  if (!(pathname === path || pathname.startsWith(`${path}/`))) return false;
  if (!query) return true;
  const want = new URLSearchParams(query);
  const have = new URLSearchParams(search);
  for (const [key, value] of want.entries()) {
    if (have.get(key) !== value) return false;
  }
  return true;
}

function NavItemLink({
  item,
  pathname,
  search,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  search: string;
  onNavigate: () => void;
}) {
  const hasChildren = Boolean(item.children?.length);
  const childActive = item.children?.some((c) => pathMatches(c.to, pathname, search)) ?? false;
  const parentActive = pathMatches(item.to, pathname, search) || childActive;
  const [open, setOpen] = useState(parentActive);

  useEffect(() => {
    if (parentActive) setOpen(true);
  }, [parentActive]);

  if (!hasChildren) {
    return (
      <NavLink
        to={item.to}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors",
          parentActive
            ? "bg-sidebar-accent text-sidebar-primary"
            : "text-sidebar-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
        <span className="truncate">{item.label}</span>
      </NavLink>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          "flex items-center gap-0.5 rounded-md",
          parentActive && !childActive ? "bg-sidebar-accent text-sidebar-primary" : "",
        )}
      >
        <NavLink
          to={item.to}
          onClick={onNavigate}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors",
            parentActive
              ? "text-sidebar-primary"
              : "text-sidebar-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
          <span className="truncate">{item.label}</span>
        </NavLink>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="mr-1 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={`Toggle ${item.label} stages`}
          >
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
          </button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="space-y-0.5 pb-1 pl-3">
        {item.children!.map((child) => {
          const [childPath, childQuery = ""] = child.to.split("?");
          const querySiblingActive = item.children!.some(
            (other) => other.to.includes("?") && pathMatches(other.to, pathname, search),
          );
          const active = childQuery
            ? pathMatches(child.to, pathname, search)
            : pathname === childPath && !querySiblingActive;
          return (
            <NavLink
              key={child.to}
              to={child.to}
              onClick={onNavigate}
              className={cn(
                "block rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {child.label}
            </NavLink>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function AppSidebar({ open, onClose }: AppSidebarProps) {
  const { user } = useAuth();
  const { rbacMatrix, settings } = useSettings();
  const { pathname, search } = useLocation();
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
          <MesmsLogo size="sm" variant="horizontal" customLogoUrl={settings?.logoUrl} />
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
                  {items.map((item) => (
                    <NavItemLink
                      key={item.to}
                      item={item}
                      pathname={pathname}
                      search={search}
                      onNavigate={closeIfOverlay}
                    />
                  ))}
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
