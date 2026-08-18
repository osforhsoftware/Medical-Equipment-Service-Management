// @refresh reset
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AppUser, Role } from "@/data/types";
import { api, ApiError, getStoredUser, setStoredUser, type BackendUser } from "@/lib/api";
import { userHasAnyRole } from "@/lib/userRoles";

interface AuthState {
  user: AppUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<AppUser>;
  logout: () => Promise<void>;
  hasRole: (roles: Role[]) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

function mapUser(user: BackendUser): AppUser {
  return {
    id: user.id,
    tenantId: user.tenantId,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role as Role,
    roles: user.roles?.length ? (user.roles as Role[]) : undefined,
    branchId: user.branchId ?? undefined,
    avatarColor: user.avatarColor,
    customerId: user.customerId ?? undefined,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(() => getStoredUser<AppUser>());
  const [loading, setLoading] = useState(true);

  const persist = (nextUser: AppUser | null) => {
    setUser(nextUser);
    setStoredUser(nextUser);
  };

  useEffect(() => {
    // Remove legacy localStorage token from previous auth flow
    localStorage.removeItem("mesms.token");

    const bootstrap = async () => {
      try {
        const profile = await api.me();
        persist(mapUser(profile));
      } catch {
        persist(null);
      } finally {
        setLoading(false);
      }
    };

    void bootstrap();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      login: async (username: string, password: string) => {
        const result = await api.login(username, password);
        const nextUser = mapUser(result.user);
        persist(nextUser);
        return nextUser;
      },
      logout: async () => {
        try {
          await api.logout();
        } catch {
          // Clear local state even if the server call fails
        }
        persist(null);
      },
      hasRole: (roles: Role[]) => (user ? userHasAnyRole(user, roles) : false),
      refreshUser: async () => {
        const profile = await api.me();
        persist(mapUser(profile));
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
