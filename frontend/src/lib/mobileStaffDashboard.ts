import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  IndianRupee,
  Package,
  QrCode,
  Receipt,
  Search,
  ShoppingCart,
  Timer,
  UserCheck,
  Wrench,
} from "lucide-react";
import type { Role } from "@/data/types";
import type { DashboardData } from "@/lib/api";

export type MobileQuickAction = { label: string; to: string; icon: LucideIcon; primary?: boolean };

export type MobileStat = {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: "primary" | "accent" | "warning" | "destructive" | "success";
  filter?: string;
};

export const JOB_STATUS_ACTIONS = [
  { value: "scheduled", label: "Assigned", next: "inProgress", nextLabel: "Start Job" },
  { value: "inProgress", label: "In Progress", next: "partsPending", nextLabel: "Need Parts" },
  { value: "partsPending", label: "Waiting Parts", next: "inProgress", nextLabel: "Resume Work" },
  { value: "review", label: "Customer Review", next: "completed", nextLabel: "Complete" },
  { value: "completed", label: "Completed" },
] as const;

export function roleQuickActions(role: Role): MobileQuickAction[] {
  switch (role) {
    case "inspector":
      return [
        { label: "Inspections", to: "/app/inspections", icon: Search, primary: true },
        { label: "Tickets", to: "/app/service-tickets", icon: ClipboardList },
        { label: "Scan QR", to: "/app/qr-tracking", icon: QrCode },
        { label: "Alerts", to: "/app/notifications", icon: Bell },
      ];
    case "estimator":
      return [
        { label: "Estimates", to: "/app/estimates", icon: FileText, primary: true },
        { label: "Tickets", to: "/app/service-tickets", icon: ClipboardList },
        { label: "Customers", to: "/app/customers", icon: UserCheck },
        { label: "Alerts", to: "/app/notifications", icon: Bell },
      ];
    case "sales":
      return [
        { label: "Sales", to: "/app/sales", icon: ShoppingCart, primary: true },
        { label: "New Sale", to: "/app/sales/new", icon: ShoppingCart },
        { label: "Tickets", to: "/app/service-tickets", icon: ClipboardList },
        { label: "Customers", to: "/app/customers", icon: UserCheck },
        { label: "Alerts", to: "/app/notifications", icon: Bell },
      ];
    case "engineer":
      return [
        { label: "My Jobs", to: "/app/jobs", icon: Wrench, primary: true },
        { label: "Parts", to: "/app/inventory", icon: Package },
        { label: "Scan QR", to: "/app/qr-tracking", icon: QrCode },
        { label: "Alerts", to: "/app/notifications", icon: Bell },
      ];
    case "inventory":
      return [
        { label: "Inventory", to: "/app/inventory", icon: Package, primary: true },
        { label: "Purchase", to: "/app/purchase-orders", icon: ShoppingCart },
        { label: "Sales fulfill", to: "/app/sales", icon: ShoppingCart },
        { label: "Alerts", to: "/app/notifications", icon: Bell },
      ];
    case "billing":
      return [
        { label: "Billing", to: "/app/billing", icon: Receipt, primary: true },
        { label: "Sales", to: "/app/sales", icon: ShoppingCart },
        { label: "Estimates", to: "/app/estimates", icon: FileText },
        { label: "Alerts", to: "/app/notifications", icon: Bell },
        { label: "Reports", to: "/app/reports", icon: IndianRupee },
      ];
    case "coordinator":
      return [
        { label: "New Ticket", to: "/app/service-tickets", icon: ClipboardList, primary: true },
        { label: "Schedule", to: "/app/jobs", icon: CalendarClock },
        { label: "Alerts", to: "/app/notifications", icon: Bell },
        { label: "Scan", to: "/app/qr-tracking", icon: QrCode },
      ];
    default:
      return [
        { label: "Tickets", to: "/app/service-tickets", icon: ClipboardList, primary: true },
        { label: "Jobs", to: "/app/jobs", icon: Wrench },
        { label: "Alerts", to: "/app/notifications", icon: Bell },
        { label: "Scan", to: "/app/qr-tracking", icon: QrCode },
      ];
  }
}

