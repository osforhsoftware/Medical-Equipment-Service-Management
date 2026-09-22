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
  ArrowLeftRight,
  History,
  Undo2,
  ClipboardPen,
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

const ALL: Role[] = ["admin", "coordinator", "inspector", "estimator", "sales", "engineer", "inventory", "billing"];

const SERVICE_TICKET_STAGES: NavChild[] = [
  { label: "All active", to: "/app/service-tickets" },
  { label: "Pending", to: "/app/service-tickets?status=new&view=table" },
  { label: "Inspection", to: "/app/service-tickets?status=inspection&view=table" },
  { label: "Estimate", to: "/app/service-tickets?status=estimate&view=table" },
  { label: "Approval", to: "/app/service-tickets?status=approval&view=table" },
  { label: "In Progress", to: "/app/service-tickets?status=in-progress&view=table" },
  { label: "Completed", to: "/app/service-tickets?status=completed&view=table" },
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

  { label: "Sales", to: "/app/sales", icon: Store, roles: ["admin", "sales", "billing", "inventory"], group: "Sales" },
  { label: "Sales Enquiries", to: "/app/sales-enquiries", icon: ClipboardPen, roles: ["admin", "sales", "coordinator", "billing"], group: "Sales" },
  { label: "Customers", to: "/app/customers", icon: Users, roles: ["admin", "coordinator", "estimator", "sales", "billing"], group: "Sales" },

  { label: "Equipment", to: "/app/equipment", icon: HardDrive, roles: ["admin", "coordinator", "inspector", "engineer", "inventory"], group: "Operations" },
  {
    label: "Service Tickets",
    to: "/app/service-tickets",
    icon: ClipboardList,
    roles: ["admin", "coordinator", "inspector", "engineer", "estimator", "sales"],
    group: "Operations",
    children: SERVICE_TICKET_STAGES,
  },
  { label: "Inspections", to: "/app/inspections", icon: Search, roles: ["admin", "coordinator", "inspector"], group: "Operations" },
  { label: "Estimates", to: "/app/estimates", icon: FileText, roles: ["admin", "coordinator", "estimator", "billing"], group: "Operations" },
  { label: "Service Jobs", to: "/app/jobs", icon: Wrench, roles: ["admin", "coordinator", "engineer"], group: "Operations" },
  {
    label: "Projects",
    to: "/app/projects",
    icon: FolderKanban,
    // Same data as Service Jobs (jobs API) — only roles that can read jobs.
    roles: ["admin", "coordinator"],
    group: "Operations",
    children: PROJECT_STAGES,
  },
  { label: "Service Catalog", to: "/app/service-catalog", icon: BookOpen, roles: ["admin", "coordinator", "estimator"], group: "Operations" },
  { label: "Warranty Claims", to: "/app/warranty-claims", icon: ShieldAlert, roles: ["admin", "coordinator", "inspector", "estimator", "engineer", "sales"], group: "Operations" },

  { label: "Inventory Items", to: "/app/inventory", icon: Boxes, roles: ["admin", "inventory", "engineer"], group: "Supply Chain" },
  { label: "Stock Purchase Requests", to: "/app/stock-purchase-requests", icon: ShoppingCart, roles: ["admin", "inventory", "engineer"], group: "Supply Chain" },
  { label: "Suppliers", to: "/app/suppliers", icon: Truck, roles: ["admin", "inventory"], group: "Supply Chain" },
  { label: "Supplier RFQs", to: "/app/rfqs", icon: Truck, roles: ["admin", "inventory", "coordinator", "billing"], group: "Supply Chain" },
  { label: "Purchase Orders", to: "/app/purchase-orders", icon: ShoppingCart, roles: ["admin", "inventory"], group: "Supply Chain" },
  { label: "Purchase Returns", to: "/app/purchase-returns", icon: Undo2, roles: ["admin", "inventory"], group: "Supply Chain" },

  { label: "Stock Ledger", to: "/app/stock-ledger", icon: History, roles: ["admin", "inventory"], group: "Supply Chain" },

  { label: "Billing", to: "/app/billing", icon: Receipt, roles: ["admin", "billing"], group: "Contracts & Finance" },
  { label: "Expenses & Commissions", to: "/app/finance-operations", icon: BadgeIndianRupee, roles: ["admin", "billing"], group: "Contracts & Finance" },

  { label: "Reports", to: "/app/reports", icon: BarChart3, roles: ["admin", "billing", "coordinator"], group: "Insights" },
  { label: "Notifications", to: "/app/notifications", icon: Bell, roles: ALL, group: "Insights" },
  { label: "QR Tracking", to: "/app/qr-tracking", icon: QrCode, roles: ["admin", "coordinator", "inspector", "engineer", "inventory"], group: "Insights" },
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
  const normalized = pathname.startsWith("/app/service-requests")
    ? pathname.replace(/^\/app\/service-requests/, "/app/service-tickets")
    : pathname;
  const match = navItems
    .filter((item) => item.to !== "/app")
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) => normalized === item.to || normalized.startsWith(`${item.to}/`));
  return match?.label;
}
