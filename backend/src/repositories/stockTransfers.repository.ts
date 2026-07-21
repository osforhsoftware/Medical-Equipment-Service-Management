import { prisma } from "@/db/prisma";
import type { StockTransfer, Prisma } from "@prisma/client";

export class StockTransfersRepository {
  async findAll(tenantId: string): Promise<StockTransfer[]> {
    return prisma.stockTransfer.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } });
  }

  async findById(id: string, tenantId: string): Promise<StockTransfer | null> {
    return prisma.stockTransfer.findFirst({ where: { id, tenantId } });
  }

  async create(tenantId: string, data: Omit<Prisma.StockTransferUncheckedCreateInput, "tenantId">): Promise<StockTransfer> {
    return prisma.stockTransfer.create({ data: { ...data, tenantId } });
  }

  async update(id: string, tenantId: string, data: Prisma.StockTransferUpdateInput): Promise<StockTransfer> {
    return prisma.stockTransfer.update({ where: { id }, data });
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await prisma.stockTransfer.deleteMany({ where: { id, tenantId } });
  }
}

export const stockTransfersRepository = new StockTransfersRepository();
