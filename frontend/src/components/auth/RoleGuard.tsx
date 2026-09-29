import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import type { Role } from "@/data/types";
import { userCanAccessModule, userHasAnyRole } from "@/lib/userRoles";
import { navItems } from "@/config/nav";

/** Send staff who opened a forbidden page to the first module they can use. */
function RedirectToAllowedPage() {
  const { user } = useAuth();
  const { rbacMatrix } = useSettings();
  const { pathname } = useLocation();
  if (!user) return <Navigate to="/login" replace />;

  const target = navItems.find((item) => {
    const path = item.to.split("?")[0];
    const onThisPage = path === "/app"
      ? pathname === "/app" || pathname === "/app/"
      : pathname === path || pathname.startsWith(`${path}/`);
    if (onThisPage) return false;
    return userCanAccessModule(user, item.label, rbacMatrix, item.roles);
  });

  if (!target) return null;
  return <Navigate to={target.to} replace />;
}

/** Wrap a page to restrict it to a fixed set of roles. */
export function RoleGuard({ roles, children }: { roles: readonly Role[]; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!userHasAnyRole(user, roles)) return <RedirectToAllowedPage />;
  return <>{children}</>;
}

/** Route-level guard driven by the same tenant RBAC matrix as navigation. */
export function ModuleGuard({
  module,
  orModules,
  children,
}: {
  module: string;
  /** Extra modules that may also unlock this route (e.g. estimate staff viewing an inspection report). */
  orModules?: string[];
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const { loading, rbacMatrix } = useSettings();

  if (!user) return <Navigate to="/login" replace />;
  if (loading) return <div className="py-12 text-center text-sm text-muted-foreground">Loading permissions…</div>;

  const canAccess = [module, ...(orModules ?? [])].some((name) => {
    const fallbackRoles = navItems.find((item) => item.label === name)?.roles;
    return userCanAccessModule(user, name, rbacMatrix, fallbackRoles);
  });
  if (!canAccess) return <RedirectToAllowedPage />;
  return <>{children}</>;
}
