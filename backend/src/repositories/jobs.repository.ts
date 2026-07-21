import { prisma } from "@/db/prisma";
import type { ServiceJob, Prisma } from "@prisma/client";

export class JobsRepository {
  async findAll(
    tenantId: string,
    filters?: { status?: string; engineer?: string; engineerId?: string },
  ): Promise<ServiceJob[]> {
    return prisma.serviceJob.findMany({
      where: {
        tenantId,
        ...(filters?.status ? { status: filters.status as ServiceJob["status"] } : {}),
        ...(filters?.engineerId ? { engineerId: filters.engineerId } : {}),
        ...(filters?.engineer && !filters?.engineerId ? { engineer: filters.engineer } : {}),
      },
      orderBy: { scheduledFor: "asc" },
    });
  }

  async findById(id: string, tenantId: string): Promise<ServiceJob | null> {
    return prisma.serviceJob.findFirst({ where: { id, tenantId } });
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
