import { equipmentRepository, type EquipmentListFilters } from "@/repositories/equipment.repository";
import { customersRepository } from "@/repositories/customers.repository";
import { taxonomyService } from "@/services/taxonomy.service";
import { AppError } from "@/middleware/errorHandler";
import { prisma } from "@/db/prisma";
import { getDefaultBranchId } from "@/utils/defaultBranch";
import type { PaginatedResult } from "@/types";
import type { Equipment } from "@prisma/client";

type CreateEquipmentData = {
  assetTag: string;
  name: string;
  model?: string;
  manufacturer?: string;
  category?: string;
  serialNumber: string;
  customerId?: string | null;
  branchId?: string;
  location?: string;
  installDate?: string | null;
  warrantyEnd?: string | null;
  amcStatus?: string;
  condition?: string;
  lastServiceDate?: string | null;
};

function parseOptionalDate(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  return new Date(value);
}

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
    const customerId = data.customerId?.trim() || null;
    const customer = customerId ? await customersRepository.findById(customerId, tenantId) : null;
    if (customerId && !customer) throw new AppError("Customer not found", 404);

    const branchId = data.branchId ?? customer?.branchId ?? (await getDefaultBranchId(tenantId));
    const categorySlug = data.category?.trim() || "";
    const category = categorySlug
      ? await taxonomyService.resolveSlug(tenantId, "equipment_category", categorySlug)
      : "";
    const conditionSlug = data.condition?.trim() || "operational";
    const condition = await taxonomyService.resolveSlug(
      tenantId,
      "equipment_condition",
      conditionSlug,
    );

    const assetTag = data.assetTag.trim();
    const duplicate = await prisma.equipment.findFirst({
      where: { tenantId, assetTag },
      select: { id: true },
    });
    if (duplicate) throw new AppError("An asset with that tag already exists", 409);

    const equipment = await equipmentRepository.create(tenantId, {
      assetTag,
      name: data.name,
      model: data.model?.trim() || "",
      manufacturer: data.manufacturer?.trim() || "",
      category,
      serialNumber: data.serialNumber,
      customerId,
      customerName: customer?.name ?? "",
      branchId,
      location: data.location?.trim() || "",
      installDate: parseOptionalDate(data.installDate),
      warrantyEnd: parseOptionalDate(data.warrantyEnd),
      amcStatus: (data.amcStatus ?? "none") as never,
      condition,
      lastServiceDate: parseOptionalDate(data.lastServiceDate),
    });

    if (customer) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: { equipmentCount: { increment: 1 } },
      });
    }

    return equipment;
  }

  async update(id: string, tenantId: string, data: Record<string, unknown>) {
    const existing = await this.getById(id, tenantId);
    const next: Record<string, unknown> = { ...data };
    const previousCustomerId = existing.customerId;

    if ("customerId" in next) {
      const raw = next.customerId;
      const customerId =
        typeof raw === "string" && raw.trim() ? raw.trim() : null;
      if (customerId) {
        const customer = await customersRepository.findById(customerId, tenantId);
        if (!customer) throw new AppError("Customer not found", 404);
        next.customerId = customer.id;
        next.customerName = customer.name;
        if (typeof next.branchId !== "string") next.branchId = customer.branchId;
      } else {
        next.customerId = null;
        next.customerName = "";
      }
    }

    if (typeof next.installDate === "string") {
      next.installDate = parseOptionalDate(next.installDate);
    } else if (next.installDate === "") {
      next.installDate = null;
    }
    if (typeof next.warrantyEnd === "string") {
      next.warrantyEnd = parseOptionalDate(next.warrantyEnd);
    } else if (next.warrantyEnd === "") {
      next.warrantyEnd = null;
    }
    if (next.lastServiceDate === "" || next.lastServiceDate == null) {
      next.lastServiceDate = null;
    } else if (typeof next.lastServiceDate === "string") {
      next.lastServiceDate = new Date(next.lastServiceDate);
    }

    if (typeof next.model === "string") next.model = next.model.trim();
    if (typeof next.manufacturer === "string") next.manufacturer = next.manufacturer.trim();

    if (typeof next.category === "string") {
      const slug = next.category.trim();
      next.category = slug
        ? await taxonomyService.resolveSlug(
            tenantId,
            "equipment_category",
            slug,
            existing.category,
          )
        : "";
    }
    if (typeof next.condition === "string") {
      const slug = next.condition.trim() || "operational";
      next.condition = await taxonomyService.resolveSlug(
        tenantId,
        "equipment_condition",
        slug,
        existing.condition,
      );
    }

    if (typeof next.assetTag === "string") {
      const assetTag = next.assetTag.trim();
      next.assetTag = assetTag;
      const duplicate = await prisma.equipment.findFirst({
        where: { tenantId, assetTag, id: { not: id } },
        select: { id: true },
      });
      if (duplicate) throw new AppError("An asset with that tag already exists", 409);
    }

    const updated = await equipmentRepository.update(id, tenantId, next);

    if ("customerId" in data) {
      const nextCustomerId = updated.customerId;
      if (previousCustomerId && previousCustomerId !== nextCustomerId) {
        await prisma.customer.update({
          where: { id: previousCustomerId },
          data: { equipmentCount: { decrement: 1 } },
        });
      }
      if (nextCustomerId && nextCustomerId !== previousCustomerId) {
        await prisma.customer.update({
          where: { id: nextCustomerId },
          data: { equipmentCount: { increment: 1 } },
        });
      }
    }

    return updated;
  }

  async delete(id: string, tenantId: string) {
    const item = await this.getById(id, tenantId);
    await equipmentRepository.delete(id, tenantId);
    if (item.customerId) {
      await prisma.customer.update({
        where: { id: item.customerId },
        data: { equipmentCount: { decrement: 1 } },
      });
    }
  }
}

export const equipmentService = new EquipmentService();
