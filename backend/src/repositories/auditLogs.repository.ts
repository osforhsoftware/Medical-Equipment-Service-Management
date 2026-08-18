import { prisma } from "@/db/prisma";
import type { AuditLog } from "@prisma/client";
import type { PaginatedResult } from "@/types";
import { searchContains } from "@/utils/searchFilter";

export class AuditLogsRepository {
  async findAll(
    tenantId: string,
    page = 1,
    limit = 25,
    search?: string,
    role?: string,
  ): Promise<PaginatedResult<AuditLog>> {
    const skip = (page - 1) * limit;
    const where = {
      tenantId,
      ...(role ? { role } : {}),
      ...(search
        ? {
            OR: [
              { actor: searchContains(search) },
              { action: searchContains(search) },
              { entity: searchContains(search) },
              { ip: searchContains(search) },
              { role: searchContains(search) },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
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
