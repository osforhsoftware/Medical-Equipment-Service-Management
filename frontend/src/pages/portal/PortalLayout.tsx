import { useState } from "react";
import { Navigate, NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, HardDrive, FileText, History, LogOut, Menu, X } from "lucide-react";
import { MesmsLogo } from "@/components/shared/MesmsLogo";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

const links = [
  { to: "/portal", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/portal/equipment", label: "My Equipment", icon: HardDrive },
  { to: "/portal/estimates", label: "Estimates", icon: FileText },
  { to: "/portal/history", label: "Service History", icon: History },
];

export function PortalLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "customer") return <Navigate to="/app" replace />;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <MesmsLogo size="md" />

          <nav className="ml-4 hidden items-center gap-0.5 md:flex">
            {links.map((l) => {
              const active = l.end ? pathname === l.to : pathname.startsWith(l.to);
              return (
                <NavLink
                  key={l.to}
                  to={l.to}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                    active ? "bg-primary-light text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <l.icon className="h-4 w-4" strokeWidth={1.75} /> {l.label}
                </NavLink>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <p className="text-[13px] font-medium">{user.name}</p>
              <p className="text-[11px] text-muted-foreground">Customer Portal</p>
            </div>
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={() => { void logout().then(() => navigate("/login")); }} title="Sign out">
              <LogOut className="h-[18px] w-[18px]" />
            </Button>
            <button className="rounded-md p-1.5 text-muted-foreground hover:bg-muted md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Toggle portal navigation" aria-expanded={open}>
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {open && (
          <nav className="border-t border-border bg-card px-4 py-2 md:hidden">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
                  (l.end ? pathname === l.to : pathname.startsWith(l.to)) ? "bg-primary-light text-primary" : "text-muted-foreground",
                )}
              >
                <l.icon className="h-4 w-4" /> {l.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-7xl animate-fade-in px-4 py-6 sm:px-6 lg:py-7">
        <Outlet />
      </main>
    </div>
  );
}
