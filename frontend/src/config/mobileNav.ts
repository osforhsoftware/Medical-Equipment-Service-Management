import {
  Bell,
  Boxes,
  ClipboardList,
  FileText,
  Home,
  QrCode,
  Receipt,
  Search,
  Store,
  User,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/data/types";

export interface MobileNavTab {
  id: string;
  label: string;
  icon: LucideIcon;
  to: string;
  /** RBAC module label — tab hidden when the user's role is not permitted. */
  module?: string;
}

export const MOBILE_NAV_TABS: MobileNavTab[] = [
  { id: "home", label: "Home", icon: Home, to: "/app", module: "Dashboard" },
  { id: "jobs", label: "Jobs", icon: Wrench, to: "/app/jobs", module: "Service Jobs" },
  { id: "inspections", label: "Inspect", icon: Search, to: "/app/inspections", module: "Inspections" },
  { id: "estimates", label: "Estimates", icon: FileText, to: "/app/estimates", module: "Estimates" },
  { id: "sales", label: "Sales", icon: Store, to: "/app/sales", module: "Sales" },
  { id: "inventory", label: "Stock", icon: Boxes, to: "/app/inventory", module: "Inventory Items" },
  { id: "billing", label: "Billing", icon: Receipt, to: "/app/billing", module: "Billing" },
  { id: "tickets", label: "Tickets", icon: ClipboardList, to: "/app/service-tickets", module: "Service Tickets" },
  { id: "scan", label: "Scan", icon: QrCode, to: "/app/qr-tracking", module: "QR Tracking" },
  { id: "alerts", label: "Alerts", icon: Bell, to: "/app/notifications", module: "Notifications" },
  { id: "profile", label: "Profile", icon: User, to: "/app/profile" },
];

/** Preferred bottom-nav tab order per role (max 5). Profile is always last when included. */
const MOBILE_NAV_ORDER: Record<Role, string[]> = {
  admin: ["home", "jobs", "alerts", "billing", "profile"],
  coordinator: ["home", "jobs", "tickets", "alerts", "profile"],
  inspector: ["home", "inspections", "scan", "alerts", "profile"],
  estimator: ["home", "estimates", "billing", "tickets", "profile"],
  sales: ["home", "sales", "alerts", "profile"],
  engineer: ["home", "jobs", "scan", "alerts", "profile"],
  inventory: ["home", "inventory", "scan", "alerts", "profile"],
  billing: ["home", "billing", "estimates", "alerts", "profile"],
  customer: ["home", "profile"],
};

function canAccessModule(
  module: string | undefined,
  roles: Role[],
  rbacMatrix: Record<string, Role[]>,
): boolean {
  if (!module) return true;
  const allowed = rbacMatrix[module];
  return allowed ? roles.some((role) => allowed.includes(role)) : true;
}

export function getMobileNavTabs(
  roleOrRoles: Role | Role[],
  rbacMatrix: Record<string, Role[]>,
): MobileNavTab[] {
  const roles = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles];
  const primary = roles[0] ?? "engineer";
  const seen = new Set<string>();
  const tabs: MobileNavTab[] = [];
  const roleOrder = [primary, ...roles.filter((role) => role !== primary)];

  for (const role of roleOrder) {
    const order = MOBILE_NAV_ORDER[role] ?? MOBILE_NAV_ORDER.engineer;
    for (const id of order) {
      if (seen.has(id) || tabs.length >= 5) continue;
      const tab = MOBILE_NAV_TABS.find((entry) => entry.id === id);
      if (!tab) continue;
      if (tab.id !== "profile" && !canAccessModule(tab.module, roles, rbacMatrix)) continue;
      seen.add(id);
      tabs.push(tab);
    }
  }

  return tabs.slice(0, 5);
}

export function isMobileTabActive(pathname: string, tabTo: string): boolean {
  if (tabTo === "/app") return pathname === "/app" || pathname === "/app/";
  if (tabTo === "/app/jobs") return pathname.startsWith("/app/jobs");
  if (tabTo === "/app/inspections") return pathname.startsWith("/app/inspections");
  if (tabTo === "/app/billing") return pathname.startsWith("/app/billing");
  if (tabTo === "/app/sales") return pathname.startsWith("/app/sales");
  if (tabTo === "/app/notifications") return pathname.startsWith("/app/notifications");
  return pathname.startsWith(tabTo);
}

/** Roles that may create service tickets from the mobile FAB. */
export function canCreateFromMobileFab(roles: Role | Role[], rbacMatrix: Record<string, Role[]>): boolean {
  const userRoles = Array.isArray(roles) ? roles : [roles];
  return userRoles.some(
    (role) => canAccessModule("Service Tickets", [role], rbacMatrix) && ["admin", "coordinator"].includes(role),
  );
}
