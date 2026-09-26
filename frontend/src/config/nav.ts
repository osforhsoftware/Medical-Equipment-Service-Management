import {
  LayoutDashboard,
  Users,
  HardDrive,
  ClipboardList,
  Search,
  FileText,
  Wrench,
  Boxes,
  Truck,
  ShoppingCart,
  Receipt,
  Bell,
  BarChart3,
  ScrollText,
  QrCode,
  Settings,
  UserCog,
  BookOpen,
  FolderKanban,
  BriefcaseBusiness,
  BadgeIndianRupee,
  Tags,
  Store,
  Undo2,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/data/types";

export interface NavChild {
  label: string;
  to: string;
}

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  roles: Role[];
  group: string;
  children?: NavChild[];
}

const ALL: Role[] = ["admin", "coordinator", "inspector", "estimator", "sales", "engineer", "inventory", "billing", "qa"];

const SERVICE_TICKET_STAGES: NavChild[] = [
  { label: "All active", to: "/app/service-tickets" },
  { label: "Pending", to: "/app/service-tickets?status=new&view=table" },
  { label: "Inspection", to: "/app/service-tickets?status=inspection&view=table" },
  { label: "Estimate", to: "/app/service-tickets?status=estimate&view=table" },
  { label: "Approval", to: "/app/service-tickets?status=pending_approval&view=table" },
  { label: "In Progress", to: "/app/service-tickets?status=assigned_engineer&view=table" },
  { label: "Completed", to: "/app/service-tickets?status=closed&view=table" },
];

const PROJECT_STAGES: NavChild[] = [
  { label: "All active", to: "/app/projects" },
  { label: "Scheduled", to: "/app/projects?status=scheduled" },
  { label: "In Progress", to: "/app/projects?status=inProgress" },
  { label: "Parts Pending", to: "/app/projects?status=partsPending" },
  { label: "Review", to: "/app/projects?status=review" },
  { label: "Completed", to: "/app/projects?status=completed" },
];

/**
 * Default module access by role (medical equipment service ops):
 * - Sales: product sales desk only (sales / billing / inventory fulfill)
 * - Inspector: field inspection + tickets/equipment/QR
 * - Estimator: quotes, catalog, customers, tickets (not projects/jobs or invoicing)
 * - Engineer: jobs, parts, tickets/equipment/QR (not estimate desk)
 * - Billing: service + sale invoices, estimates view, reports
 * - Inventory: warehouse + sale fulfillment
 * - Coordinator: service ops orchestration (not product sales desk)
 */
