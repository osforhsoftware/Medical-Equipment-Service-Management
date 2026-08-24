/**
 * Canonical API write-access matrix used by route guards and RBAC tests.
 * Read endpoints may be broader; mutations must match these roles.
 */
export const API_WRITE_ACCESS = {
  "users.write": ["admin"],
  "customers.write": ["admin", "coordinator", "estimator"],
  "equipment.write": ["admin", "coordinator", "inventory"],
  "tickets.create": ["admin", "coordinator"],
  "tickets.update": ["admin", "coordinator"],
  "tickets.assign": ["admin", "coordinator"],
  "tickets.workflow": ["admin", "coordinator", "inspector", "estimator", "engineer", "billing"],
  "tickets.reopen": ["admin", "coordinator"],
  "tickets.delete": ["admin"],
  "inspections.write": ["admin", "coordinator", "inspector"],
  "estimates.write": ["admin", "coordinator", "estimator"],
  "estimates.decide": ["admin", "coordinator", "inspector", "engineer", "customer"],
  "jobs.write": ["admin", "coordinator", "engineer"],
  "inventory.write": ["admin", "inventory"],
  "inventory.adjust": ["admin", "inventory"],
  "suppliers.write": ["admin", "inventory"],
  "purchaseOrders.write": ["admin", "inventory"],
  "purchaseOrders.receive": ["admin", "inventory"],
  "stockTransfers.write": ["admin", "inventory"],
  "amc.write": ["admin", "coordinator", "billing"],
  "sales.write": ["admin", "coordinator", "estimator"],
  "sales.fulfill": ["admin", "inventory", "coordinator"],
  "settings.write": ["admin"],
  "taxonomy.write": ["admin", "coordinator", "inventory"],
  "auditLogs.write": ["admin"],
  "files.upload": ["admin", "coordinator", "inspector", "estimator", "engineer", "inventory", "billing"],
  "notifications.write": ["admin", "coordinator", "inspector", "estimator", "engineer", "inventory", "billing"],
} as const;

export type ApiWritePermission = keyof typeof API_WRITE_ACCESS;

export const ALL_ROLES = [
  "admin",
  "coordinator",
  "inspector",
  "estimator",
  "engineer",
  "inventory",
  "billing",
  "customer",
] as const;

export type AppRole = (typeof ALL_ROLES)[number];

/** Staff who can approve/reject estimates and assign an engineer. */
export const ESTIMATE_STAFF_APPROVER_ROLES = ["admin", "coordinator", "inspector", "engineer"] as const;

export function rolesFor(permission: ApiWritePermission): readonly string[] {
  return API_WRITE_ACCESS[permission];
}

export function wrongRolesFor(permission: ApiWritePermission): AppRole[] {
  const allowed = new Set<string>(API_WRITE_ACCESS[permission]);
  return ALL_ROLES.filter((role) => !allowed.has(role));
}
