import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { ModuleGuard } from "@/components/auth/RoleGuard";
import { ResponsivePage } from "@/components/layout/ResponsivePage";

import Login from "./pages/Login.tsx";
import NotFound from "./pages/NotFound.tsx";

import Dashboard from "./pages/app/Dashboard.tsx";
import MobileDashboard from "./pages/mobile/MobileDashboard.tsx";
import MobileJobs from "./pages/mobile/MobileJobs.tsx";
import MobileJobDetail from "./pages/mobile/MobileJobDetail.tsx";
import MobileProfile from "./pages/mobile/MobileProfile.tsx";
import MobileQR from "./pages/mobile/MobileQR.tsx";
import MobileBilling from "./pages/mobile/MobileBilling.tsx";
import Customers from "./pages/app/Customers.tsx";
import CustomerDetail from "./pages/app/CustomerDetail.tsx";
import Equipment from "./pages/app/Equipment.tsx";
import EquipmentDetail from "./pages/app/EquipmentDetail.tsx";
import ServiceRequests from "./pages/app/ServiceRequests.tsx";
import ServiceRequestDetail from "./pages/app/ServiceRequestDetail.tsx";
import Inspections from "./pages/app/Inspections.tsx";
import Estimates from "./pages/app/Estimates.tsx";
import EstimateDetail from "./pages/app/EstimateDetail.tsx";
import EstimateBuilder from "./pages/app/EstimateBuilder.tsx";
import EstimatePreview from "./pages/app/EstimatePreview.tsx";
import Sales from "./pages/app/Sales.tsx";
import SalesOrderDetail from "./pages/app/SalesOrderDetail.tsx";
import Jobs from "./pages/app/Jobs.tsx";
import JobDetail from "./pages/app/JobDetail.tsx";
import Inventory from "./pages/app/Inventory.tsx";
import InventoryDetail from "./pages/app/InventoryDetail.tsx";
import StockPurchaseRequests from "./pages/app/StockPurchaseRequests.tsx";
import StockPurchaseRequestDetail from "./pages/app/StockPurchaseRequestDetail.tsx";
import Suppliers from "./pages/app/Suppliers.tsx";
import PurchaseOrders from "./pages/app/PurchaseOrdersProfessional.tsx";
import PurchaseOrderDetail from "./pages/app/PurchaseOrderDetail.tsx";
import Billing from "./pages/app/BillingProfessional.tsx";
import BillingJobDetail from "./pages/app/BillingJobDetail.tsx";
import BillingInvoiceDetail from "./pages/app/BillingInvoiceDetail.tsx";
import Reports from "./pages/app/Reports.tsx";
import Notifications from "./pages/app/Notifications.tsx";
import QRTracking from "./pages/app/QRTracking.tsx";
import AuditLogs from "./pages/app/AuditLogs.tsx";
import Settings from "./pages/app/Settings.tsx";
import UsersPage from "./pages/app/Users.tsx";
import ServiceCatalog from "./pages/app/ServiceCatalog.tsx";
import Projects from "./pages/app/Projects.tsx";
import ProjectDetail from "./pages/app/ProjectDetail.tsx";
import OfficeAssets from "./pages/app/OfficeAssets.tsx";
import MasterData from "./pages/app/MasterData.tsx";
import ExpensesCommissions from "./pages/app/ExpensesCommissions.tsx";

