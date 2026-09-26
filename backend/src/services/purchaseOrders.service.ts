import { purchaseOrdersRepository } from "@/repositories/purchaseOrders.repository";
import { AppError } from "@/middleware/errorHandler";
import { generateReference } from "@/utils/reference";
import { computeLandedCostTotal } from "@/lib/landedCost";
import { Prisma } from "@prisma/client";

type CreatePurchaseOrderData = {
  supplier: string;
  supplierReference?: string | null;
  currency?: string;
  items: number;
  total: number;
  expectedDate: string;
  status?: string;
  freightCost?: number | null;
  customsCost?: number | null;
  insuranceCost?: number | null;
};

function landedFields(data: {
  total: number;
  freightCost?: number | null;
  customsCost?: number | null;
  insuranceCost?: number | null;
}) {
  const freightCost = data.freightCost != null ? new Prisma.Decimal(data.freightCost) : null;
  const customsCost = data.customsCost != null ? new Prisma.Decimal(data.customsCost) : null;
  const insuranceCost = data.insuranceCost != null ? new Prisma.Decimal(data.insuranceCost) : null;
  const landedCostTotal = computeLandedCostTotal({
    merchandiseTotal: data.total,
    freightCost,
    customsCost,
    insuranceCost,
  });
  return { freightCost, customsCost, insuranceCost, landedCostTotal };
}

export class PurchaseOrdersService {
  async getPaginated(tenantId: string, filters: import("@/repositories/purchaseOrders.repository").PurchaseOrderListFilters) {
    return purchaseOrdersRepository.findPaginated(tenantId, filters);
  }

  async getAll(tenantId: string, status?: string) {
    return purchaseOrdersRepository.findAll(tenantId, status);
  }

  async getById(id: string, tenantId: string) {
    const po = await purchaseOrdersRepository.findById(id, tenantId);
    if (!po) throw new AppError("Purchase order not found", 404);
    return po;
  }

  async create(tenantId: string, data: CreatePurchaseOrderData) {
    if (data.status === "received" || data.status === "partial") {
      throw new AppError(
        "Create purchase orders as draft/sent, then receive via POST /api/domain/purchase-orders/:id/receipts",
        409,
      );
    }
    const reference = await generateReference(tenantId, "PO", "purchaseOrder");
    return purchaseOrdersRepository.create(tenantId, {
      reference,
      supplier: data.supplier,
      supplierReference: data.supplierReference?.trim() || null,
      currency: data.currency?.trim().toUpperCase() || "INR",
      items: data.items,
      total: data.total,
      status: (data.status ?? "draft") as never,
      expectedDate: new Date(data.expectedDate),
      ...landedFields(data),
    });
  }

  async update(id: string, tenantId: string, data: Partial<CreatePurchaseOrderData>) {
    const existing = await this.getById(id, tenantId);
    const blockedStatuses = ["received", "partial"];
    if (typeof data.status === "string" && blockedStatuses.includes(data.status)) {
      throw new AppError(
        "Use POST /api/domain/purchase-orders/:id/receipts to receive stock. Legacy status updates cannot change inventory.",
        409,
      );
    }
    const update: Prisma.PurchaseOrderUpdateInput = {};
    if (data.supplier != null) update.supplier = data.supplier;
    if (data.supplierReference !== undefined) {
      update.supplierReference = data.supplierReference?.trim() || null;
    }
    if (data.currency != null) update.currency = data.currency.trim().toUpperCase();
    if (data.items != null) update.items = data.items;
    if (data.total != null) update.total = data.total;
    if (data.status != null) update.status = data.status as never;
    if (data.expectedDate != null) update.expectedDate = new Date(data.expectedDate);

    const total = data.total != null ? Number(data.total) : Number(existing.total);
    const freightCost =
      data.freightCost !== undefined
        ? data.freightCost
        : existing.freightCost != null
          ? Number(existing.freightCost)
          : null;
    const customsCost =
      data.customsCost !== undefined
        ? data.customsCost
        : existing.customsCost != null
          ? Number(existing.customsCost)
          : null;
    const insuranceCost =
      data.insuranceCost !== undefined
        ? data.insuranceCost
        : existing.insuranceCost != null
          ? Number(existing.insuranceCost)
          : null;
    if (
      data.freightCost !== undefined ||
      data.customsCost !== undefined ||
      data.insuranceCost !== undefined ||
      data.total !== undefined
    ) {
      Object.assign(update, landedFields({ total, freightCost, customsCost, insuranceCost }));
    }
    return purchaseOrdersRepository.update(id, tenantId, update);
  }

  async delete(id: string, tenantId: string) {
    await this.getById(id, tenantId);
    return purchaseOrdersRepository.delete(id, tenantId);
  }
}

export const purchaseOrdersService = new PurchaseOrdersService();
