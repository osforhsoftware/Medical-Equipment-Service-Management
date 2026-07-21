import { prisma } from "@/db/prisma";
import type { Estimate, Prisma } from "@prisma/client";

export class EstimatesRepository {
  async findAll(tenantId: string): Promise<Estimate[]> {
    return prisma.estimate.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } });
  }

  async findById(id: string, tenantId: string): Promise<Estimate | null> {
    return prisma.estimate.findFirst({ where: { id, tenantId } });
  }

  async create(tenantId: string, data: Omit<Prisma.EstimateUncheckedCreateInput, "tenantId">): Promise<Estimate> {
    return prisma.estimate.create({ data: { ...data, tenantId } });
  }

  async update(id: string, tenantId: string, data: Prisma.EstimateUpdateInput): Promise<Estimate> {
    return prisma.estimate.update({ where: { id }, data });
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await prisma.estimate.deleteMany({ where: { id, tenantId } });
  }
}

export const estimatesRepository = new EstimatesRepository();