import { PortalLayout } from "./pages/portal/PortalLayout.tsx";
import PortalDashboard from "./pages/portal/PortalDashboard.tsx";
import PortalEquipment from "./pages/portal/PortalEquipment.tsx";
import PortalEstimates from "./pages/portal/PortalEstimates.tsx";
import PortalEstimateDetail from "./pages/portal/PortalEstimateDetail.tsx";
import PortalHistory from "./pages/portal/PortalHistory.tsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AuthProvider>
          <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />

            <Route path="/app" element={<AppLayout />}>
              <Route index element={<ModuleGuard module="Dashboard"><ResponsivePage mobile={<MobileDashboard />} desktop={<Dashboard />} /></ModuleGuard>} />
              <Route path="customers" element={<ModuleGuard module="Customers"><Customers /></ModuleGuard>} />
              <Route path="customers/:id" element={<ModuleGuard module="Customers"><CustomerDetail /></ModuleGuard>} />
              <Route path="sales" element={<ModuleGuard module="Sales"><Sales /></ModuleGuard>} />
              <Route path="sales/orders/:id" element={<ModuleGuard module="Sales"><SalesOrderDetail /></ModuleGuard>} />
              <Route path="equipment" element={<ModuleGuard module="Equipment"><Equipment /></ModuleGuard>} />
              <Route path="equipment/:id" element={<ModuleGuard module="Equipment"><EquipmentDetail /></ModuleGuard>} />
              <Route path="service-requests" element={<ModuleGuard module="Service Tickets"><ServiceRequests /></ModuleGuard>} />
              <Route path="service-requests/:id" element={<ModuleGuard module="Service Tickets"><ServiceRequestDetail /></ModuleGuard>} />
              <Route path="service-tickets" element={<ModuleGuard module="Service Tickets"><ServiceRequests /></ModuleGuard>} />
              <Route path="service-tickets/:id" element={<ModuleGuard module="Service Tickets"><ServiceRequestDetail /></ModuleGuard>} />
              <Route path="inspections" element={<ModuleGuard module="Inspections"><Inspections /></ModuleGuard>} />
              <Route path="estimates" element={<ModuleGuard module="Estimates"><Estimates /></ModuleGuard>} />
              <Route path="estimates/new" element={<ModuleGuard module="Estimates"><EstimateBuilder /></ModuleGuard>} />
              <Route path="estimates/:ticketId/build" element={<ModuleGuard module="Estimates"><EstimateBuilder /></ModuleGuard>} />
              <Route path="estimates/:id/preview" element={<ModuleGuard module="Estimates"><EstimatePreview /></ModuleGuard>} />
              <Route path="estimates/:id" element={<ModuleGuard module="Estimates"><EstimateDetail /></ModuleGuard>} />
              <Route path="jobs" element={<ModuleGuard module="Service Jobs"><ResponsivePage mobile={<MobileJobs />} desktop={<Jobs />} /></ModuleGuard>} />
              <Route path="jobs/:id" element={<ModuleGuard module="Service Jobs"><ResponsivePage mobile={<MobileJobDetail />} desktop={<JobDetail />} /></ModuleGuard>} />
              <Route path="profile" element={<ResponsivePage mobile={<MobileProfile />} desktop={<Settings />} />} />
              <Route path="projects" element={<ModuleGuard module="Projects"><Projects /></ModuleGuard>} />
              <Route path="projects/:id" element={<ModuleGuard module="Projects"><ProjectDetail /></ModuleGuard>} />
              <Route path="service-catalog" element={<ModuleGuard module="Service Catalog"><ServiceCatalog /></ModuleGuard>} />
              <Route path="inventory" element={<ModuleGuard module="Inventory Items"><Inventory /></ModuleGuard>} />
              <Route path="inventory/:id" element={<ModuleGuard module="Inventory Items"><InventoryDetail /></ModuleGuard>} />
              <Route path="stock-purchase-requests" element={<ModuleGuard module="Stock Purchase Requests"><StockPurchaseRequests /></ModuleGuard>} />
              <Route path="stock-purchase-requests/:id" element={<ModuleGuard module="Stock Purchase Requests"><StockPurchaseRequestDetail /></ModuleGuard>} />
              <Route path="suppliers" element={<ModuleGuard module="Suppliers"><Suppliers /></ModuleGuard>} />
              <Route path="purchase-orders" element={<ModuleGuard module="Purchase Orders"><PurchaseOrders /></ModuleGuard>} />
              <Route path="purchase-orders/:id" element={<ModuleGuard module="Purchase Orders"><PurchaseOrderDetail /></ModuleGuard>} />
              <Route path="billing" element={<ModuleGuard module="Billing"><ResponsivePage mobile={<MobileBilling />} desktop={<Billing />} /></ModuleGuard>} />
              <Route path="billing/jobs/:jobId" element={<ModuleGuard module="Billing"><BillingJobDetail /></ModuleGuard>} />
              <Route path="billing/invoices/:invoiceId" element={<ModuleGuard module="Billing"><BillingInvoiceDetail /></ModuleGuard>} />
              <Route path="finance-operations" element={<ModuleGuard module="Expenses & Commissions"><ExpensesCommissions /></ModuleGuard>} />
              <Route path="reports" element={<ModuleGuard module="Reports"><Reports /></ModuleGuard>} />
              <Route path="notifications" element={<ModuleGuard module="Notifications"><Notifications /></ModuleGuard>} />
              <Route path="qr-tracking" element={<ModuleGuard module="QR Tracking"><ResponsivePage mobile={<MobileQR />} desktop={<QRTracking />} /></ModuleGuard>} />
              <Route path="audit-logs" element={<ModuleGuard module="Audit Logs"><AuditLogs /></ModuleGuard>} />
              <Route path="users" element={<ModuleGuard module="Users"><UsersPage /></ModuleGuard>} />
              <Route path="master-data" element={<ModuleGuard module="Master Data"><MasterData /></ModuleGuard>} />
              <Route path="office-assets" element={<ModuleGuard module="Office Assets"><OfficeAssets /></ModuleGuard>} />
              <Route path="settings" element={<ModuleGuard module="Settings"><Settings /></ModuleGuard>} />
            </Route>

            <Route path="/portal" element={<PortalLayout />}>
              <Route index element={<PortalDashboard />} />
              <Route path="equipment" element={<PortalEquipment />} />
              <Route path="estimates" element={<PortalEstimates />} />
              <Route path="estimates/:id/preview" element={<EstimatePreview />} />
              <Route path="estimates/:id" element={<PortalEstimateDetail />} />
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