export const navItems: NavItem[] = [
  { label: "Dashboard", to: "/app", icon: LayoutDashboard, roles: ALL, group: "Overview" },

  {
    label: "Sales",
    to: "/app/sales",
    icon: Store,
    roles: ["admin", "sales", "billing", "inventory", "coordinator"],
    group: "Sales",
    children: [
      { label: "Overview", to: "/app/sales" },
      { label: "Enquiry", to: "/app/sales-enquiries" },
      { label: "Quotation", to: "/app/sales/quotations" },
      { label: "SO", to: "/app/sales?stage=orders" },
      { label: "Delivery", to: "/app/sales?stage=delivery" },
      { label: "Invoice", to: "/app/sales?stage=invoice" },
    ],
  },
  { label: "Customers", to: "/app/customers", icon: Users, roles: ["admin", "coordinator", "estimator", "sales", "billing"], group: "Sales" },

  { label: "Equipment", to: "/app/equipment", icon: HardDrive, roles: ["admin", "coordinator", "inspector", "engineer", "inventory", "qa"], group: "Operations" },
  {
    label: "Service Tickets",
    to: "/app/service-tickets",
    icon: ClipboardList,
    roles: ["admin", "coordinator", "inspector", "engineer", "estimator", "sales", "qa"],
    group: "Operations",
    children: SERVICE_TICKET_STAGES,
  },
  { label: "Inspections", to: "/app/inspections", icon: Search, roles: ["admin", "coordinator", "inspector", "estimator", "qa"], group: "Operations" },
  { label: "Estimates", to: "/app/estimates", icon: FileText, roles: ["admin", "coordinator", "estimator", "billing"], group: "Operations" },
  { label: "Service Jobs", to: "/app/jobs", icon: Wrench, roles: ["admin", "coordinator", "engineer", "qa"], group: "Operations" },
  {
    label: "Projects",
    to: "/app/projects",
    icon: FolderKanban,
    // Same data as Service Jobs (jobs API) — only roles that can read jobs.
    roles: ["admin", "coordinator", "qa"],
    group: "Operations",
    children: PROJECT_STAGES,
  },
  { label: "Service Catalog", to: "/app/service-catalog", icon: BookOpen, roles: ["admin", "coordinator", "estimator"], group: "Operations" },
  { label: "Warranty Claims", to: "/app/warranty-claims", icon: ShieldAlert, roles: ["admin", "coordinator", "inspector", "estimator", "engineer", "sales", "billing", "qa"], group: "Operations" },

  {
    label: "Inventory",
    to: "/app/inventory",
    icon: Boxes,
    roles: ["admin", "inventory", "engineer"],
    group: "Supply Chain",
    children: [
      { label: "Overview", to: "/app/inventory" },
      { label: "Parts", to: "/app/inventory?stage=parts" },
      { label: "Stock issue", to: "/app/stock-ledger" },
      { label: "Locations", to: "/app/stock-transfers" },
      { label: "Reorder", to: "/app/stock-purchase-requests" },
      { label: "Cost", to: "/app/inventory?stage=cost" },
    ],
  },
  { label: "Suppliers", to: "/app/suppliers", icon: Truck, roles: ["admin", "inventory"], group: "Supply Chain" },
  {
    label: "Purchase",
    to: "/app/rfqs",
    icon: ShoppingCart,
    roles: ["admin", "inventory", "coordinator", "billing"],
    group: "Supply Chain",
    children: [
      { label: "Overview", to: "/app/rfqs" },
      { label: "Purchase request", to: "/app/stock-purchase-requests?desk=purchase" },
      { label: "RFQ", to: "/app/rfqs?stage=rfq" },
      { label: "Supplier quote", to: "/app/rfqs?stage=quotes" },
      { label: "PO", to: "/app/purchase-orders" },
      { label: "Shipment", to: "/app/purchase-orders?stage=shipment" },
      { label: "Customs", to: "/app/purchase-orders?stage=customs" },
      { label: "GRN", to: "/app/purchase-orders?stage=grn" },
      { label: "Stock", to: "/app/purchase-orders?stage=stock" },
    ],
  },
  { label: "Purchase Returns", to: "/app/purchase-returns", icon: Undo2, roles: ["admin", "inventory"], group: "Supply Chain" },

  { label: "Billing", to: "/app/billing", icon: Receipt, roles: ["admin", "billing"], group: "Contracts & Finance" },
  {
    label: "Finance",
    to: "/app/finance",
    icon: BadgeIndianRupee,
    roles: ["admin", "billing"],
    group: "Contracts & Finance",
    children: [
      { label: "Overview", to: "/app/finance" },
      { label: "Receivables", to: "/app/finance?stage=receivables" },
      { label: "Payments", to: "/app/finance?stage=payments" },
      { label: "VAT", to: "/app/finance?stage=vat" },
      { label: "Profit", to: "/app/finance?stage=profit" },
      { label: "Credit", to: "/app/finance?stage=credit" },
    ],
  },

  {
    label: "Reports",
    to: "/app/reports",
    icon: BarChart3,
    roles: ["admin", "billing", "coordinator"],
    group: "Insights",
    children: [
      { label: "All categories", to: "/app/reports" },
      { label: "Service", to: "/app/reports/service" },
      { label: "Financial", to: "/app/reports/financial" },
      { label: "Inventory", to: "/app/reports/inventory" },
      { label: "Management", to: "/app/reports/management" },
    ],
  },
  { label: "Notifications", to: "/app/notifications", icon: Bell, roles: ALL, group: "Insights" },
  { label: "QR Tracking", to: "/app/qr-tracking", icon: QrCode, roles: ["admin", "coordinator", "inspector", "engineer", "inventory", "qa"], group: "Insights" },
  { label: "Audit Logs", to: "/app/audit-logs", icon: ScrollText, roles: ["admin"], group: "Insights" },

  { label: "Users", to: "/app/users", icon: UserCog, roles: ["admin"], group: "Administration" },
  { label: "Master Data", to: "/app/master-data", icon: Tags, roles: ["admin", "coordinator"], group: "Administration" },
  { label: "Office Assets", to: "/app/office-assets", icon: BriefcaseBusiness, roles: ["admin"], group: "Administration" },
  { label: "Settings", to: "/app/settings", icon: Settings, roles: ["admin"], group: "Administration" },
];

export const navGroups = ["Overview", "Sales", "Operations", "Supply Chain", "Contracts & Finance", "Insights", "Administration"];

/** Map a staff app path to the RBAC module label that guards it. */
export function navModuleForPath(pathname: string): string | undefined {
  if (pathname === "/app" || pathname === "/app/") return "Dashboard";
  if (pathname.startsWith("/app/sales-enquiries")) return "Sales";
  if (pathname.startsWith("/app/finance-operations")) return "Finance";
  if (pathname.startsWith("/app/rfqs") || pathname.startsWith("/app/purchase-orders")) return "Purchase";
  if (
    pathname.startsWith("/app/stock-purchase-requests") &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("desk") === "purchase"
  ) {
    return "Purchase";
  }
  if (
    pathname.startsWith("/app/inventory") ||
    pathname.startsWith("/app/stock-ledger") ||
    pathname.startsWith("/app/stock-transfers") ||
    pathname.startsWith("/app/stock-locations") ||
    pathname.startsWith("/app/stock-purchase-requests")
  ) {
    return "Inventory";
  }
  const normalized = pathname.startsWith("/app/service-requests")
    ? pathname.replace(/^\/app\/service-requests/, "/app/service-tickets")
    : pathname;
  const match = navItems
    .filter((item) => item.to !== "/app")
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) => normalized === item.to || normalized.startsWith(`${item.to}/`));
  return match?.label;
}
