import { prisma } from "@/db/prisma";
import type { InventoryItem, Prisma } from "@prisma/client";

export class InventoryRepository {
  async findAll(tenantId: string, branchId?: string): Promise<InventoryItem[]> {
    return prisma.inventoryItem.findMany({
      where: { tenantId, ...(branchId && branchId !== "all" ? { branchId } : {}) },
      orderBy: { name: "asc" },
    });
  }

  async findLowStock(tenantId: string): Promise<InventoryItem[]> {
    const items = await prisma.inventoryItem.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
    });
    return items.filter((i) => i.inStock <= i.reorderLevel);
  }

  async findById(id: string, tenantId: string): Promise<InventoryItem | null> {
    return prisma.inventoryItem.findFirst({ where: { id, tenantId } });
  }

  async create(tenantId: string, data: Omit<Prisma.InventoryItemUncheckedCreateInput, "tenantId">): Promise<InventoryItem> {
    return prisma.inventoryItem.create({ data: { ...data, tenantId } });
  }

  async update(id: string, tenantId: string, data: Prisma.InventoryItemUpdateInput): Promise<InventoryItem> {
    return prisma.inventoryItem.update({ where: { id }, data });
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await prisma.inventoryItem.deleteMany({ where: { id, tenantId } });
  }
}

export const inventoryRepository = new InventoryRepository();
