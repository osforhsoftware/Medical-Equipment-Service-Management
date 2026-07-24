import { prisma } from "@/db/prisma";
import type { ServiceJob, Prisma } from "@prisma/client";

const jobIncludes = {
  assignments: { where: { endedAt: null }, include: { user: true } },
  workLogs: { orderBy: { startedAt: "desc" as const }, include: { user: true } },
  extras: { orderBy: { createdAt: "desc" as const } },
  reservations: true,
  stockMovements: { orderBy: { createdAt: "desc" as const } },
  photos: true,
  signature: true,
} satisfies Prisma.ServiceJobInclude;

export class JobsRepository {
  async findAll(
    tenantId: string,
    filters?: { status?: string; engineer?: string; engineerId?: string },
  ) {
    return prisma.serviceJob.findMany({
      where: {
        tenantId,
        ...(filters?.status ? { status: filters.status as ServiceJob["status"] } : {}),
        ...(filters?.engineerId
          ? {
              OR: [
                { engineerId: filters.engineerId },
                { assignments: { some: { userId: filters.engineerId, endedAt: null } } },
              ],
            }
          : {}),
        ...(filters?.engineer && !filters?.engineerId ? { engineer: filters.engineer } : {}),
      },
      include: jobIncludes,
      orderBy: { scheduledFor: "asc" },
    });
  }

  async findById(id: string, tenantId: string) {
    return prisma.serviceJob.findFirst({ where: { id, tenantId }, include: jobIncludes });
  }

  async create(tenantId: string, data: Omit<Prisma.ServiceJobUncheckedCreateInput, "tenantId">): Promise<ServiceJob> {
    return prisma.serviceJob.create({ data: { ...data, tenantId } });
  }

  async update(id: string, tenantId: string, data: Prisma.ServiceJobUpdateInput): Promise<ServiceJob> {
    return prisma.serviceJob.update({ where: { id }, data });
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await prisma.serviceJob.deleteMany({ where: { id, tenantId } });
  }
}

export const jobsRepository = new JobsRepository();
