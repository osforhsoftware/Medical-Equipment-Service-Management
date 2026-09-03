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
  return getUserRoles(user).some((role) => allowed.includes(role));
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
