import { inventoryRepository } from "@/repositories/inventory.repository";
import { taxonomyService } from "@/services/taxonomy.service";
import { AppError } from "@/middleware/errorHandler";
import { prisma } from "@/db/prisma";
import { Prisma } from "@prisma/client";
import { normalizeAdditionalFields } from "@/lib/additionalFields";
import { getDefaultBranchId } from "@/utils/defaultBranch";
import { APPROVED_IMAGE_TYPE_MESSAGE } from "@/services/fileStorage.service";
import {
  inferItemClassFromCategory,
  isInventoryItemClass,
  type InventoryItemClass,
} from "@/lib/inventoryItemClass";

type CreateInventoryData = {
  sku?: string;
  name: string;
  itemClass?: InventoryItemClass | string;
  category?: string;
  subcategory?: string | null;
  description?: string | null;
  manufacturer?: string;
  compatibleModels?: string | null;
  branchId?: string;
  inStock?: number;
  reorderLevel?: number;
  maxLevel?: number;
  binLocation?: string;
  trackBatches?: boolean;
  trackSerials?: boolean;
  unitCost?: number;
  sellingPrice?: number;
  deliveryCharge?: number;
  deliveryChargeType?: "flat" | "perUnit";
  unitOfMeasure?: string;
  supplier?: string;
  supplierId?: string | null;
  imageFileIds?: string[];
  additionalFields?: { label: string; value: string }[] | null;
};

function resolveItemClass(value: unknown, category?: string | null): InventoryItemClass {
  if (isInventoryItemClass(value)) return value;
  return inferItemClassFromCategory(category);
}

export class InventoryService {
  private withAvailability<T extends { inStock: number; reserved: number; issued?: number; damaged?: number; additionalFields?: unknown }>(item: T) {
    return {
      ...item,
      issued: item.issued ?? 0,
      damaged: item.damaged ?? 0,
      available: Math.max(0, item.inStock - item.reserved),
      additionalFields: normalizeAdditionalFields(item.additionalFields) ?? [],
    };
  }

  async getPaginated(tenantId: string, filters: import("@/repositories/inventory.repository").InventoryListFilters) {
    const { data, total } = await inventoryRepository.findPaginated(tenantId, filters);
    return {
      data: data.map((item) => this.withAvailability(item)),
      total,
    };
  }

  async getAll(tenantId: string) {
    const items = await prisma.inventoryItem.findMany({
      where: { tenantId, status: "active" },
      include: { images: { include: { file: true }, orderBy: { sortOrder: "asc" } } },
      orderBy: { name: "asc" },
      take: 100,
    });
    return items.map((item) => this.withAvailability(item));
  }

  async getLowStock(tenantId: string) {
    return inventoryRepository.findLowStock(tenantId);
  }

  async getStats(tenantId: string) {
    const items = await prisma.inventoryItem.findMany({
      where: { tenantId, status: "active" },
      select: {
        inStock: true,
        reserved: true,
        issued: true,
        damaged: true,
        reorderLevel: true,
        unitCost: true,
        itemClass: true,
      },
    });
    let lowStock = 0;
    let reserved = 0;
    let issued = 0;
    let damaged = 0;
    let totalValue = 0;
    let sparePartsValue = 0;
    let consumablesValue = 0;
    for (const item of items) {
      if (item.inStock <= item.reorderLevel) lowStock += 1;
      reserved += item.reserved;
      issued += item.issued;
      damaged += item.damaged;
      const value = item.inStock * Number(item.unitCost);
      totalValue += value;
      if (item.itemClass === "spare_part") sparePartsValue += value;
      if (item.itemClass === "consumable") consumablesValue += value;
    }
    return {
      itemCount: items.length,
      lowStock,
      reserved,
      issued,
      damaged,
      totalValue,
      sparePartsValue,
      consumablesValue,
    };
  }

  async getById(id: string, tenantId: string) {
    const item = await prisma.inventoryItem.findFirst({
      where: { id, tenantId },
      include: { images: { include: { file: true }, orderBy: { sortOrder: "asc" } } },
    });
    if (!item) throw new AppError("Inventory item not found", 404);
    return this.withAvailability(item);
  }

