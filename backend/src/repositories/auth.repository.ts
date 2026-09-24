import { prisma } from "@/db/prisma";
import type { User } from "@prisma/client";

export class AuthRepository {
  async findByLogin(identifier: string, tenantId?: string): Promise<User | null> {
    const normalized = identifier.toLowerCase().trim();
    if (tenantId) {
      return prisma.user.findFirst({
        where: {
          tenantId,
          OR: [{ username: normalized }, { email: normalized }],
        },
      });
    }
    // Usernames/emails are only unique per tenant. If the identifier matches
    // users in more than one tenant, fail closed (caller returns the generic
    // invalid-credentials error) instead of logging into an arbitrary tenant.
    const matches = await prisma.user.findMany({
      where: {
        OR: [{ username: normalized }, { email: normalized }],
      },
      take: 2,
    });
    return matches.length === 1 ? matches[0] : null;
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
