/** Default module access — mirrors frontend nav.ts */
export const DEFAULT_RBAC_MATRIX: Record<string, string[]> = {
  Dashboard: ["admin", "coordinator", "inspector", "estimator", "engineer", "inventory", "billing"],
  Customers: ["admin", "coordinator", "billing"],
  Equipment: ["admin", "coordinator", "inspector", "engineer", "inventory"],
  "Service Tickets": ["admin", "coordinator", "inspector", "estimator", "engineer"],
  "Service Requests": ["admin", "coordinator", "inspector", "estimator", "engineer"],
  Inspections: ["admin", "coordinator", "inspector"],
  Estimates: ["admin", "coordinator", "estimator", "billing", "inspector", "engineer"],
  "Service Jobs": ["admin", "coordinator", "engineer"],
  Inventory: ["admin", "inventory", "engineer", "inspector"],
  "Stock Purchase Requests": ["admin", "inventory", "inspector", "engineer"],
  Suppliers: ["admin", "inventory"],
  "Purchase Orders": ["admin", "inventory"],
  "Stock Transfers": ["admin", "inventory"],
  Billing: ["admin", "billing"],
  Reports: ["admin", "billing", "coordinator"],
  Notifications: ["admin", "coordinator", "inspector", "estimator", "engineer", "inventory", "billing"],
  "QR Tracking": ["admin", "coordinator", "inspector", "engineer", "inventory"],
  "Audit Logs": ["admin"],
  Users: ["admin"],
  "Office Assets": ["admin"],
  "Master Data": ["admin", "coordinator"],
  Settings: ["admin"],
};

export const RBAC_MODULES = Object.keys(DEFAULT_RBAC_MATRIX);

export const RBAC_ROLES = [
  "admin",
  "coordinator",
  "inspector",
  "estimator",
  "engineer",
  "inventory",
  "billing",
] as const;
