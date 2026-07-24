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
    <div className="min-h-screen bg-transparent">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-card/80 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center gap-4 px-4 sm:px-6">
          <div className="rounded-xl bg-white px-2.5 py-1 shadow-sm ring-1 ring-border/50">
            <MesmsLogo size="md" />
          </div>

          <nav className="ml-6 hidden items-center gap-1 md:flex">
            {links.map((l) => {
              const active = l.end ? pathname === l.to : pathname.startsWith(l.to);
              return (
                <NavLink
                  key={l.to}
                  to={l.to}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all",
                    active ? "bg-gradient-to-r from-primary/12 to-accent/10 text-primary shadow-sm" : "text-muted-foreground hover:bg-secondary/70 hover:text-primary",
                  )}
                >
                  <l.icon className="h-4 w-4" /> {l.label}
                </NavLink>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">Customer Portal</p>
            </div>
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={() => { void logout().then(() => navigate("/login")); }} title="Sign out">
              <LogOut className="h-5 w-5" />
            </Button>
            <button className="rounded-lg p-2 text-muted-foreground hover:bg-secondary md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Toggle portal navigation" aria-expanded={open}>
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {open && (
          <nav className="border-t border-border/70 bg-card/95 px-4 py-3 shadow-lg md:hidden">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium",
                  (l.end ? pathname === l.to : pathname.startsWith(l.to)) ? "bg-primary/10 text-primary" : "text-muted-foreground",
                )}
              >
                <l.icon className="h-4 w-4" /> {l.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-7xl animate-fade-in px-4 py-6 sm:px-6 lg:py-8">
        <Outlet />
      </main>
    </div>
  );
}