export function roleStats(role: Role, data: DashboardData): MobileStat[] {
  const { stats, personal } = data;
  switch (role) {
    case "inspector":
      return [
        { label: "Assigned", value: String(personal.assignedOpen), icon: Search, tone: "primary", filter: "inspection" },
        { label: "Due Today", value: String(personal.dueToday), icon: Timer, tone: "warning", filter: "assigned" },
        { label: "Overdue", value: String(personal.overdue), icon: AlertTriangle, tone: "destructive" },
        { label: "Alerts", value: String(stats.unreadNotifications), icon: Bell, tone: "accent" },
      ];
    case "estimator":
      return [
        { label: "Pending", value: String(stats.pendingEstimates), icon: FileText, tone: "primary", filter: "estimate" },
        { label: "Approval", value: String(personal.pendingApprovals), icon: Clock, tone: "warning", filter: "estimate" },
        { label: "Approved", value: String(personal.completedThisMonth), icon: CheckCircle2, tone: "success" },
        { label: "Alerts", value: String(stats.unreadNotifications), icon: Bell, tone: "accent" },
      ];
    case "sales":
      return [
        { label: "Pending", value: String(stats.pendingInvoices), icon: Receipt, tone: "primary" },
        { label: "Overdue", value: String(stats.overdueInvoices), icon: AlertTriangle, tone: "destructive" },
        { label: "Revenue", value: stats.revenueMtdLabel, icon: IndianRupee, tone: "success" },
        { label: "Alerts", value: String(stats.unreadNotifications), icon: Bell, tone: "accent" },
      ];
    case "engineer":
      return [
        { label: "Assigned", value: String(personal.assignedOpen || stats.activeJobs), icon: Wrench, tone: "primary", filter: "assigned" },
        { label: "In Progress", value: String(personal.inProgress), icon: Clock, tone: "accent", filter: "in-progress" },
        { label: "Due Today", value: String(personal.dueToday), icon: CalendarClock, tone: "warning" },
        { label: "Alerts", value: String(stats.unreadNotifications), icon: Bell, tone: "destructive" },
      ];
    case "inventory":
      return [
        { label: "Low Stock", value: String(stats.lowStockItems), icon: AlertTriangle, tone: "warning" },
        { label: "Parts Req.", value: String(stats.pendingPartsRequests), icon: Package, tone: "primary" },
        { label: "Open POs", value: String(stats.openPurchaseOrders), icon: ShoppingCart, tone: "accent" },
        { label: "Alerts", value: String(stats.unreadNotifications), icon: Bell, tone: "destructive" },
      ];
    case "billing":
      return [
        { label: "Pending", value: String(stats.pendingInvoices), icon: Receipt, tone: "primary", filter: "billing" },
        { label: "Overdue", value: String(stats.overdueInvoices), icon: AlertTriangle, tone: "destructive" },
        { label: "Revenue", value: stats.revenueMtdLabel, icon: IndianRupee, tone: "success" },
        { label: "Alerts", value: String(stats.unreadNotifications), icon: Bell, tone: "accent" },
      ];
    case "coordinator":
      return [
        { label: "Open", value: String(stats.openRequests), icon: ClipboardList, tone: "primary" },
        { label: "Unassigned", value: String(stats.unassignedRequests), icon: UserCheck, tone: "warning", filter: "assigned" },
        { label: "Active Jobs", value: String(stats.activeJobs), icon: Wrench, tone: "accent", filter: "in-progress" },
        { label: "Alerts", value: String(stats.unreadNotifications), icon: Bell, tone: "destructive" },
      ];
    default:
      return [
        { label: "Requests", value: String(stats.openRequests), icon: ClipboardList, tone: "primary" },
        { label: "Active Jobs", value: String(stats.activeJobs), icon: Wrench, tone: "accent", filter: "in-progress" },
        { label: "Low Stock", value: String(stats.lowStockItems), icon: AlertTriangle, tone: "warning" },
        { label: "Alerts", value: String(stats.unreadNotifications), icon: Bell, tone: "destructive" },
      ];
  }
}

export function queueTitle(role: Role): string {
  switch (role) {
    case "inspector": return "Assigned Inspections";
    case "estimator": return "Estimate Workload";
    case "sales": return "Sales Workload";
    case "engineer": return "My Assigned Work";
    case "inventory": return "Supply Chain Queue";
    case "billing": return "Billing Queue";
    case "coordinator": return "Operations Queue";
    default: return "Work Queue";
  }
}

export const PIPELINE_STAGES = [
  { key: "assigned", label: "Assigned", queueKey: "newAssigned" as const },
  { key: "inspection", label: "Inspection", queueKey: "inspection" as const },
  { key: "estimate", label: "Estimate", queueKey: "estimatePending" as const },
  { key: "approval", label: "Approval", queueKey: "waitingApproval" as const },
  { key: "in-progress", label: "Service", queueKey: "servicePending" as const },
  { key: "completed", label: "Done", queueKey: "completed" as const },
];

