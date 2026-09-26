import { useState } from "react";
import { Navigate, NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, HardDrive, FileText, History, FolderOpen, LogOut, Menu, X } from "lucide-react";
import { MesmsLogo } from "@/components/shared/MesmsLogo";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CUSTOMER_PORTAL_ENABLED } from "@/config/features";
import { useAuth } from "@/context/AuthContext";

const links = [
  { to: "/portal", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/portal/equipment", label: "My Equipment", icon: HardDrive },
  { to: "/portal/estimates", label: "Estimates", icon: FileText },
  { to: "/portal/documents", label: "Documents", icon: FolderOpen },
  { to: "/portal/history", label: "Service History", icon: History },
];

export function PortalLayout() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-muted-foreground">
        <MesmsLogo size="lg" showSubtitle={false} />
        <p className="text-sm">Loading…</p>
      </div>
    );
  }

  if (!CUSTOMER_PORTAL_ENABLED) return <Navigate to="/login" replace />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "customer") return <Navigate to="/app" replace />;

  return (
    <div className="min-h-screen bg-background">
      <header className="brand-grid brand-panel sticky top-0 z-30">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <MesmsLogo size="sm" variant="horizontal" theme="dark" showSubtitle={false} />
            <div className="hidden min-w-0 border-l border-white/15 pl-3 sm:block">
              <p className="text-sm font-medium text-white">Customer Portal</p>
              <p className="truncate text-[11px] text-white/55">{user.name}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <ThemeToggle className="text-white/80 hover:bg-white/10 hover:text-white" />
            <Button
              variant="ghost"
              size="icon"
              className="text-white/80 hover:bg-white/10 hover:text-white"
              onClick={() => { void logout().then(() => navigate("/login")); }}
              title="Sign out"
            >
              <LogOut className="h-[18px] w-[18px]" />
            </Button>
            <button
              className="rounded-md p-1.5 text-white/80 hover:bg-white/10 md:hidden"
              onClick={() => setOpen((o) => !o)}
              aria-label="Toggle portal navigation"
              aria-expanded={open}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <nav className="mx-auto hidden max-w-5xl gap-1 px-4 pb-3 sm:px-6 md:flex">
          {links.map((l) => {
            const active = l.end ? pathname === l.to : pathname.startsWith(l.to);
            return (
              <NavLink
                key={l.to}
                to={l.to}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                  active
                    ? "bg-white/15 text-white"
                    : "text-white/65 hover:bg-white/10 hover:text-white",
                )}
              >
                <l.icon className="h-4 w-4" strokeWidth={1.75} /> {l.label}
              </NavLink>
            );
          })}
        </nav>

        {open ? (
          <nav className="border-t border-white/10 px-4 py-2 md:hidden">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
                  (l.end ? pathname === l.to : pathname.startsWith(l.to))
                    ? "bg-white/15 text-white"
                    : "text-white/70",
                )}
              >
                <l.icon className="h-4 w-4" /> {l.label}
              </NavLink>
            ))}
          </nav>
        ) : null}
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
        <Outlet />
      </main>
    </div>
  );
}
