import { prisma } from "@/db/prisma";
import type { Equipment, Prisma } from "@prisma/client";
import type { PaginatedResult } from "@/types";
import { searchContains } from "@/utils/searchFilter";

export interface EquipmentListFilters {
  customerId?: string;
  condition?: string;
  category?: string;
  search?: string;
  skip: number;
  take: number;
  orderBy: Prisma.EquipmentOrderByWithRelationInput;
}

function buildWhere(tenantId: string, filters: Omit<EquipmentListFilters, "skip" | "take" | "orderBy">): Prisma.EquipmentWhereInput {
  const where: Prisma.EquipmentWhereInput = {
    tenantId,
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
    ...(filters.condition ? { condition: filters.condition } : {}),
    ...(filters.category ? { category: filters.category } : {}),
  };

  if (filters.search) {
    where.OR = [
      { name: searchContains(filters.search) },
      { model: searchContains(filters.search) },
      { manufacturer: searchContains(filters.search) },
      { assetTag: searchContains(filters.search) },
      { serialNumber: searchContains(filters.search) },
      { customerName: searchContains(filters.search) },
      { category: searchContains(filters.search) },
      { location: searchContains(filters.search) },
    ];
  }

  return where;
}

export class EquipmentRepository {
  async findPaginated(tenantId: string, filters: EquipmentListFilters): Promise<PaginatedResult<Equipment>> {
    const where = buildWhere(tenantId, filters);
    const [data, total] = await Promise.all([
      prisma.equipment.findMany({
        where,
        orderBy: filters.orderBy,
        skip: filters.skip,
        take: filters.take,
      }),
      prisma.equipment.count({ where }),
    ]);
    return { data, total };
  }

  /** @deprecated Use findPaginated — kept for internal callers needing a small scoped list */
  async findAll(tenantId: string, filters?: { customerId?: string }): Promise<Equipment[]> {
    const { data } = await this.findPaginated(tenantId, {
      customerId: filters?.customerId,
      skip: 0,
      take: 100,
      orderBy: { name: "asc" },
    });
    return data;
  }

  async findById(id: string, tenantId: string): Promise<Equipment | null> {
    return prisma.equipment.findFirst({ where: { id, tenantId } });
  }

  async findByAssetTag(assetTag: string, tenantId: string): Promise<Equipment | null> {
    return prisma.equipment.findFirst({ where: { assetTag, tenantId } });
  }

  async create(tenantId: string, data: Omit<Prisma.EquipmentUncheckedCreateInput, "tenantId">): Promise<Equipment> {
    return prisma.equipment.create({ data: { ...data, tenantId } });
  }

  async update(id: string, tenantId: string, data: Prisma.EquipmentUpdateInput): Promise<Equipment> {
    return prisma.equipment.update({ where: { id }, data });
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await prisma.equipment.deleteMany({ where: { id, tenantId } });
  }
}

export const equipmentRepository = new EquipmentRepository();
