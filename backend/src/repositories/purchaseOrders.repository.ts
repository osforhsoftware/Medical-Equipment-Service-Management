import { prisma } from "@/db/prisma";
import type { PurchaseOrder, Prisma } from "@prisma/client";

export class PurchaseOrdersRepository {
  async findAll(tenantId: string, status?: string): Promise<PurchaseOrder[]> {
    return prisma.purchaseOrder.findMany({
      where: { tenantId, ...(status ? { status: status as PurchaseOrder["status"] } : {}) },
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(id: string, tenantId: string): Promise<PurchaseOrder | null> {
    return prisma.purchaseOrder.findFirst({ where: { id, tenantId } });
  }

  async create(tenantId: string, data: Omit<Prisma.PurchaseOrderUncheckedCreateInput, "tenantId">): Promise<PurchaseOrder> {
    return prisma.purchaseOrder.create({ data: { ...data, tenantId } });
  }

  async update(id: string, tenantId: string, data: Prisma.PurchaseOrderUpdateInput): Promise<PurchaseOrder> {
    return prisma.purchaseOrder.update({ where: { id }, data });
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await prisma.purchaseOrder.deleteMany({ where: { id, tenantId } });
  }
}

export const purchaseOrdersRepository = new PurchaseOrdersRepository();
