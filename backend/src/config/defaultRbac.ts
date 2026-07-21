/** Default module access — mirrors frontend nav.ts */
export const DEFAULT_RBAC_MATRIX: Record<string, string[]> = {
  Dashboard: ["admin", "coordinator", "inspector", "estimator", "engineer", "inventory", "billing"],
  Customers: ["admin", "coordinator", "billing"],
  Equipment: ["admin", "coordinator", "inspector", "engineer", "inventory"],
  "Service Requests": ["admin", "coordinator", "inspector", "engineer"],
  Inspections: ["admin", "coordinator", "inspector"],
  Estimates: ["admin", "coordinator", "estimator", "billing"],
  "Service Jobs": ["admin", "coordinator", "engineer"],
  Inventory: ["admin", "inventory", "engineer"],
  Suppliers: ["admin", "inventory"],
  "Purchase Orders": ["admin", "inventory"],
  "Stock Transfers": ["admin", "inventory"],
  "AMC Contracts": ["admin", "coordinator", "billing"],
  Billing: ["admin", "billing"],
  Reports: ["admin", "billing", "coordinator"],
  Notifications: ["admin", "coordinator", "inspector", "estimator", "engineer", "inventory", "billing"],
  "QR Tracking": ["admin", "coordinator", "inspector", "engineer", "inventory"],
  "Audit Logs": ["admin"],
  Branches: ["admin"],
  Users: ["admin"],
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
