import { equipmentRepository, type EquipmentListFilters } from "@/repositories/equipment.repository";
import { customersRepository } from "@/repositories/customers.repository";
import { assertCustomerSelectable, requireActiveCustomer } from "@/lib/activeCustomer";
import { settingsRepository } from "@/repositories/settings.repository";
import { allocateAssetTag } from "@/services/assetTag.service";
import { taxonomyService } from "@/services/taxonomy.service";
import { AppError, EQUIPMENT_SERIAL_TAKEN_MESSAGE } from "@/middleware/errorHandler";
import { prisma } from "@/db/prisma";
import { getDefaultBranchId } from "@/utils/defaultBranch";
import { equipmentTicketLabel, syncEquipmentNameSnapshots } from "@/lib/equipmentLabel";
import type { PaginatedResult } from "@/types";
import { Prisma, type Equipment } from "@prisma/client";

function serialTakenError(): AppError {
  return new AppError(EQUIPMENT_SERIAL_TAKEN_MESSAGE, 409, [
    `serialNumber: ${EQUIPMENT_SERIAL_TAKEN_MESSAGE}`,
  ]);
}

function isSerialUniqueViolation(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") {
    return false;
  }
  const target = err.meta?.target;
  const fields = (Array.isArray(target) ? target : [target])
    .filter(Boolean)
    .map((field) => String(field).toLowerCase().replace(/_/g, ""));
  return fields.some((field) => field.includes("serialnumber"));
}

