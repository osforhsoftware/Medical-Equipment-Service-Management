import { prisma } from "@/db/prisma";
import type { TenantSettings, Prisma } from "@prisma/client";
import { DEFAULT_RBAC_MATRIX } from "@/config/defaultRbac";

export class SettingsRepository {
  async findByTenantId(tenantId: string): Promise<TenantSettings | null> {
    return prisma.tenantSettings.findUnique({ where: { tenantId } });
  }

  async ensureDefaults(tenantId: string): Promise<TenantSettings> {
    const existing = await this.findByTenantId(tenantId);
    if (existing) return existing;

    return prisma.tenantSettings.create({
      data: {
        tenantId,
        rbacMatrix: DEFAULT_RBAC_MATRIX as Prisma.InputJsonValue,
      },
    });
  }

  async update(tenantId: string, data: Prisma.TenantSettingsUpdateInput): Promise<TenantSettings> {
    return prisma.tenantSettings.update({ where: { tenantId }, data });
  }

  async updateTenantName(tenantId: string, name: string) {
    return prisma.tenant.update({ where: { id: tenantId }, data: { name } });
  }

  async getTenantName(tenantId: string): Promise<string> {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
    return tenant?.name ?? "";
  }
}

export const settingsRepository = new SettingsRepository();
