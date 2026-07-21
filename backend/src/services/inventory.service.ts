import { inventoryRepository } from "@/repositories/inventory.repository";
import { AppError } from "@/middleware/errorHandler";

type CreateInventoryData = {
  sku: string;
  name: string;
  category: string;
  branchId: string;
  inStock?: number;
  reserved?: number;
  reorderLevel?: number;
  unitCost?: number;
  supplier: string;
};

export class InventoryService {
  async getAll(tenantId: string, branchId?: string) {
    return inventoryRepository.findAll(tenantId, branchId);
  }

  async getLowStock(tenantId: string) {
    return inventoryRepository.findLowStock(tenantId);
  }

  async getById(id: string, tenantId: string) {
    const item = await inventoryRepository.findById(id, tenantId);
    if (!item) throw new AppError("Inventory item not found", 404);
    return item;
  }

  async create(tenantId: string, data: CreateInventoryData) {
    return inventoryRepository.create(tenantId, {
      sku: data.sku,
      name: data.name,
      category: data.category,
      branchId: data.branchId,
      inStock: data.inStock ?? 0,
      reserved: data.reserved ?? 0,
      reorderLevel: data.reorderLevel ?? 0,
      unitCost: data.unitCost ?? 0,
      supplier: data.supplier,
    });
  }

  async update(id: string, tenantId: string, data: Record<string, unknown>) {
    await this.getById(id, tenantId);
    return inventoryRepository.update(id, tenantId, data);
  }

  async delete(id: string, tenantId: string) {
    await this.getById(id, tenantId);
    return inventoryRepository.delete(id, tenantId);
  }
}

export const inventoryService = new InventoryService();
