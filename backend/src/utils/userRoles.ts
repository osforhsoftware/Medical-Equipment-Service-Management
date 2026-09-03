import { prisma } from "@/db/prisma";
import type { User } from "@prisma/client";
import { ALL_ROLES } from "@/config/apiAccess";
import { AppError } from "@/middleware/errorHandler";
import { toSafeUser, type SafeUser } from "@/repositories/users.repository";
import { getRoleLabel } from "@/utils/roleLabels";

export type EnrichedUser = SafeUser & { roles: string[] };

export async function ensureSystemRoles(tenantId: string): Promise<void> {
  const existing = await prisma.role.findMany({
    where: { tenantId },
    select: { key: true },
  });
  const have = new Set(existing.map((role) => role.key));
  const missing = ALL_ROLES.filter((key) => !have.has(key));
  if (missing.length) {
    await prisma.role.createMany({
      data: missing.map((key) => ({
        tenantId,
        key,
        name: getRoleLabel(key),
        isSystem: true,
        permissions: {},
      })),
    });
  }

  await prisma.role.updateMany({
    where: { tenantId, key: "estimator", isSystem: true },
    data: { name: getRoleLabel("estimator") },
  });
}

export async function collectUserRoleKeys(
  userId: string,
  tenantId: string,
  primaryRole: string,
): Promise<string[]> {
  const assignments = await prisma.userRoleAssignment.findMany({
    where: { tenantId, userId },
    include: { role: { select: { key: true } } },
  });
  return [...new Set([primaryRole, ...assignments.map((a) => a.role.key)])];
}

export async function enrichUserWithRoles(user: User, tenantId: string): Promise<EnrichedUser> {
  const roles = await collectUserRoleKeys(user.id, tenantId, user.role);
  return { ...toSafeUser(user), roles };
}

export async function syncUserRoleAssignments(
  tenantId: string,
  userId: string,
  roleKeys: string[],
): Promise<void> {
  const uniqueKeys = [...new Set(roleKeys)];
  if (uniqueKeys.length === 0) {
    throw new AppError("At least one role is required", 400);
  }

  const tenantRoles = await prisma.role.findMany({
    where: { tenantId, key: { in: uniqueKeys } },
  });
  const roleIdsByKey = new Map(tenantRoles.map((role) => [role.key, role.id]));

  for (const key of uniqueKeys) {
    if (!roleIdsByKey.has(key)) {
      throw new AppError(`Role "${key}" is not configured for this tenant`, 400);
    }
  }

  const targetRoleIds = new Set(uniqueKeys.map((key) => roleIdsByKey.get(key)!));
  const existing = await prisma.userRoleAssignment.findMany({
    where: { tenantId, userId },
  });

  const toRemove = existing.filter((assignment) => !targetRoleIds.has(assignment.roleId));
  if (toRemove.length) {
    await prisma.userRoleAssignment.deleteMany({
      where: { id: { in: toRemove.map((assignment) => assignment.id) } },
    });
  }

  const existingRoleIds = new Set(existing.map((assignment) => assignment.roleId));
  const toCreate = [...targetRoleIds].filter((roleId) => !existingRoleIds.has(roleId));
  if (toCreate.length) {
    await prisma.userRoleAssignment.createMany({
      data: toCreate.map((roleId) => ({ tenantId, userId, roleId })),
    });
  }
}

export async function userHasAnyRoleKey(
  userId: string,
  tenantId: string,
  primaryRole: string,
  allowedRoles: readonly string[],
): Promise<boolean> {
  if (allowedRoles.includes(primaryRole)) return true;
  const match = await prisma.userRoleAssignment.findFirst({
    where: {
      tenantId,
      userId,
      role: { key: { in: [...allowedRoles] } },
    },
  });
  return !!match;
}

export async function findActiveStaffWithRole(
  tenantId: string,
  userId: string,
  role: string,
) {
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId, isActive: true },
  });
  if (!user) return null;
  const allowed = await userHasAnyRoleKey(user.id, tenantId, user.role, [role]);
  return allowed ? user : null;
}