type CreateEquipmentData = {
  name: string;
  model?: string;
  manufacturer?: string;
  category?: string;
  serialNumber: string;
  partNumber?: string | null;
  partDescription?: string | null;
  additionalNote?: string | null;
  customerId?: string | null;
  branchId?: string;
  location?: string;
  installDate?: string | null;
  warrantyStart?: string | null;
  warrantyEnd?: string | null;
  noMachineWarranty?: boolean;
  serviceWarrantyStart?: string | null;
  serviceWarrantyEnd?: string | null;
  noServiceWarranty?: boolean;
  amcStatus?: string;
  condition?: string;
  currentStatus?: string;
  purchaseSaleHistory?: string | null;
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
    const customer = customerId ? await requireActiveCustomer(tenantId, customerId) : null;

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

    const serialNumber = data.serialNumber.trim();
    const duplicate = await equipmentRepository.findBySerialNumber(serialNumber, tenantId);
    if (duplicate) throw serialTakenError();

    await settingsRepository.ensureDefaults(tenantId);

    const record = {
      name: data.name,
      model: data.model?.trim() || "",
      manufacturer: data.manufacturer?.trim() || "",
      category,
      serialNumber,
      partNumber: data.partNumber?.trim() || null,
      partDescription: data.partDescription?.trim() || null,
      additionalNote: data.additionalNote?.trim() || null,
      customerId,
      customerName: customer?.name ?? "",
      branchId,
      location: data.location?.trim() || "",
      installDate: parseOptionalDate(data.installDate),
      warrantyStart: data.noMachineWarranty ? null : parseOptionalDate(data.warrantyStart),
      warrantyEnd: data.noMachineWarranty ? null : parseOptionalDate(data.warrantyEnd),
      noMachineWarranty: Boolean(data.noMachineWarranty),
      serviceWarrantyStart: data.noServiceWarranty ? null : parseOptionalDate(data.serviceWarrantyStart),
      serviceWarrantyEnd: data.noServiceWarranty ? null : parseOptionalDate(data.serviceWarrantyEnd),
      noServiceWarranty: Boolean(data.noServiceWarranty),
      amcStatus: (data.amcStatus ?? "none") as never,
      condition,
      currentStatus: (data.currentStatus ?? "in_service") as never,
      purchaseSaleHistory: data.purchaseSaleHistory?.trim() || null,
      lastServiceDate: parseOptionalDate(data.lastServiceDate),
    };

    // The sequence counter and the equipment row commit together. A failed insert rolls both back.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await prisma.$transaction(async (tx) => {
          const assetTag = await allocateAssetTag(tenantId, tx);
          const equipment = await tx.equipment.create({
            data: { ...record, assetTag, tenantId },
          });
          if (customer) {
            await tx.customer.update({
              where: { id: customer.id },
              data: { equipmentCount: { increment: 1 } },
            });
          }
          return equipment;
        });
      } catch (err) {
        // Serial collisions must not be retried as asset-tag races.
        if (isSerialUniqueViolation(err)) throw serialTakenError();
        const retryable =
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002" &&
          attempt < 2;
        if (!retryable) throw err;
      }
    }

    throw new AppError("Unable to allocate a unique asset tag", 409);
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
        const found = await customersRepository.findById(customerId, tenantId);
        if (!found) throw new AppError("Customer not found", 404);
        const customer = assertCustomerSelectable(found, previousCustomerId);
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
    if (typeof next.warrantyStart === "string") {
      next.warrantyStart = parseOptionalDate(next.warrantyStart);
    } else if (next.warrantyStart === "") {
      next.warrantyStart = null;
    }
    if (typeof next.warrantyEnd === "string") {
      next.warrantyEnd = parseOptionalDate(next.warrantyEnd);
    } else if (next.warrantyEnd === "") {
      next.warrantyEnd = null;
    }
    if (typeof next.serviceWarrantyStart === "string") {
      next.serviceWarrantyStart = parseOptionalDate(next.serviceWarrantyStart);
    } else if (next.serviceWarrantyStart === "") {
      next.serviceWarrantyStart = null;
    }
    if (typeof next.serviceWarrantyEnd === "string") {
      next.serviceWarrantyEnd = parseOptionalDate(next.serviceWarrantyEnd);
    } else if (next.serviceWarrantyEnd === "") {
      next.serviceWarrantyEnd = null;
    }
    if (next.noMachineWarranty === true) {
      next.noMachineWarranty = true;
      next.warrantyStart = null;
      next.warrantyEnd = null;
    } else if (next.noMachineWarranty === false) {
      next.noMachineWarranty = false;
    }
    if (next.noServiceWarranty === true) {
      next.noServiceWarranty = true;
      next.serviceWarrantyStart = null;
      next.serviceWarrantyEnd = null;
    } else if (next.noServiceWarranty === false) {
      next.noServiceWarranty = false;
    }
    if (next.lastServiceDate === "" || next.lastServiceDate == null) {
      next.lastServiceDate = null;
    } else if (typeof next.lastServiceDate === "string") {
      next.lastServiceDate = new Date(next.lastServiceDate);
    }

    if (typeof next.model === "string") next.model = next.model.trim();
    if (typeof next.manufacturer === "string") next.manufacturer = next.manufacturer.trim();
    if (typeof next.partNumber === "string") {
      next.partNumber = next.partNumber.trim() || null;
    } else if (next.partNumber === "") {
      next.partNumber = null;
    }
    if (typeof next.partDescription === "string") {
      next.partDescription = next.partDescription.trim() || null;
    } else if (next.partDescription === "") {
      next.partDescription = null;
    }
    if (typeof next.additionalNote === "string") {
      next.additionalNote = next.additionalNote.trim() || null;
    } else if (next.additionalNote === "") {
      next.additionalNote = null;
    }
    if (typeof next.purchaseSaleHistory === "string") {
      next.purchaseSaleHistory = next.purchaseSaleHistory.trim() || null;
    } else if (next.purchaseSaleHistory === "") {
      next.purchaseSaleHistory = null;
    }

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

    if ("assetTag" in next) {
      const incoming = typeof next.assetTag === "string" ? next.assetTag.trim() : "";
      if (incoming && incoming !== existing.assetTag) {
        throw new AppError(
          "Asset tags are permanent. A new company prefix applies only to assets registered after the change.",
          400,
        );
      }
      delete next.assetTag;
    }

    if ("serialNumber" in next) {
      if (typeof next.serialNumber !== "string" || !next.serialNumber.trim()) {
        throw new AppError("Serial number is required", 422, [
          "serialNumber: Serial number is required",
        ]);
      }
      const serialNumber = next.serialNumber.trim();
      next.serialNumber = serialNumber;
      if (serialNumber !== existing.serialNumber) {
        const duplicate = await equipmentRepository.findBySerialNumber(
          serialNumber,
          tenantId,
          id,
        );
        if (duplicate) throw serialTakenError();
      }
    }

    let updated: Equipment;
    try {
      updated = await equipmentRepository.update(id, tenantId, next);
    } catch (err) {
      if (isSerialUniqueViolation(err)) throw serialTakenError();
      throw err;
    }

    if (
      equipmentTicketLabel(updated) !== equipmentTicketLabel(existing) ||
      updated.assetTag !== existing.assetTag
    ) {
      await syncEquipmentNameSnapshots(tenantId, updated.id, updated);
    }

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
    // The sequence counter is left unchanged so this asset tag is never issued again.
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
