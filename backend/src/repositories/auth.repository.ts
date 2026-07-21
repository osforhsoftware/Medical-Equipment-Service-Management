import { prisma } from "@/db/prisma";
import type { User } from "@prisma/client";

export class AuthRepository {
  async findByLogin(identifier: string): Promise<User | null> {
    const normalized = identifier.toLowerCase().trim();
    return prisma.user.findFirst({
      where: {
        OR: [{ username: normalized }, { email: normalized }],
      },
    });
  }

  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  async countAdmins(tenantId: string): Promise<number> {
    return prisma.user.count({ where: { tenantId, role: "admin" } });
  }

  async ensureTenantExists(tenantId: string, tenantName: string): Promise<void> {
    await prisma.tenant.upsert({
      where: { id: tenantId },
      update: {},
      create: { id: tenantId, name: tenantName },
    });
  }
}

export const authRepository = new AuthRepository();
