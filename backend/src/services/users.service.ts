import bcrypt from "bcryptjs";
import { usersRepository, toSafeUser } from "@/repositories/users.repository";
import { authRepository } from "@/repositories/auth.repository";
import { AppError } from "@/middleware/errorHandler";
import { enrichUserWithRoles, syncUserRoleAssignments } from "@/utils/userRoles";

function resolveRoleSelection(data: { role?: string; roles?: string[]; primaryRole?: string }) {
  const roles = data.roles?.length ? data.roles : data.role ? [data.role] : undefined;
  if (!roles?.length) return undefined;
  const primaryRole = data.primaryRole ?? data.role ?? roles[0];
  if (!roles.includes(primaryRole)) {
    throw new AppError("Primary role must be one of the selected roles", 400);
  }
  return { roles, primaryRole };
}

export class UsersService {
  async list(tenantId: string, filters?: { role?: string; isActive?: boolean }) {
    const users = await usersRepository.findAllByTenant(tenantId, filters);
    return Promise.all(users.map((user) => enrichUserWithRoles(user, tenantId)));
  }

  async getById(id: string, tenantId: string) {
    const user = await usersRepository.findById(id, tenantId);
    if (!user) throw new AppError("User not found", 404);
    return enrichUserWithRoles(user, tenantId);
  }

  async create(
    tenantId: string,
    data: {
      name: string;
      username: string;
      email: string;
      password: string;
      role: string;
      roles?: string[];
      primaryRole?: string;
      phone?: string;
      isActive?: boolean;
      branchId?: string;
      avatarColor?: string;
      customerId?: string;
    },
  ) {
    const username = data.username.toLowerCase();
    const email = data.email.toLowerCase();

    if (await usersRepository.findByUsername(username, tenantId)) {
      throw new AppError("Username already taken", 409);
    }
    if (await usersRepository.findByEmail(email, tenantId)) {
      throw new AppError("Email already registered", 409);
    }

    const roleSelection = resolveRoleSelection(data);
    const primaryRole = roleSelection?.primaryRole ?? data.role;
    const roleKeys = roleSelection?.roles ?? [primaryRole];

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await usersRepository.create({
      tenantId,
      name: data.name,
      username,
      email,
      passwordHash,
      role: primaryRole as never,
      phone: data.phone,
      isActive: data.isActive ?? true,
      branchId: data.branchId,
      avatarColor: data.avatarColor,
      customerId: data.customerId,
    });

    await syncUserRoleAssignments(tenantId, user.id, roleKeys);
    return enrichUserWithRoles(user, tenantId);
  }

  async update(
    id: string,
    tenantId: string,
    data: {
      name?: string;
      username?: string;
      email?: string;
      role?: string;
      roles?: string[];
      primaryRole?: string;
      phone?: string | null;
      isActive?: boolean;
      branchId?: string | null;
      avatarColor?: string;
      customerId?: string | null;
      password?: string;
    },
  ) {
    const existing = await usersRepository.findById(id, tenantId);
    if (!existing) throw new AppError("User not found", 404);

    if (data.username && data.username.toLowerCase() !== existing.username) {
      const taken = await usersRepository.findByUsername(data.username, tenantId);
      if (taken && taken.id !== id) throw new AppError("Username already taken", 409);
    }

    if (data.email && data.email.toLowerCase() !== existing.email) {
      const taken = await usersRepository.findByEmail(data.email, tenantId);
      if (taken && taken.id !== id) throw new AppError("Email already registered", 409);
    }

    const roleSelection = resolveRoleSelection(data);
    const primaryRole = roleSelection?.primaryRole ?? data.role;

    const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : undefined;
    const user = await usersRepository.update(id, tenantId, {
      name: data.name,
      username: data.username?.toLowerCase(),
      email: data.email?.toLowerCase(),
      ...(primaryRole ? { role: primaryRole as never } : {}),
      phone: data.phone,
      isActive: data.isActive,
      branchId: data.branchId,
      avatarColor: data.avatarColor,
      customerId: data.customerId,
      ...(passwordHash ? { passwordHash } : {}),
    });

    if (roleSelection) {
      await syncUserRoleAssignments(tenantId, id, roleSelection.roles);
    } else if (primaryRole && primaryRole !== existing.role) {
      const currentRoles = await enrichUserWithRoles(existing, tenantId);
      const nextRoles = [...new Set(currentRoles.roles.map((role) => (role === existing.role ? primaryRole : role)))];
      await syncUserRoleAssignments(tenantId, id, nextRoles);
    }

    return enrichUserWithRoles(user, tenantId);
  }

  async delete(id: string, tenantId: string, actorId: string) {
    if (id === actorId) throw new AppError("You cannot delete your own account", 400);

    const existing = await usersRepository.findById(id, tenantId);
    if (!existing) throw new AppError("User not found", 404);

    const adminCount = await authRepository.countAdmins(tenantId);
    if (existing.role === "admin" && adminCount <= 1) {
      throw new AppError("Cannot delete the last admin account", 400);
    }

    await usersRepository.delete(id, tenantId);
  }
}

export const usersService = new UsersService();
