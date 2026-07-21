import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";

import Login from "./pages/Login.tsx";
import NotFound from "./pages/NotFound.tsx";

import Dashboard from "./pages/app/Dashboard.tsx";
import Customers from "./pages/app/Customers.tsx";
import Equipment from "./pages/app/Equipment.tsx";
import ServiceRequests from "./pages/app/ServiceRequests.tsx";
import Inspections from "./pages/app/Inspections.tsx";
import Estimates from "./pages/app/Estimates.tsx";
import Jobs from "./pages/app/Jobs.tsx";
import Inventory from "./pages/app/Inventory.tsx";
import Suppliers from "./pages/app/Suppliers.tsx";
import PurchaseOrders from "./pages/app/PurchaseOrders.tsx";
import StockTransfers from "./pages/app/StockTransfers.tsx";
import AMC from "./pages/app/AMC.tsx";
import Billing from "./pages/app/Billing.tsx";
import Reports from "./pages/app/Reports.tsx";
import Notifications from "./pages/app/Notifications.tsx";
import QRTracking from "./pages/app/QRTracking.tsx";
import AuditLogs from "./pages/app/AuditLogs.tsx";
import Branches from "./pages/app/Branches.tsx";
import Settings from "./pages/app/Settings.tsx";
import UsersPage from "./pages/app/Users.tsx";

import { PortalLayout } from "./pages/portal/PortalLayout.tsx";
import PortalDashboard from "./pages/portal/PortalDashboard.tsx";
import PortalEquipment from "./pages/portal/PortalEquipment.tsx";
import PortalEstimates from "./pages/portal/PortalEstimates.tsx";
import PortalHistory from "./pages/portal/PortalHistory.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />

            <Route path="/app" element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="customers" element={<Customers />} />
              <Route path="equipment" element={<Equipment />} />
              <Route path="service-requests" element={<ServiceRequests />} />
              <Route path="inspections" element={<Inspections />} />
              <Route path="estimates" element={<Estimates />} />
              <Route path="jobs" element={<Jobs />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="suppliers" element={<Suppliers />} />
              <Route path="purchase-orders" element={<PurchaseOrders />} />
              <Route path="stock-transfers" element={<StockTransfers />} />
              <Route path="amc" element={<AMC />} />
              <Route path="billing" element={<Billing />} />
              <Route path="reports" element={<Reports />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="qr-tracking" element={<QRTracking />} />
              <Route path="audit-logs" element={<AuditLogs />} />
              <Route path="branches" element={<Branches />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            <Route path="/portal" element={<PortalLayout />}>
              <Route index element={<PortalDashboard />} />
              <Route path="equipment" element={<PortalEquipment />} />
              <Route path="estimates" element={<PortalEstimates />} />
              <Route path="history" element={<PortalHistory />} />
            </Route>

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
