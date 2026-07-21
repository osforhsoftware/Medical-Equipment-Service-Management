import { purchaseOrdersRepository } from "@/repositories/purchaseOrders.repository";
import { AppError } from "@/middleware/errorHandler";
import { generateReference } from "@/utils/reference";

type CreatePurchaseOrderData = {
  supplier: string;
  items: number;
  total: number;
  expectedDate: string;
  status?: string;
};

export class PurchaseOrdersService {
  async getAll(tenantId: string, status?: string) {
    return purchaseOrdersRepository.findAll(tenantId, status);
  }

  async getById(id: string, tenantId: string) {
    const po = await purchaseOrdersRepository.findById(id, tenantId);
    if (!po) throw new AppError("Purchase order not found", 404);
    return po;
  }

  async create(tenantId: string, data: CreatePurchaseOrderData) {
    const reference = await generateReference(tenantId, "PO", "purchaseOrder");
    return purchaseOrdersRepository.create(tenantId, {
      reference,
      supplier: data.supplier,
      items: data.items,
      total: data.total,
      status: (data.status ?? "draft") as never,
      expectedDate: new Date(data.expectedDate),
    });
  }

  async update(id: string, tenantId: string, data: Record<string, unknown>) {
    await this.getById(id, tenantId);
    if (data.expectedDate) {
      data.expectedDate = new Date(data.expectedDate as string);
    }
    return purchaseOrdersRepository.update(id, tenantId, data);
  }

  async delete(id: string, tenantId: string) {
    await this.getById(id, tenantId);
    return purchaseOrdersRepository.delete(id, tenantId);
  }
}

export const purchaseOrdersService = new PurchaseOrdersService();
