import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { ModuleGuard } from "@/components/auth/RoleGuard";

import Login from "./pages/Login.tsx";
import NotFound from "./pages/NotFound.tsx";

import Dashboard from "./pages/app/Dashboard.tsx";
import Customers from "./pages/app/Customers.tsx";
import Equipment from "./pages/app/Equipment.tsx";
import ServiceRequests from "./pages/app/ServiceRequests.tsx";
import Inspections from "./pages/app/Inspections.tsx";
import Estimates from "./pages/app/Estimates.tsx";
import EstimateBuilder from "./pages/app/EstimateBuilder.tsx";
import Jobs from "./pages/app/Jobs.tsx";
import Inventory from "./pages/app/Inventory.tsx";
import StockPurchaseRequests from "./pages/app/StockPurchaseRequests.tsx";
import Suppliers from "./pages/app/Suppliers.tsx";
import PurchaseOrders from "./pages/app/PurchaseOrdersProfessional.tsx";
import StockTransfers from "./pages/app/StockTransfers.tsx";
import AMC from "./pages/app/AMC.tsx";
import Billing from "./pages/app/BillingProfessional.tsx";
import Reports from "./pages/app/Reports.tsx";
import Notifications from "./pages/app/Notifications.tsx";
import QRTracking from "./pages/app/QRTracking.tsx";
import AuditLogs from "./pages/app/AuditLogs.tsx";
import Branches from "./pages/app/Branches.tsx";
import Settings from "./pages/app/Settings.tsx";
import UsersPage from "./pages/app/Users.tsx";
import ServiceCatalog from "./pages/app/ServiceCatalog.tsx";
import Projects from "./pages/app/Projects.tsx";
import ProjectDetail from "./pages/app/ProjectDetail.tsx";
import OfficeAssets from "./pages/app/OfficeAssets.tsx";
import ExpensesCommissions from "./pages/app/ExpensesCommissions.tsx";

import { PortalLayout } from "./pages/portal/PortalLayout.tsx";
import PortalDashboard from "./pages/portal/PortalDashboard.tsx";
import PortalEquipment from "./pages/portal/PortalEquipment.tsx";
import PortalEstimates from "./pages/portal/PortalEstimates.tsx";
import PortalHistory from "./pages/portal/PortalHistory.tsx";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
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
              <Route index element={<ModuleGuard module="Dashboard"><Dashboard /></ModuleGuard>} />
              <Route path="customers" element={<ModuleGuard module="Customers"><Customers /></ModuleGuard>} />
              <Route path="equipment" element={<ModuleGuard module="Equipment"><Equipment /></ModuleGuard>} />
              <Route path="service-requests" element={<ModuleGuard module="Service Tickets"><ServiceRequests /></ModuleGuard>} />
              <Route path="service-tickets" element={<ModuleGuard module="Service Tickets"><ServiceRequests /></ModuleGuard>} />
              <Route path="inspections" element={<ModuleGuard module="Inspections"><Inspections /></ModuleGuard>} />
              <Route path="estimates" element={<ModuleGuard module="Estimates"><Estimates /></ModuleGuard>} />
              <Route path="estimates/:ticketId/build" element={<ModuleGuard module="Estimates"><EstimateBuilder /></ModuleGuard>} />
              <Route path="jobs" element={<ModuleGuard module="Service Jobs"><Jobs /></ModuleGuard>} />
              <Route path="projects" element={<ModuleGuard module="Projects"><Projects /></ModuleGuard>} />
              <Route path="projects/:id" element={<ModuleGuard module="Projects"><ProjectDetail /></ModuleGuard>} />
              <Route path="service-catalog" element={<ModuleGuard module="Service Catalog"><ServiceCatalog /></ModuleGuard>} />
              <Route path="inventory" element={<ModuleGuard module="Inventory Items"><Inventory /></ModuleGuard>} />
              <Route path="stock-purchase-requests" element={<ModuleGuard module="Stock Purchase Requests"><StockPurchaseRequests /></ModuleGuard>} />
              <Route path="suppliers" element={<ModuleGuard module="Suppliers"><Suppliers /></ModuleGuard>} />
              <Route path="purchase-orders" element={<ModuleGuard module="Purchase Orders"><PurchaseOrders /></ModuleGuard>} />
              <Route path="stock-transfers" element={<ModuleGuard module="Stock Transfers"><StockTransfers /></ModuleGuard>} />
              <Route path="amc" element={<ModuleGuard module="AMC Contracts"><AMC /></ModuleGuard>} />
              <Route path="billing" element={<ModuleGuard module="Billing"><Billing /></ModuleGuard>} />
              <Route path="finance-operations" element={<ModuleGuard module="Expenses & Commissions"><ExpensesCommissions /></ModuleGuard>} />
              <Route path="reports" element={<ModuleGuard module="Reports"><Reports /></ModuleGuard>} />
              <Route path="notifications" element={<ModuleGuard module="Notifications"><Notifications /></ModuleGuard>} />
              <Route path="qr-tracking" element={<ModuleGuard module="QR Tracking"><QRTracking /></ModuleGuard>} />
              <Route path="audit-logs" element={<ModuleGuard module="Audit Logs"><AuditLogs /></ModuleGuard>} />
              <Route path="branches" element={<ModuleGuard module="Branches"><Branches /></ModuleGuard>} />
              <Route path="users" element={<ModuleGuard module="Users"><UsersPage /></ModuleGuard>} />
              <Route path="office-assets" element={<ModuleGuard module="Office Assets"><OfficeAssets /></ModuleGuard>} />
              <Route path="settings" element={<ModuleGuard module="Settings"><Settings /></ModuleGuard>} />
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
  </ThemeProvider>
);

export default App;
