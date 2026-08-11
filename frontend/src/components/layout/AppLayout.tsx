import { useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { MobileLayout } from "@/components/mobile/MobileLayout";
import { useIsMobile } from "@/hooks/use-mobile";
import { AppSidebar } from "./AppSidebar";
import { Topbar } from "./Topbar";

export function AppLayout() {
  const { user, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useIsMobile();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Loading…
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
        <div className="flex min-h-screen w-full bg-transparent">
          <AppSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar onMenu={() => setMobileOpen(true)} />
            <main className="flex-1 animate-fade-in p-4 sm:p-5 lg:p-7">
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
