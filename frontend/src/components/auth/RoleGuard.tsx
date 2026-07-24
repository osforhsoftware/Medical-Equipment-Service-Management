import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import type { Role } from "@/data/types";

function AccessDenied({ role }: { role: Role }) {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center text-center">
      <h2 className="font-display text-xl font-bold">Access restricted</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Your role ({role}) does not have permission to view this section.
      </p>
    </div>
  );
}

/** Wrap a page to restrict it to a fixed set of roles. */
export function RoleGuard({ roles, children }: { roles: readonly Role[]; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <AccessDenied role={user.role} />;
  return <>{children}</>;
}

/** Route-level guard driven by the same tenant RBAC matrix as navigation. */
export function ModuleGuard({ module, children }: { module: string; children: React.ReactNode }) {
  const { user } = useAuth();
  const { loading, rbacMatrix } = useSettings();

  if (!user) return <Navigate to="/login" replace />;
  if (loading) return <div className="py-12 text-center text-sm text-muted-foreground">Loading permissions…</div>;

  const roles = rbacMatrix[module] ?? [];
  if (!roles.includes(user.role)) return <AccessDenied role={user.role} />;
  return <>{children}</>;
}
