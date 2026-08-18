import { equipmentRepository, type EquipmentListFilters } from "@/repositories/equipment.repository";
import { customersRepository } from "@/repositories/customers.repository";
import { taxonomyService } from "@/services/taxonomy.service";
import { AppError } from "@/middleware/errorHandler";
import { prisma } from "@/db/prisma";
import type { PaginatedResult } from "@/types";
import type { Equipment } from "@prisma/client";

type CreateEquipmentData = {
  assetTag: string;
  name: string;
  model: string;
  manufacturer: string;
  category: string;
  serialNumber: string;
  customerId: string;
  branchId?: string;
  location: string;
  installDate: string;
  warrantyEnd: string;
  amcStatus?: string;
  condition?: string;
  lastServiceDate?: string;
};

export class EquipmentService {
  async getPaginated(tenantId: string, filters: EquipmentListFilters): Promise<PaginatedResult<Equipment>> {
    return equipmentRepository.findPaginated(tenantId, filters);
  }

  async getAll(tenantId: string, filters?: { customerId?: string }) {
    return equipmentRepository.findAll(tenantId, filters);
  }

  async getById(id: string, tenantId: string) {
    const item = await equipmentRepository.findById(id, tenantId);
    if (!item) throw new AppError("Equipment not found", 404);
    return item;
  }

  async getByAssetTag(assetTag: string, tenantId: string) {
    const item = await equipmentRepository.findByAssetTag(assetTag, tenantId);
    if (!item) throw new AppError("Equipment not found for that asset tag", 404);
    return item;
  }

  async create(tenantId: string, data: CreateEquipmentData) {
    const customer = await customersRepository.findById(data.customerId, tenantId);
    if (!customer) throw new AppError("Customer not found", 404);

    const branchId = data.branchId ?? customer.branchId;
    const category = await taxonomyService.resolveSlug(tenantId, "equipment_category", data.category);
    const condition = await taxonomyService.resolveSlug(
      tenantId,
      "equipment_condition",
      data.condition ?? "operational",
    );

    const equipment = await equipmentRepository.create(tenantId, {
      assetTag: data.assetTag,
      name: data.name,
      model: data.model,
      manufacturer: data.manufacturer,
      category,
      serialNumber: data.serialNumber,
      customerId: data.customerId,
      customerName: customer.name,
      branchId,
      location: data.location,
      installDate: new Date(data.installDate),
      warrantyEnd: new Date(data.warrantyEnd),
      amcStatus: (data.amcStatus ?? "none") as never,
      condition,
      lastServiceDate: data.lastServiceDate ? new Date(data.lastServiceDate) : null,
    });

    await prisma.customer.update({
      where: { id: customer.id },
      data: { equipmentCount: { increment: 1 } },
    });

    return equipment;
  }

  async update(id: string, tenantId: string, data: Record<string, unknown>) {
    const existing = await this.getById(id, tenantId);
    const next = { ...data };
    if (typeof next.category === "string") {
      next.category = await taxonomyService.resolveSlug(
        tenantId,
        "equipment_category",
        next.category,
        existing.category,
      );
    }
    if (typeof next.condition === "string") {
      next.condition = await taxonomyService.resolveSlug(
        tenantId,
        "equipment_condition",
        next.condition,
        existing.condition,
      );
    }
    return equipmentRepository.update(id, tenantId, next);
  }

  async delete(id: string, tenantId: string) {
    const item = await this.getById(id, tenantId);
    await equipmentRepository.delete(id, tenantId);
    await prisma.customer.update({
      where: { id: item.customerId },
      data: { equipmentCount: { decrement: 1 } },
    });
  }
}

export const equipmentService = new EquipmentService();
