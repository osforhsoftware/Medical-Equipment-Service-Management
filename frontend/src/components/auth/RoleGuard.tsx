import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import type { Role } from "@/data/types";

/** Wrap a page to restrict it to specific roles. */
export function RoleGuard({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center">
        <h2 className="font-display text-xl font-bold">Access restricted</h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Your role ({user.role}) does not have permission to view this section.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