  private async resolveOptionalSlug(
    tenantId: string,
    type: "inventory_category" | "inventory_subcategory",
    value?: string | null,
  ) {
    const trimmed = value?.trim() ?? "";
    if (!trimmed) return type === "inventory_subcategory" ? null : "";
    return taxonomyService.resolveSlug(tenantId, type, trimmed);
  }

  private async resolveBranchId(tenantId: string, branchId?: string | null) {
    const id = branchId?.trim() || await getDefaultBranchId(tenantId);
    const branch = await prisma.branch.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!branch) throw new AppError("Branch not found", 404);
    return branch.id;
  }

  private async nextSku(tenantId: string, branchId: string) {
    const year = new Date().getFullYear();
    const count = await prisma.inventoryItem.count({ where: { tenantId, branchId } });
    let n = count + 1;
    let sku = `SKU-${year}-${String(n).padStart(4, "0")}`;
    while (await prisma.inventoryItem.findFirst({ where: { tenantId, branchId, sku } })) {
      n += 1;
      sku = `SKU-${year}-${String(n).padStart(4, "0")}`;
    }
    return sku;
  }

  async create(tenantId: string, data: CreateInventoryData) {
    const { imageFileIds, ...rest } = data;
    const branchId = await this.resolveBranchId(tenantId, rest.branchId);
    const sku = rest.sku?.trim() || await this.nextSku(tenantId, branchId);
    const duplicateSku = await prisma.inventoryItem.findFirst({
      where: { tenantId, branchId, sku },
      select: { id: true },
    });
    if (duplicateSku) throw new AppError("An inventory item with that SKU already exists in this branch", 409);
    const category = await this.resolveOptionalSlug(tenantId, "inventory_category", rest.category);
    const subcategory = await this.resolveOptionalSlug(tenantId, "inventory_subcategory", rest.subcategory);
    const itemClass = resolveItemClass(rest.itemClass, category);
    if (rest.supplierId) {
      const supplier = await prisma.supplier.findFirst({ where: { id: rest.supplierId, tenantId } });
      if (!supplier) throw new AppError("Supplier not found", 404);
      rest.supplier = supplier.name;
    }
    return prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.create({
        data: {
          tenantId,
          sku,
          name: rest.name,
          itemClass,
          category: category ?? "",
          subcategory,
          description: rest.description ?? null,
          manufacturer: rest.manufacturer?.trim() || "",
          compatibleModels: rest.compatibleModels?.trim() || null,
          branchId,
          inStock: rest.inStock ?? 0,
          reserved: 0,
          reorderLevel: rest.reorderLevel ?? 0,
          maxLevel: rest.maxLevel ?? 0,
          binLocation: rest.binLocation?.trim() || "",
          trackBatches: rest.trackBatches ?? false,
          trackSerials: rest.trackSerials ?? false,
          unitCost: rest.unitCost ?? 0,
          sellingPrice: rest.sellingPrice ?? 0,
          deliveryCharge: rest.deliveryCharge ?? 0,
          deliveryChargeType: rest.deliveryChargeType ?? "flat",
          unitOfMeasure: rest.unitOfMeasure ?? "pcs",
          supplier: rest.supplier?.trim() || "",
          supplierId: rest.supplierId ?? null,
          additionalFields: normalizeAdditionalFields(rest.additionalFields) ?? Prisma.JsonNull,
        },
      });
      if (imageFileIds?.length) {
        const valid = await tx.storedFile.count({
          where: { tenantId, id: { in: imageFileIds }, mimeType: { startsWith: "image/" } },
        });
        if (valid !== imageFileIds.length) throw new AppError(APPROVED_IMAGE_TYPE_MESSAGE, 422);
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

  /**
   * Bulk-create catalog products (Excel/ZIP import). Skips duplicate SKUs;
   * returns per-row outcomes so the UI can show a clear summary.
   */
  async bulkImport(tenantId: string, rows: (CreateInventoryData & { row?: number })[]) {
    const branchId = await getDefaultBranchId(tenantId);
    const existing = await prisma.inventoryItem.findMany({
      where: { tenantId },
      select: { sku: true, branchId: true },
    });
    const usedSkus = new Set(existing.map((item) => `${item.branchId}:${item.sku.toLowerCase()}`));
    const suppliers = await prisma.supplier.findMany({
      where: { tenantId },
      select: { id: true, name: true },
    });
    const supplierByName = new Map(suppliers.map((s) => [s.name.trim().toLowerCase(), s]));

    const categoryCache = new Map<string, string>();
    const subcategoryCache = new Map<string, string | null>();
    const resolveCategoryCached = async (raw?: string | null) => {
      const key = (raw ?? "").trim().toLowerCase();
      if (!key) return "";
      const hit = categoryCache.get(key);
      if (hit !== undefined) return hit;
      const slug = (await this.resolveOptionalSlug(tenantId, "inventory_category", raw)) ?? "";
      categoryCache.set(key, slug);
      return slug;
    };
    const resolveSubcategoryCached = async (raw?: string | null) => {
      const key = (raw ?? "").trim().toLowerCase();
      if (!key) return null;
      if (subcategoryCache.has(key)) return subcategoryCache.get(key) ?? null;
      const slug = await this.resolveOptionalSlug(tenantId, "inventory_subcategory", raw);
      subcategoryCache.set(key, slug);
      return slug;
    };

    let nextSkuCounter: number | null = null;
    const allocateSku = async () => {
      if (nextSkuCounter == null) {
        nextSkuCounter = (await prisma.inventoryItem.count({ where: { tenantId, branchId } })) + 1;
      }
      const year = new Date().getFullYear();
      let n = nextSkuCounter;
      let sku = `SKU-${year}-${String(n).padStart(4, "0")}`;
      while (usedSkus.has(`${branchId}:${sku.toLowerCase()}`)) {
        n += 1;
        sku = `SKU-${year}-${String(n).padStart(4, "0")}`;
      }
      nextSkuCounter = n + 1;
      return sku;
    };

    type RowResult = {
      row: number;
      sku: string;
      name: string;
      status: "created" | "skipped" | "error";
      message?: string;
      id?: string;
    };
    const results: RowResult[] = [];
    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (let index = 0; index < rows.length; index += 1) {
      const data = rows[index];
      const rowNum = data.row ?? index + 2;
      const name = String(data.name ?? "").trim();
      if (name.length < 2) {
        failed += 1;
        results.push({ row: rowNum, sku: data.sku?.trim() || "", name, status: "error", message: "Name is required" });
        continue;
      }

      try {
        let sku = data.sku?.trim() || "";
        const targetBranchId = await this.resolveBranchId(tenantId, data.branchId || branchId);
        if (!sku) sku = await allocateSku();
        const skuKey = `${targetBranchId}:${sku.toLowerCase()}`;
        if (usedSkus.has(skuKey)) {
          skipped += 1;
          results.push({
            row: rowNum,
            sku,
            name,
            status: "skipped",
            message: "SKU already exists in this branch",
          });
          continue;
        }

        let supplierId = data.supplierId ?? null;
        let supplierName = data.supplier?.trim() || "";
        if (supplierId) {
          const supplier = suppliers.find((s) => s.id === supplierId);
          if (!supplier) {
            failed += 1;
            results.push({ row: rowNum, sku, name, status: "error", message: "Supplier not found" });
            continue;
          }
          supplierName = supplier.name;
        } else if (supplierName) {
          const matched = supplierByName.get(supplierName.toLowerCase());
          if (matched) {
            supplierId = matched.id;
            supplierName = matched.name;
          }
        }

        const category = await resolveCategoryCached(data.category);
        const subcategory = await resolveSubcategoryCached(data.subcategory);
        const itemClass = resolveItemClass(data.itemClass, category);
        const imageFileIds = data.imageFileIds ?? [];

        const minLevel = data.reorderLevel ?? 0;
        const maxLevel = data.maxLevel ?? 0;
        if (maxLevel > 0 && minLevel > maxLevel) {
          failed += 1;
          results.push({
            row: rowNum,
            sku,
            name,
            status: "error",
            message: "Max level must be greater than or equal to min level",
          });
          continue;
        }

        const item = await prisma.$transaction(async (tx) => {
          const createdItem = await tx.inventoryItem.create({
            data: {
              tenantId,
              sku,
              name,
              itemClass,
              category: category ?? "",
              subcategory,
              description: data.description ?? null,
              manufacturer: data.manufacturer?.trim() || "",
              compatibleModels: data.compatibleModels?.trim() || null,
              branchId: targetBranchId,
              inStock: data.inStock ?? 0,
              reserved: 0,
              reorderLevel: data.reorderLevel ?? 0,
              maxLevel: data.maxLevel ?? 0,
              binLocation: data.binLocation?.trim() || "",
              trackBatches: data.trackBatches ?? false,
              trackSerials: data.trackSerials ?? false,
              unitCost: data.unitCost ?? 0,
              sellingPrice: data.sellingPrice ?? 0,
              deliveryCharge: data.deliveryCharge ?? 0,
              deliveryChargeType: data.deliveryChargeType ?? "flat",
              unitOfMeasure: data.unitOfMeasure ?? "pcs",
              supplier: supplierName,
              supplierId,
              additionalFields: normalizeAdditionalFields(data.additionalFields) ?? Prisma.JsonNull,
            },
          });
          if (imageFileIds.length) {
            const valid = await tx.storedFile.count({
              where: { tenantId, id: { in: imageFileIds }, mimeType: { startsWith: "image/" } },
            });
            if (valid !== imageFileIds.length) {
              throw new AppError(APPROVED_IMAGE_TYPE_MESSAGE, 422);
            }
            await tx.inventoryItemImage.createMany({
              data: imageFileIds.map((fileId, sortOrder) => ({
                inventoryItemId: createdItem.id,
                fileId,
                sortOrder,
              })),
            });
          }
          return createdItem;
        });

        usedSkus.add(skuKey);
        created += 1;
        results.push({ row: rowNum, sku, name, status: "created", id: item.id });
      } catch (err) {
        failed += 1;
        const message = err instanceof AppError ? err.message : err instanceof Error ? err.message : "Unable to create item";
        results.push({
          row: rowNum,
          sku: data.sku?.trim() || "",
          name,
          status: "error",
          message,
        });
      }
    }

    return { created, skipped, failed, total: rows.length, results };
  }

  async update(id: string, tenantId: string, data: Record<string, unknown>, actorId?: string) {
    const existing = await this.getById(id, tenantId);
    // reserved is system-managed — never accept client writes
    const { reserved: _reserved, imageFileIds, ...safe } = data as CreateInventoryData & {
      reserved?: number;
    };
    const nextOnHand = safe.inStock ?? existing.inStock;
    const nextMin = safe.reorderLevel ?? existing.reorderLevel;
    const nextMax = safe.maxLevel ?? existing.maxLevel;
    if (!Number.isFinite(nextOnHand) || nextOnHand < 0) {
      throw new AppError("Quantity on hand cannot be negative", 422);
    }
    if (nextOnHand < existing.reserved) {
      throw new AppError(`Quantity on hand cannot fall below the ${existing.reserved} reserved units`, 409);
    }
    if (nextMax > 0 && nextMin > nextMax) {
      throw new AppError("Max level must be greater than or equal to min level", 422);
    }
    if (safe.supplierId) {
      const supplier = await prisma.supplier.findFirst({ where: { id: safe.supplierId, tenantId } });
      if (!supplier) throw new AppError("Supplier not found", 404);
      safe.supplier = supplier.name;
    }
    if (safe.category !== undefined) {
      safe.category = (await this.resolveOptionalSlug(tenantId, "inventory_category", safe.category)) ?? "";
    }
    if (safe.subcategory !== undefined) {
      safe.subcategory = await this.resolveOptionalSlug(tenantId, "inventory_subcategory", safe.subcategory);
    }
    let nextItemClass: InventoryItemClass | undefined;
    if (safe.itemClass !== undefined || safe.category !== undefined) {
      nextItemClass = resolveItemClass(
        safe.itemClass,
        typeof safe.category === "string" ? safe.category : undefined,
      );
    }
    const nextSku = typeof safe.sku === "string" ? safe.sku.trim() : undefined;
    const nextBranchId = safe.branchId != null
      ? await this.resolveBranchId(tenantId, String(safe.branchId))
      : existing.branchId;
    if (nextSku && (nextSku !== existing.sku || nextBranchId !== existing.branchId)) {
      const duplicateSku = await prisma.inventoryItem.findFirst({
        where: { tenantId, branchId: nextBranchId, sku: nextSku, NOT: { id } },
        select: { id: true },
      });
      if (duplicateSku) throw new AppError("An inventory item with that SKU already exists in this branch", 409);
    }
    return prisma.$transaction(async (tx) => {
      await tx.inventoryItem.update({
        where: { id },
        data: {
          ...(nextSku ? { sku: nextSku } : {}),
          ...(safe.name != null ? { name: safe.name } : {}),
          ...(nextItemClass ? { itemClass: nextItemClass } : {}),
          ...(safe.category !== undefined ? { category: safe.category } : {}),
          ...(safe.subcategory !== undefined ? { subcategory: safe.subcategory } : {}),
          ...(safe.description !== undefined ? { description: safe.description } : {}),
          ...(safe.manufacturer != null ? { manufacturer: String(safe.manufacturer).trim() } : {}),
          ...(safe.compatibleModels !== undefined
            ? { compatibleModels: typeof safe.compatibleModels === "string" ? safe.compatibleModels.trim() || null : safe.compatibleModels }
            : {}),
          ...(safe.branchId != null ? { branchId: nextBranchId } : {}),
          ...(safe.inStock != null ? { inStock: safe.inStock } : {}),
          ...(safe.reorderLevel != null ? { reorderLevel: safe.reorderLevel } : {}),
          ...(safe.maxLevel != null ? { maxLevel: safe.maxLevel } : {}),
          ...(safe.binLocation != null ? { binLocation: String(safe.binLocation).trim() } : {}),
          ...(safe.trackBatches != null ? { trackBatches: Boolean(safe.trackBatches) } : {}),
          ...(safe.trackSerials != null ? { trackSerials: Boolean(safe.trackSerials) } : {}),
          ...(safe.unitCost != null ? { unitCost: safe.unitCost } : {}),
          ...(safe.sellingPrice != null ? { sellingPrice: safe.sellingPrice } : {}),
          ...(safe.deliveryCharge != null ? { deliveryCharge: safe.deliveryCharge } : {}),
          ...(safe.deliveryChargeType != null ? { deliveryChargeType: safe.deliveryChargeType } : {}),
          ...(safe.unitOfMeasure != null ? { unitOfMeasure: safe.unitOfMeasure } : {}),
          ...(safe.supplier != null ? { supplier: safe.supplier } : {}),
          ...(safe.supplierId !== undefined ? { supplierId: safe.supplierId } : {}),
          ...(safe.additionalFields !== undefined
            ? { additionalFields: normalizeAdditionalFields(safe.additionalFields) ?? Prisma.JsonNull }
            : {}),
        },
      });
      if (Array.isArray(imageFileIds)) {
        await tx.inventoryItemImage.deleteMany({ where: { inventoryItemId: id } });
        if (imageFileIds.length) {
          const valid = await tx.storedFile.count({
            where: { tenantId, id: { in: imageFileIds }, mimeType: { startsWith: "image/" } },
          });
          if (valid !== imageFileIds.length) throw new AppError(APPROVED_IMAGE_TYPE_MESSAGE, 422);
          await tx.inventoryItemImage.createMany({
            data: imageFileIds.map((fileId, index) => ({
              inventoryItemId: id,
              fileId,
              sortOrder: index,
            })),
          });
        }
      }
      if (safe.inStock != null && safe.inStock !== existing.inStock) {
        await tx.stockMovement.create({
          data: {
            tenantId,
            inventoryItemId: id,
            type: "adjustment",
            quantity: safe.inStock - existing.inStock,
            balanceAfter: safe.inStock,
            referenceType: "adjustment",
            referenceId: id,
            reason: "Inventory record update",
            actorId: actorId ?? "system",
          },
        });
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

  /**
   * Soft-delete an inventory product (status → inactive / trash).
   * Related reservations, movements, PO lines, and sales lines stay linked.
   */
  async delete(id: string, tenantId: string) {
    const existing = await this.getById(id, tenantId);
    if (existing.status === "inactive") {
      throw new AppError("Inventory item is already in trash", 400);
    }
    if (existing.reserved > 0) {
      throw new AppError("Cannot trash an item with reserved stock. Release reservations first.", 409);
    }
    const removed = await inventoryRepository.softDelete(id, tenantId);
    return this.withAvailability(removed);
  }

  async restore(id: string, tenantId: string) {
    const existing = await this.getById(id, tenantId);
    if (existing.status === "active") {
      throw new AppError("Inventory item is already active", 400);
    }
    return this.withAvailability(await inventoryRepository.restore(id, tenantId));
  }
}

export const inventoryService = new InventoryService();
