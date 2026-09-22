/** Default module access — mirrors frontend nav.ts (must match API route roles). */
export const DEFAULT_RBAC_MATRIX: Record<string, string[]> = {
  Dashboard: ["admin", "coordinator", "inspector", "estimator", "sales", "engineer", "inventory", "billing"],
  Sales: ["admin", "sales", "billing", "inventory"],
  "Sales Enquiries": ["admin", "sales", "coordinator", "billing"],
  Customers: ["admin", "coordinator", "estimator", "sales", "billing"],
  Equipment: ["admin", "coordinator", "inspector", "engineer", "inventory"],
  "Service Tickets": ["admin", "coordinator", "inspector", "estimator", "engineer", "sales"],
  "Service Requests": ["admin", "coordinator", "inspector", "estimator", "engineer", "sales"],
  Inspections: ["admin", "coordinator", "inspector"],
  Estimates: ["admin", "coordinator", "estimator", "billing"],
  "Service Jobs": ["admin", "coordinator", "engineer"],
  /** Projects page reads the jobs API — keep in sync with jobs.routes canRead (minus engineer, who uses Service Jobs). */
  Projects: ["admin", "coordinator"],
  "Service Catalog": ["admin", "coordinator", "estimator"],
  "Warranty Claims": ["admin", "coordinator", "inspector", "estimator", "engineer", "sales"],
  Inventory: ["admin", "inventory", "engineer"],
  "Inventory Items": ["admin", "inventory", "engineer"],
  "Stock Purchase Requests": ["admin", "inventory", "engineer"],
  Suppliers: ["admin", "inventory"],
  "Supplier RFQs": ["admin", "inventory", "coordinator", "billing"],
  "Purchase Orders": ["admin", "inventory"],
  "Purchase Returns": ["admin", "inventory"],
  "Stock Transfers": ["admin", "inventory"],
  "Stock Ledger": ["admin", "inventory"],
  Billing: ["admin", "billing"],
  "Expenses & Commissions": ["admin", "billing"],
  Reports: ["admin", "billing", "coordinator"],
  Notifications: ["admin", "coordinator", "inspector", "estimator", "sales", "engineer", "inventory", "billing"],
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
  "sales",
  "engineer",
  "inventory",
  "billing",
] as const;
