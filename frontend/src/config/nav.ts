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
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/data/types";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  roles: Role[];
  group: string;
}

const ALL: Role[] = ["admin", "coordinator", "inspector", "estimator", "engineer", "inventory", "billing"];

export const navItems: NavItem[] = [
  { label: "Dashboard", to: "/app", icon: LayoutDashboard, roles: ALL, group: "Overview" },

  { label: "Customers", to: "/app/customers", icon: Users, roles: ["admin", "coordinator", "billing"], group: "Operations" },
  { label: "Equipment", to: "/app/equipment", icon: HardDrive, roles: ["admin", "coordinator", "inspector", "engineer", "inventory"], group: "Operations" },
  { label: "Service Tickets", to: "/app/service-tickets", icon: ClipboardList, roles: ["admin", "coordinator", "inspector", "engineer", "estimator"], group: "Operations" },
  { label: "Inspections", to: "/app/inspections", icon: Search, roles: ["admin", "coordinator", "inspector"], group: "Operations" },
  { label: "Estimates", to: "/app/estimates", icon: FileText, roles: ["admin", "coordinator", "estimator", "billing"], group: "Operations" },
  { label: "Service Jobs", to: "/app/jobs", icon: Wrench, roles: ["admin", "coordinator", "engineer"], group: "Operations" },
  { label: "Projects", to: "/app/projects", icon: FolderKanban, roles: ["admin", "coordinator", "estimator", "engineer"], group: "Operations" },
  { label: "Service Catalog", to: "/app/service-catalog", icon: BookOpen, roles: ["admin", "coordinator", "estimator"], group: "Operations" },

  { label: "Inventory Items", to: "/app/inventory", icon: Boxes, roles: ["admin", "inventory", "engineer", "inspector"], group: "Supply Chain" },
  { label: "Stock Purchase Requests", to: "/app/stock-purchase-requests", icon: ShoppingCart, roles: ["admin", "inventory", "inspector", "engineer"], group: "Supply Chain" },
  { label: "Suppliers", to: "/app/suppliers", icon: Truck, roles: ["admin", "inventory"], group: "Supply Chain" },
  { label: "Purchase Orders", to: "/app/purchase-orders", icon: ShoppingCart, roles: ["admin", "inventory"], group: "Supply Chain" },

  { label: "Billing", to: "/app/billing", icon: Receipt, roles: ["admin", "billing"], group: "Contracts & Finance" },
  { label: "Expenses & Commissions", to: "/app/finance-operations", icon: BadgeIndianRupee, roles: ["admin", "billing"], group: "Contracts & Finance" },

  { label: "Reports", to: "/app/reports", icon: BarChart3, roles: ["admin", "billing", "coordinator"], group: "Insights" },
  { label: "Notifications", to: "/app/notifications", icon: Bell, roles: ALL, group: "Insights" },
  { label: "QR Tracking", to: "/app/qr-tracking", icon: QrCode, roles: ["admin", "coordinator", "inspector", "engineer", "inventory"], group: "Insights" },
  { label: "Audit Logs", to: "/app/audit-logs", icon: ScrollText, roles: ["admin"], group: "Insights" },

  { label: "Users", to: "/app/users", icon: UserCog, roles: ["admin"], group: "Administration" },
  { label: "Office Assets", to: "/app/office-assets", icon: BriefcaseBusiness, roles: ["admin"], group: "Administration" },
  { label: "Settings", to: "/app/settings", icon: Settings, roles: ["admin"], group: "Administration" },
];

export const navGroups = ["Overview", "Operations", "Supply Chain", "Contracts & Finance", "Insights", "Administration"];
