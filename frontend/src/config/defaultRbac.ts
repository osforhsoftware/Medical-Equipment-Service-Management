import type { Role } from "@/data/types";
import { navItems } from "@/config/nav";

export function buildDefaultRbacMatrix(): Record<string, Role[]> {
  return Object.fromEntries(navItems.map((item) => [item.label, [...item.roles]]));
}

export const RBAC_ROLES: Role[] = [
  "admin",
  "coordinator",
  "inspector",
  "estimator",
  "sales",
  "engineer",
  "inventory",
  "billing",
  "qa",
];

export const RBAC_MODULES = navItems.map((item) => item.label);
