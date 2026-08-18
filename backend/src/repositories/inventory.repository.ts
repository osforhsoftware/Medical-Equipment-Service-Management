import { prisma } from "@/db/prisma";
import type { InventoryItem, Prisma } from "@prisma/client";
import type { PaginatedResult } from "@/types";
import { searchContains } from "@/utils/searchFilter";

export interface InventoryListFilters {
  branchId?: string;
  category?: string;
  stockStatus?: string;
  supplierId?: string;
  search?: string;
  skip: number;
  take: number;
  orderBy: Prisma.InventoryItemOrderByWithRelationInput;
}

function buildWhere(tenantId: string, filters: Omit<InventoryListFilters, "skip" | "take" | "orderBy">): Prisma.InventoryItemWhereInput {
  const where: Prisma.InventoryItemWhereInput = {
    tenantId,
    ...(filters.branchId && filters.branchId !== "all" ? { branchId: filters.branchId } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.supplierId ? { supplierId: filters.supplierId } : {}),
    ...(filters.stockStatus === "out" ? { inStock: 0 } : {}),
  };

  if (filters.search) {
    where.OR = [
      { name: searchContains(filters.search) },
      { sku: searchContains(filters.search) },
      { category: searchContains(filters.search) },
      { supplier: searchContains(filters.search) },
      { description: searchContains(filters.search) },
    ];
  }

  return where;
}

export class InventoryRepository {
  async findPaginated(tenantId: string, filters: InventoryListFilters): Promise<PaginatedResult<InventoryItem>> {
    const baseWhere = buildWhere(tenantId, filters);

    if (filters.stockStatus === "low") {
      const candidates = await prisma.inventoryItem.findMany({
        where: baseWhere,
        select: { id: true, inStock: true, reorderLevel: true },
      });
      const lowIds = candidates.filter((i) => i.inStock <= i.reorderLevel).map((i) => i.id);
      if (lowIds.length === 0) return { data: [], total: 0 };
      const where: Prisma.InventoryItemWhereInput = { ...baseWhere, id: { in: lowIds } };
      const [data, total] = await Promise.all([
        prisma.inventoryItem.findMany({ where, orderBy: filters.orderBy, skip: filters.skip, take: filters.take }),
        prisma.inventoryItem.count({ where }),
      ]);
      return { data, total };
    }

    const [data, total] = await Promise.all([
      prisma.inventoryItem.findMany({
        where: baseWhere,
        orderBy: filters.orderBy,
        skip: filters.skip,
        take: filters.take,
      }),
      prisma.inventoryItem.count({ where: baseWhere }),
    ]);
    return { data, total };
  }

  async findAll(tenantId: string, branchId?: string): Promise<InventoryItem[]> {
    const { data } = await this.findPaginated(tenantId, {
      branchId,
      skip: 0,
      take: 100,
      orderBy: { name: "asc" },
    });
    return data;
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
