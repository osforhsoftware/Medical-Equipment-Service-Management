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
