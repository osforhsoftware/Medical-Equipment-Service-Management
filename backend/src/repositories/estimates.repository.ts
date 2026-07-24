import { prisma } from "@/db/prisma";
import type { Prisma } from "@prisma/client";

export class EstimatesRepository {
  async findAll(tenantId: string) {
    return prisma.estimate.findMany({
      where: { tenantId },
      include: {
        lineItems: true,
        decisions: { orderBy: { createdAt: "desc" } },
        revisions: { orderBy: { revision: "desc" } },
        reservations: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(id: string, tenantId: string) {
    return prisma.estimate.findFirst({
      where: { id, tenantId },
      include: {
        lineItems: true,
        decisions: { orderBy: { createdAt: "desc" } },
        revisions: { orderBy: { revision: "desc" } },
        reservations: true,
      },
    });
  }

  async create(tenantId: string, data: Omit<Prisma.EstimateUncheckedCreateInput, "tenantId">) {
    return prisma.estimate.create({ data: { ...data, tenantId } });
  }

  async update(id: string, tenantId: string, data: Prisma.EstimateUpdateInput) {
    const exists = await prisma.estimate.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!exists) return null;
    return prisma.estimate.update({
      where: { id },
      data,
      include: { lineItems: true, decisions: true, revisions: true, reservations: true },
    });
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await prisma.estimate.deleteMany({ where: { id, tenantId } });
  }
}

export const estimatesRepository = new EstimatesRepository();
