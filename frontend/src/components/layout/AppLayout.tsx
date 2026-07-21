import { useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { BranchProvider } from "@/context/BranchContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { AppSidebar } from "./AppSidebar";
import { Topbar } from "./Topbar";

export function AppLayout() {
  const { user, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

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
    <BranchProvider>
      <SettingsProvider>
        <div className="flex min-h-screen w-full bg-background">
          <AppSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar onMenu={() => setMobileOpen(true)} />
            <main className="flex-1 animate-fade-in p-4 lg:p-6">
              <Outlet />
            </main>
          </div>
        </div>
      </SettingsProvider>
    </BranchProvider>
  );
}
