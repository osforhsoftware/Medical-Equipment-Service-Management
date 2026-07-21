import { prisma } from "@/db/prisma";
import type { Equipment, Prisma } from "@prisma/client";

export class EquipmentRepository {
  async findAll(tenantId: string, filters?: { branchId?: string; customerId?: string }): Promise<Equipment[]> {
    return prisma.equipment.findMany({
      where: {
        tenantId,
        ...(filters?.branchId && filters.branchId !== "all" ? { branchId: filters.branchId } : {}),
        ...(filters?.customerId ? { customerId: filters.customerId } : {}),
      },
      orderBy: { name: "asc" },
    });
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
