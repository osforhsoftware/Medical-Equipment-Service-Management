// @refresh reset
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError, type BackendSettings } from "@/lib/api";
import { buildDefaultRbacMatrix } from "@/config/defaultRbac";
import { navItems } from "@/config/nav";
import type { Role } from "@/data/types";

interface SettingsState {
  settings: BackendSettings | null;
  loading: boolean;
  rbacMatrix: Record<string, Role[]>;
  refresh: () => Promise<void>;
  updateLocal: (next: BackendSettings) => void;
}

const SettingsContext = createContext<SettingsState | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<BackendSettings | null>(null);
  const [loading, setLoading] = useState(false);

  const defaults = useMemo(() => buildDefaultRbacMatrix(), []);

  const refresh = useCallback(async () => {
    if (!user) {
      setSettings(null);
      return;
    }
    setLoading(true);
    try {
      const data = await api.getSettings();
      setSettings(data);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 401)) {
        setSettings(null);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const rbacMatrix = useMemo(() => {
    if (!settings?.rbacMatrix) return defaults;
    const merged = { ...defaults };
    for (const item of navItems) {
      const roles = settings.rbacMatrix[item.label];
      if (Array.isArray(roles)) merged[item.label] = roles as Role[];
    }
    return merged;
  }, [settings, defaults]);

  const value = useMemo(
    () => ({
      settings,
      loading,
      rbacMatrix,
      refresh,
      updateLocal: setSettings,
    }),
    [settings, loading, rbacMatrix, refresh],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
