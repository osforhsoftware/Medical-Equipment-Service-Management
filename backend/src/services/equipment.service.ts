import { equipmentRepository } from "@/repositories/equipment.repository";
import { customersRepository } from "@/repositories/customers.repository";
import { AppError } from "@/middleware/errorHandler";
import { prisma } from "@/db/prisma";

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

    const equipment = await equipmentRepository.create(tenantId, {
      assetTag: data.assetTag,
      name: data.name,
      model: data.model,
      manufacturer: data.manufacturer,
      category: data.category,
      serialNumber: data.serialNumber,
      customerId: data.customerId,
      customerName: customer.name,
      branchId,
      location: data.location,
      installDate: new Date(data.installDate),
      warrantyEnd: new Date(data.warrantyEnd),
      amcStatus: (data.amcStatus ?? "none") as never,
      condition: (data.condition ?? "operational") as never,
      lastServiceDate: data.lastServiceDate ? new Date(data.lastServiceDate) : null,
    });

    await prisma.customer.update({
      where: { id: customer.id },
      data: { equipmentCount: { increment: 1 } },
    });

    return equipment;
  }

  async update(id: string, tenantId: string, data: Record<string, unknown>) {
    await this.getById(id, tenantId);
    return equipmentRepository.update(id, tenantId, data);
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
