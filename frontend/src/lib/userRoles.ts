import { navItems, navModuleForPath } from "@/config/nav";
import type { AppUser, Role } from "@/data/types";

export function getUserRoles(user: AppUser): Role[] {
  if (user.roles?.length) return user.roles;
  return [user.role];
}

export function userHasAnyRole(user: AppUser, roles: readonly Role[]): boolean {
  return getUserRoles(user).some((role) => roles.includes(role));
}

export function userCanAccessModule(
  user: AppUser,
  module: string,
  rbacMatrix: Record<string, Role[]>,
  fallbackRoles?: readonly Role[],
): boolean {
  const allowed = rbacMatrix[module] ?? fallbackRoles ?? [];
  if (!allowed.length) return false;
  if (!getUserRoles(user).some((role) => allowed.includes(role))) return false;

  const override = user.permissions?.modules?.[module];
  if (override === "none") {
    // Older estimator records stored Inspections as Hidden before this desk could view reports.
    if (module === "Inspections" && getUserRoles(user).includes("estimator")) return true;
    return false;
  }
  return true;
}

export function userCanAccessPath(
  user: AppUser,
  path: string,
  rbacMatrix: Record<string, Role[]>,
): boolean {
  const module = navModuleForPath(path);
  if (!module) return true;
  const fallbackRoles = navItems.find((item) => item.label === module)?.roles;
  return userCanAccessModule(user, module, rbacMatrix, fallbackRoles);
}

/** Roles required to open a sidebar child or in-page tab. Undefined means the parent module is enough. */
export function rolesRequiredForTarget(to: string): readonly Role[] | undefined {
  const [path, query = ""] = to.split("?");
  const matches: { roles?: readonly Role[] }[] = [];
  for (const item of navItems) {
    for (const child of item.children ?? []) {
      const [childPath, childQuery = ""] = child.to.split("?");
      if (childPath !== path) continue;
      if (query) {
        if (childQuery === query) matches.push(child);
      } else if (!childQuery) {
        matches.push(child);
      }
    }
  }
  return matches.find((child) => child.roles?.length)?.roles;
}

/** True when this staff member is allowed to open the link (page role list, when one exists). */
export function userCanOpenNavTarget(user: AppUser, to: string): boolean {
  const roles = rolesRequiredForTarget(to);
  if (!roles?.length) return true;
  return userHasAnyRole(user, roles);
}

/** Module access plus any stricter page role list (sidebar children, stage tabs, shortcuts). */
export function userCanOpenPage(
  user: AppUser,
  to: string,
  rbacMatrix: Record<string, Role[]>,
): boolean {
  if (!userCanOpenNavTarget(user, to)) return false;
  return userCanAccessPath(user, to.split("?")[0], rbacMatrix);
}
