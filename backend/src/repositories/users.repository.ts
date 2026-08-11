import { prisma } from "@/db/prisma";
import type { User } from "@prisma/client";

export type SafeUser = Omit<User, "passwordHash">;

export const toSafeUser = (user: User): SafeUser => {
  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
};

export class UsersRepository {
  async findAllByTenant(tenantId: string, filters?: { role?: string; isActive?: boolean }): Promise<User[]> {
    return prisma.user.findMany({
      where: {
        tenantId,
        ...(filters?.role
          ? {
              OR: [
                { role: filters.role as User["role"] },
                { roleAssignments: { some: { role: { key: filters.role } } } },
              ],
            }
          : {}),
        ...(filters?.isActive !== undefined ? { isActive: filters.isActive } : {}),
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });
  }

  async findById(id: string, tenantId: string): Promise<User | null> {
    return prisma.user.findFirst({ where: { id, tenantId } });
  }

  async findByUsername(username: string, tenantId: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: { tenantId, username: username.toLowerCase() },
    });
  }

  async findByEmail(email: string, tenantId: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: { tenantId, email: email.toLowerCase() },
    });
  }

  async create(data: {
    tenantId: string;
    name: string;
    username: string;
    email: string;
    passwordHash: string;
    role: User["role"];
    phone?: string;
    isActive?: boolean;
    branchId?: string;
    avatarColor?: string;
    customerId?: string;
  }): Promise<User> {
    return prisma.user.create({
      data: {
        ...data,
        username: data.username.toLowerCase(),
        email: data.email.toLowerCase(),
      },
    });
  }

  async update(
    id: string,
    tenantId: string,
    data: Partial<{
      name: string;
      username: string;
      email: string;
      passwordHash: string;
      role: User["role"];
      phone: string | null;
      isActive: boolean;
      branchId: string | null;
      avatarColor: string;
      customerId: string | null;
    }>,
  ): Promise<User> {
    const existing = await this.findById(id, tenantId);
    if (!existing) throw new Error("User not found");

    const normalized = {
      ...data,
      ...(data.username ? { username: data.username.toLowerCase() } : {}),
      ...(data.email ? { email: data.email.toLowerCase() } : {}),
    };

    return prisma.user.update({
      where: { id },
      data: normalized,
    });
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const existing = await this.findById(id, tenantId);
    if (!existing) throw new Error("User not found");
    await prisma.user.delete({ where: { id } });
  }
}

export const usersRepository = new UsersRepository();
