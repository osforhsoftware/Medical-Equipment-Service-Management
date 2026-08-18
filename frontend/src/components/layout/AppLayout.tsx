import { useCallback, useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { MobileLayout } from "@/components/mobile/MobileLayout";
import { useIsMobile } from "@/hooks/use-mobile";
import { MesmsLogo } from "@/components/shared/MesmsLogo";
import { AppSidebar } from "./AppSidebar";
import { Topbar } from "./Topbar";

const SIDEBAR_STORAGE_KEY = "mesms.sidebarOpen";
const DESKTOP_SIDEBAR_QUERY = "(min-width: 1024px)";

function isDesktopSidebar() {
  return typeof window !== "undefined" && window.matchMedia(DESKTOP_SIDEBAR_QUERY).matches;
}

function readSidebarOpen() {
  if (!isDesktopSidebar()) return false;
  return localStorage.getItem(SIDEBAR_STORAGE_KEY) !== "false";
}

export function AppLayout() {
  const { user, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(readSidebarOpen);
  const isMobile = useIsMobile();

  const setOpen = useCallback((open: boolean) => {
    setSidebarOpen(open);
    if (isDesktopSidebar()) {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(open));
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => {
      const next = !prev;
      if (isDesktopSidebar()) {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_SIDEBAR_QUERY);
    const onChange = () => setSidebarOpen(readSidebarOpen());
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "b" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleSidebar]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-muted-foreground">
        <MesmsLogo size="lg" />
        <p className="text-sm">Loading…</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "customer") return <Navigate to="/portal" replace />;

  return (
    <SettingsProvider>
      {isMobile ? (
        <MobileLayout>
          <Outlet />
        </MobileLayout>
      ) : (
        <div className="flex min-h-screen w-full bg-background">
          <AppSidebar open={sidebarOpen} onClose={() => setOpen(false)} />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} />
            <main className="flex-1 animate-fade-in px-5 py-5 lg:px-7 lg:py-6">
              <div className="mx-auto w-full max-w-[1600px]">
                <Outlet />
              </div>
            </main>
          </div>
        </div>
      )}
    </SettingsProvider>
  );
}
