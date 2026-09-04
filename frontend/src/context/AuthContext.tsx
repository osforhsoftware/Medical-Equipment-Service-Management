// @refresh reset
import { useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createHmrContext } from "@/context/hmrContext";
import type { AppUser, Role } from "@/data/types";
import {
  api,
  getStoredUser,
  markSessionActive,
  setStoredUser,
  SESSION_EXPIRED_EVENT,
  type BackendUser,
} from "@/lib/api";
import { userHasAnyRole } from "@/lib/userRoles";

interface AuthState {
  user: AppUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<AppUser>;
  logout: () => Promise<void>;
  hasRole: (roles: Role[]) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createHmrContext<AuthState>("__MESMS_AUTH_CONTEXT__");
const SESSION_REFRESH_MS = 10 * 60 * 1000;

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
        markSessionActive();
      } catch {
        persist(null);
      } finally {
        setLoading(false);
      }
    };

    void bootstrap();
  }, []);

  useEffect(() => {
    const onExpired = () => persist(null);
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  useEffect(() => {
    if (!user) return;

    const refresh = () => {
      if (document.visibilityState === "hidden") return;
      void api.refreshSession().catch(() => {
        // 401 is handled by the API client session-expired flow
      });
    };

    const interval = window.setInterval(refresh, SESSION_REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      login: async (username: string, password: string) => {
        const result = await api.login(username, password);
        const nextUser = mapUser(result.user);
        persist(nextUser);
        markSessionActive();
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
