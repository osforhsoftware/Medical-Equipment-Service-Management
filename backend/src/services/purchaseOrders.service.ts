import { purchaseOrdersRepository } from "@/repositories/purchaseOrders.repository";
import { AppError } from "@/middleware/errorHandler";
import { generateReference } from "@/utils/reference";
import { computeLandedCostTotal } from "@/lib/landedCost";
import { Prisma } from "@prisma/client";
import type { PurchaseOrderStatusValue } from "@/schemas/purchaseOrders.schema";

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

const TERMINAL_STATUSES = new Set<PurchaseOrderStatusValue>(["closed", "cancelled"]);
const RECEIPT_LOCKED = new Set<PurchaseOrderStatusValue>(["closed", "partial"]);

/** Allowed manual status transitions (receipts set partial/closed via domain receive). */
const ALLOWED_TRANSITIONS: Record<PurchaseOrderStatusValue, PurchaseOrderStatusValue[]> = {
  draft: ["sent", "cancelled"],
  sent: ["cancelled"],
  partial: ["cancelled"],
  closed: [],
  cancelled: [],
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
    if (data.status && data.status !== "draft") {
      throw new AppError(
        "Create purchase orders as draft, review, then send. Receive via POST /api/domain/purchase-orders/:id/receipts",
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
      status: "draft",
      expectedDate: new Date(data.expectedDate),
      ...landedFields(data),
    });
  }

  async update(id: string, tenantId: string, data: Partial<CreatePurchaseOrderData>) {
    const existing = await this.getById(id, tenantId);
    const current = existing.status as PurchaseOrderStatusValue;

    if (typeof data.status === "string") {
      const next = data.status as PurchaseOrderStatusValue;
      if (next === "partial" || next === "closed") {
        throw new AppError(
          "Use POST /api/domain/purchase-orders/:id/receipts to receive stock. Status updates cannot change inventory.",
          409,
        );
      }
      const allowed = ALLOWED_TRANSITIONS[current] ?? [];
      if (next !== current && !allowed.includes(next)) {
        throw new AppError(
          `Cannot move purchase order from ${current} to ${next}. Path: draft → sent → receive → closed.`,
          409,
        );
      }
    }

    if (TERMINAL_STATUSES.has(current) && data.status == null) {
      const touchingHeader =
        data.supplier != null ||
        data.supplierReference !== undefined ||
        data.currency != null ||
        data.items != null ||
        data.total != null ||
        data.expectedDate != null ||
        data.freightCost !== undefined ||
        data.customsCost !== undefined ||
        data.insuranceCost !== undefined;
      if (touchingHeader) {
        throw new AppError(`Closed or cancelled purchase orders cannot be edited.`, 409);
      }
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
    const existing = await this.getById(id, tenantId);
    if (RECEIPT_LOCKED.has(existing.status as PurchaseOrderStatusValue) || existing.status === "closed") {
      throw new AppError("Received purchase orders cannot be deleted. Keep them for the stock and cost audit trail.", 409);
    }
    return purchaseOrdersRepository.delete(id, tenantId);
  }
}

export const purchaseOrdersService = new PurchaseOrdersService();
