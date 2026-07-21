import bcrypt from "bcryptjs";
import { usersRepository, toSafeUser } from "@/repositories/users.repository";
import { authRepository } from "@/repositories/auth.repository";
import { AppError } from "@/middleware/errorHandler";

export class UsersService {
  async list(tenantId: string, filters?: { role?: string; isActive?: boolean }) {
    const users = await usersRepository.findAllByTenant(tenantId, filters);
    return users.map(toSafeUser);
  }

  async getById(id: string, tenantId: string) {
    const user = await usersRepository.findById(id, tenantId);
    if (!user) throw new AppError("User not found", 404);
    return toSafeUser(user);
  }

  async create(
    tenantId: string,
    data: {
      name: string;
      username: string;
      email: string;
      password: string;
      role: string;
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

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await usersRepository.create({
      tenantId,
      name: data.name,
      username,
      email,
      passwordHash,
      role: data.role as never,
      phone: data.phone,
      isActive: data.isActive ?? true,
      branchId: data.branchId,
      avatarColor: data.avatarColor,
      customerId: data.customerId,
    });

    return toSafeUser(user);
  }

  async update(
    id: string,
    tenantId: string,
    data: {
      name?: string;
      username?: string;
      email?: string;
      role?: string;
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

    const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : undefined;
    const user = await usersRepository.update(id, tenantId, {
      name: data.name,
      username: data.username?.toLowerCase(),
      email: data.email?.toLowerCase(),
      role: data.role as never,
      phone: data.phone,
      isActive: data.isActive,
      branchId: data.branchId,
      avatarColor: data.avatarColor,
      customerId: data.customerId,
      ...(passwordHash ? { passwordHash } : {}),
    });

    return toSafeUser(user);
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
