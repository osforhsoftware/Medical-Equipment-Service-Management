import { prisma } from "@/db/prisma";
import type { AuditLog } from "@prisma/client";

export class AuditLogsRepository {
  async findAll(tenantId: string, page = 1, limit = 50): Promise<{ data: AuditLog[]; total: number }> {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where: { tenantId } }),
    ]);
    return { data, total };
  }

  async create(data: {
    tenantId: string;
    actor: string;
    role: string;
    action: string;
    entity: string;
    ip: string;
  }): Promise<AuditLog> {
    return prisma.auditLog.create({ data });
  }
}

export const auditLogsRepository = new AuditLogsRepository();
