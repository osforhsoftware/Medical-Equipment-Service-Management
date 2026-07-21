import { prisma } from "@/db/prisma";
import type { AmcContract, Prisma } from "@prisma/client";

export class AmcRepository {
  async findAll(tenantId: string, status?: string): Promise<AmcContract[]> {
    return prisma.amcContract.findMany({
      where: { tenantId, ...(status ? { status: status as AmcContract["status"] } : {}) },
      orderBy: { endDate: "asc" },
    });
  }

  async findById(id: string, tenantId: string): Promise<AmcContract | null> {
    return prisma.amcContract.findFirst({ where: { id, tenantId } });
  }

  async create(tenantId: string, data: Omit<Prisma.AmcContractUncheckedCreateInput, "tenantId">): Promise<AmcContract> {
    return prisma.amcContract.create({ data: { ...data, tenantId } });
  }

  async update(id: string, tenantId: string, data: Prisma.AmcContractUpdateInput): Promise<AmcContract> {
    return prisma.amcContract.update({ where: { id }, data });
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await prisma.amcContract.deleteMany({ where: { id, tenantId } });
  }
}

export const amcRepository = new AmcRepository();
