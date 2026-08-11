import { inventoryRepository } from "@/repositories/inventory.repository";
import { AppError } from "@/middleware/errorHandler";
import { prisma } from "@/db/prisma";
import { getDefaultBranchId } from "@/utils/defaultBranch";

type CreateInventoryData = {
  sku: string;
  name: string;
  category: string;
  description?: string | null;
  branchId?: string;
  inStock?: number;
  reorderLevel?: number;
  unitCost?: number;
  sellingPrice?: number;
  deliveryCharge?: number;
  deliveryChargeType?: "flat" | "perUnit";
  unitOfMeasure?: string;
  supplier: string;
  supplierId?: string | null;
  imageFileIds?: string[];
};

export class InventoryService {
  private withAvailability<T extends { inStock: number; reserved: number }>(item: T) {
    return {
      ...item,
      available: Math.max(0, item.inStock - item.reserved),
    };
  }

  async getAll(tenantId: string) {
    const items = await prisma.inventoryItem.findMany({
      where: { tenantId },
      include: { images: { include: { file: true }, orderBy: { sortOrder: "asc" } } },
      orderBy: { name: "asc" },
    });
    return items.map((item) => this.withAvailability(item));
  }

  async getLowStock(tenantId: string) {
    return inventoryRepository.findLowStock(tenantId);
  }

  async getById(id: string, tenantId: string) {
    const item = await prisma.inventoryItem.findFirst({
      where: { id, tenantId },
      include: { images: { include: { file: true }, orderBy: { sortOrder: "asc" } } },
    });
    if (!item) throw new AppError("Inventory item not found", 404);
    return this.withAvailability(item);
  }

  async create(tenantId: string, data: CreateInventoryData) {
    const { imageFileIds, ...rest } = data;
    const branchId = rest.branchId || await getDefaultBranchId(tenantId);
    if (rest.supplierId) {
      const supplier = await prisma.supplier.findFirst({ where: { id: rest.supplierId, tenantId } });
      if (!supplier) throw new AppError("Supplier not found", 404);
      rest.supplier = supplier.name;
    }
    return prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.create({
        data: {
          tenantId,
          sku: rest.sku,
          name: rest.name,
          category: rest.category,
          description: rest.description ?? null,
          branchId,
          inStock: rest.inStock ?? 0,
          reserved: 0,
          reorderLevel: rest.reorderLevel ?? 0,
          unitCost: rest.unitCost ?? 0,
          sellingPrice: rest.sellingPrice ?? 0,
          deliveryCharge: rest.deliveryCharge ?? 0,
          deliveryChargeType: rest.deliveryChargeType ?? "flat",
          unitOfMeasure: rest.unitOfMeasure ?? "pcs",
          supplier: rest.supplier,
          supplierId: rest.supplierId ?? null,
        },
      });
      if (imageFileIds?.length) {
        const valid = await tx.storedFile.count({
          where: { tenantId, id: { in: imageFileIds }, mimeType: { startsWith: "image/" } },
        });
        if (valid !== imageFileIds.length) throw new AppError("Every product image must be a valid uploaded image", 422);
        await tx.inventoryItemImage.createMany({
          data: imageFileIds.map((fileId, index) => ({
            inventoryItemId: item.id,
            fileId,
            sortOrder: index,
          })),
        });
      }
      return this.withAvailability(
        await tx.inventoryItem.findUniqueOrThrow({
          where: { id: item.id },
          include: { images: { include: { file: true }, orderBy: { sortOrder: "asc" } } },
        }),
      );
    });
  }

  async update(id: string, tenantId: string, data: Record<string, unknown>) {
    await this.getById(id, tenantId);
    // reserved is system-managed — never accept client writes
    const { reserved: _reserved, imageFileIds, ...safe } = data as CreateInventoryData & {
      reserved?: number;
    };
    if (safe.supplierId) {
      const supplier = await prisma.supplier.findFirst({ where: { id: safe.supplierId, tenantId } });
      if (!supplier) throw new AppError("Supplier not found", 404);
      safe.supplier = supplier.name;
    }
    return prisma.$transaction(async (tx) => {
      await tx.inventoryItem.update({
        where: { id },
        data: {
          ...(safe.sku != null ? { sku: safe.sku } : {}),
          ...(safe.name != null ? { name: safe.name } : {}),
          ...(safe.category != null ? { category: safe.category } : {}),
          ...(safe.description !== undefined ? { description: safe.description } : {}),
          ...(safe.branchId != null ? { branchId: safe.branchId } : {}),
          ...(safe.inStock != null ? { inStock: safe.inStock } : {}),
          ...(safe.reorderLevel != null ? { reorderLevel: safe.reorderLevel } : {}),
          ...(safe.unitCost != null ? { unitCost: safe.unitCost } : {}),
          ...(safe.sellingPrice != null ? { sellingPrice: safe.sellingPrice } : {}),
          ...(safe.deliveryCharge != null ? { deliveryCharge: safe.deliveryCharge } : {}),
          ...(safe.deliveryChargeType != null ? { deliveryChargeType: safe.deliveryChargeType } : {}),
          ...(safe.unitOfMeasure != null ? { unitOfMeasure: safe.unitOfMeasure } : {}),
          ...(safe.supplier != null ? { supplier: safe.supplier } : {}),
          ...(safe.supplierId !== undefined ? { supplierId: safe.supplierId } : {}),
        },
      });
      if (Array.isArray(imageFileIds)) {
        await tx.inventoryItemImage.deleteMany({ where: { inventoryItemId: id } });
        if (imageFileIds.length) {
          const valid = await tx.storedFile.count({
            where: { tenantId, id: { in: imageFileIds }, mimeType: { startsWith: "image/" } },
          });
          if (valid !== imageFileIds.length) throw new AppError("Every product image must be a valid uploaded image", 422);
          await tx.inventoryItemImage.createMany({
            data: imageFileIds.map((fileId, index) => ({
              inventoryItemId: id,
              fileId,
              sortOrder: index,
            })),
          });
        }
      }
      return this.withAvailability(
        await tx.inventoryItem.findUniqueOrThrow({
          where: { id },
          include: { images: { include: { file: true }, orderBy: { sortOrder: "asc" } } },
        }),
      );
    });
  }

  async adjustStock(
    id: string,
    tenantId: string,
    actorId: string,
    quantityDelta: number,
    reason: string,
  ) {
    if (quantityDelta === 0) throw new AppError("Adjustment quantity cannot be zero", 400);
    return prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findFirst({ where: { id, tenantId } });
      if (!item) throw new AppError("Inventory item not found", 404);
      const next = item.inStock + quantityDelta;
      if (next < 0) throw new AppError("Stock cannot go below zero", 409);
      if (next < item.reserved) throw new AppError("Stock cannot fall below reserved quantity", 409);
      const updated = await tx.inventoryItem.update({
        where: { id },
        data: { inStock: next },
      });
      await tx.stockMovement.create({
        data: {
          tenantId,
          inventoryItemId: id,
          type: "adjustment",
          quantity: quantityDelta,
          balanceAfter: updated.inStock,
          referenceType: "adjustment",
          referenceId: id,
          reason,
          actorId,
        },
      });
      return updated;
    });
  }

  async delete(id: string, tenantId: string) {
    await this.getById(id, tenantId);
    return inventoryRepository.delete(id, tenantId);
  }
}

export const inventoryService = new InventoryService();
