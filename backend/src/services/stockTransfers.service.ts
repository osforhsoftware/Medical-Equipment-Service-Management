import { stockTransfersRepository } from "@/repositories/stockTransfers.repository";
import { AppError } from "@/middleware/errorHandler";
import { generateReference } from "@/utils/reference";

type CreateStockTransferData = {
  fromBranch: string;
  toBranch: string;
  items: number;
  status?: string;
};

export class StockTransfersService {
  async getAll(tenantId: string) {
    return stockTransfersRepository.findAll(tenantId);
  }

  async getById(id: string, tenantId: string) {
    const st = await stockTransfersRepository.findById(id, tenantId);
    if (!st) throw new AppError("Stock transfer not found", 404);
    return st;
  }

  async create(tenantId: string, data: CreateStockTransferData) {
    if (data.status === "inTransit" || data.status === "received") {
      throw new AppError(
        "Create transfers as pending, then use /api/domain/stock-transfers dispatch and receive endpoints",
        409,
      );
    }
    const reference = await generateReference(tenantId, "TR", "stockTransfer");
    return stockTransfersRepository.create(tenantId, {
      reference,
      fromBranch: data.fromBranch,
      toBranch: data.toBranch,
      items: data.items,
      status: (data.status ?? "pending") as never,
    });
  }

  async update(id: string, tenantId: string, data: Record<string, unknown>) {
    await this.getById(id, tenantId);
    const blockedStatuses = ["inTransit", "received"];
    if (typeof data.status === "string" && blockedStatuses.includes(data.status)) {
      throw new AppError(
        "Use /api/domain/stock-transfers/:id/dispatch and /receive to move stock. Legacy status updates cannot change inventory.",
        409,
      );
    }
    return stockTransfersRepository.update(id, tenantId, data);
  }

  async delete(id: string, tenantId: string) {
    await this.getById(id, tenantId);
    return stockTransfersRepository.delete(id, tenantId);
  }
}

export const stockTransfersService = new StockTransfersService();
