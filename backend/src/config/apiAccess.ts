/**
 * Canonical API write-access matrix used by route guards and RBAC tests.
 * Read endpoints may be broader; mutations must match these roles.
 */
export const API_WRITE_ACCESS = {
  "users.write": ["admin"],
  "customers.write": ["admin", "coordinator", "estimator", "sales"],
  "equipment.write": ["admin", "coordinator", "inventory"],
  "tickets.create": ["admin", "coordinator"],
  "tickets.update": ["admin", "coordinator"],
  "tickets.assign": ["admin", "coordinator"],
  "tickets.workflow": ["admin", "coordinator", "inspector", "estimator", "engineer", "billing"],
  "tickets.reopen": ["admin", "coordinator"],
  "tickets.delete": ["admin", "coordinator"],
  "inspections.write": ["admin", "coordinator", "inspector"],
  "estimates.write": ["admin", "coordinator", "estimator"],
  "estimates.decide": ["admin", "coordinator", "customer"],
  "jobs.write": ["admin", "coordinator", "engineer"],
  "inventory.write": ["admin", "inventory"],
  "inventory.adjust": ["admin", "inventory"],
  "suppliers.write": ["admin", "inventory"],
  "purchaseOrders.write": ["admin", "inventory"],
  "purchaseOrders.receive": ["admin", "inventory"],
  "purchaseReturns.write": ["admin", "inventory"],
  "stockTransfers.write": ["admin", "inventory"],
  "amc.write": ["admin", "coordinator", "billing"],
  "sales.write": ["admin", "sales"],
  "sales.fulfill": ["admin", "inventory"],
  "sales.bill": ["admin", "billing", "sales"],
  "billing.write": ["admin", "billing"],
  "settings.write": ["admin"],
  "taxonomy.write": ["admin", "coordinator", "inventory"],
  "auditLogs.write": ["admin"],
  "files.upload": ["admin", "coordinator", "inspector", "estimator", "sales", "engineer", "inventory", "billing"],
  "notifications.write": ["admin", "coordinator", "inspector", "estimator", "sales", "engineer", "inventory", "billing"],
} as const;

export type ApiWritePermission = keyof typeof API_WRITE_ACCESS;

export const ALL_ROLES = [
  "admin",
  "coordinator",
  "inspector",
  "estimator",
  "sales",
  "engineer",
  "inventory",
  "billing",
  "customer",
] as const;

export type AppRole = (typeof ALL_ROLES)[number];

export const SALES_DESK_ROLES = ["admin", "sales", "billing", "inventory"] as const;
export const SALES_WRITE_ROLES = ["admin", "sales"] as const;
export const SALES_BILL_ROLES = ["admin", "billing", "sales"] as const;
export const ESTIMATE_READ_ROLES = ["admin", "coordinator", "estimator", "billing"] as const;
export const ESTIMATE_WRITE_ROLES = ["admin", "coordinator", "estimator"] as const;
export const SERVICE_BILLING_ROLES = ["admin", "billing"] as const;
export const CUSTOMER_READ_ROLES = ["admin", "coordinator", "estimator", "sales", "billing"] as const;
export const CUSTOMER_WRITE_ROLES = ["admin", "coordinator", "estimator", "sales"] as const;

/** Staff who can approve/reject estimates and assign an engineer. */
export const ESTIMATE_STAFF_APPROVER_ROLES = ["admin", "coordinator"] as const;

export function rolesFor(permission: ApiWritePermission): readonly string[] {
  return API_WRITE_ACCESS[permission];
}

export function wrongRolesFor(permission: ApiWritePermission): AppRole[] {
  const allowed = new Set<string>(API_WRITE_ACCESS[permission]);
  return ALL_ROLES.filter((role) => !allowed.has(role));
}