const FILTER_OPTIONS_BY_ROLE: Partial<Record<Role, string[]>> = {
  inspector: ["all", "assigned", "inspection", "in-progress", "completed"],
  estimator: ["all", "estimate", "assigned", "completed"],
  sales: ["all", "billing", "completed"],
  engineer: ["all", "assigned", "in-progress", "completed"],
  billing: ["all", "billing", "completed"],
  inventory: ["all", "assigned", "in-progress"],
  coordinator: ["all", "assigned", "inspection", "estimate", "in-progress", "completed"],
};

const PIPELINE_BY_ROLE: Partial<Record<Role, string[]>> = {
  inspector: ["assigned", "inspection", "in-progress", "completed"],
  estimator: ["estimate", "approval", "completed"],
  sales: ["completed"],
  engineer: ["assigned", "in-progress", "completed"],
  billing: ["completed"],
  inventory: ["assigned", "in-progress"],
};

const ALL_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "assigned", label: "Assigned" },
  { value: "inspection", label: "Inspection" },
  { value: "estimate", label: "Estimate" },
  { value: "in-progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "billing", label: "Billing" },
] as const;

export function roleFilterOptions(role: Role) {
  const allowed = FILTER_OPTIONS_BY_ROLE[role];
  if (!allowed) return [...ALL_FILTER_OPTIONS];
  return ALL_FILTER_OPTIONS.filter((o) => allowed.includes(o.value));
}

export function rolePipelineStages(role: Role) {
  const allowed = PIPELINE_BY_ROLE[role];
  if (!allowed) return PIPELINE_STAGES;
  return PIPELINE_STAGES.filter((s) => allowed.includes(s.key));
}

export function rolePrimaryListPath(role: Role): string {
  switch (role) {
    case "inspector": return "/app/inspections";
    case "estimator": return "/app/estimates";
    case "sales": return "/app/sales";
    case "engineer": return "/app/jobs";
    case "billing": return "/app/billing";
    case "inventory": return "/app/inventory";
    default: return "/app/service-tickets";
  }
}

/** Page to open when the user taps the overdue alert banner. */
export function roleOverduePath(role: Role): string {
  switch (role) {
    case "engineer":
      return "/app/jobs?filter=overdue";
    case "billing":
      return "/app/billing?queue=overdue";
    case "inspector":
      return "/app/inspections";
    case "inventory":
      return "/app/inventory";
    case "estimator":
      return "/app/estimates";
    case "sales":
      return "/app/sales";
    default:
      return "/app/service-tickets?filter=overdue";
  }
}

export function showTodaySchedule(role: Role): boolean {
  return role === "engineer" || role === "admin" || role === "coordinator";
}

const PATH_TO_MODULE: Record<string, string> = {
  "/app": "Dashboard",
  "/app/inspections": "Inspections",
  "/app/qr-tracking": "QR Tracking",
  "/app/service-tickets": "Service Tickets",
  "/app/service-requests": "Service Tickets",
  "/app/estimates": "Estimates",
  "/app/sales": "Sales",
  "/app/jobs": "Service Jobs",
  "/app/inventory": "Inventory Items",
  "/app/purchase-orders": "Purchase Orders",
  "/app/purchase-returns": "Purchase Returns",
  "/app/stock-transfers": "Stock Transfers",
  "/app/stock-ledger": "Stock Ledger",
  "/app/billing": "Billing",
  "/app/notifications": "Notifications",
  "/app/reports": "Reports",
  "/app/customers": "Customers",
  "/app/users": "Users",
};

function moduleForPath(path: string): string | undefined {
  const match = Object.entries(PATH_TO_MODULE)
    .sort((a, b) => b[0].length - a[0].length)
    .find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
  return match?.[1];
}

export function filterQuickActionsByAccess(
  actions: MobileQuickAction[],
  roleOrRoles: Role | Role[],
  rbacMatrix: Record<string, Role[]>,
): MobileQuickAction[] {
  const roles = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles];
  return actions.filter((action) => {
    const module = moduleForPath(action.to);
    if (!module) return true;
    const allowed = rbacMatrix[module];
    return allowed ? roles.some((role) => allowed.includes(role)) : true;
  });
}

export function resolveItemPath(kind: string, id: string, href: string): string {
  if (kind === "job") return `/app/jobs/${id}`;
  if (kind === "invoice") return `/app/billing/invoices/${id}`;
  return href;
}

export function normalizeJobStatus(status: string): string {
  if (status === "in-progress" || status === "inProgress") return "inProgress";
  if (status === "parts-pending" || status === "partsPending") return "partsPending";
  return status;
}

export function nextJobAction(status: string) {
  return JOB_STATUS_ACTIONS.find((a) => a.value === normalizeJobStatus(status));
}
