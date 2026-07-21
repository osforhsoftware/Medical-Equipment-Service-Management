import { estimatesRepository } from "@/repositories/estimates.repository";
import { serviceRequestsRepository } from "@/repositories/serviceRequests.repository";
import { notificationsService } from "@/services/notifications.service";
import { AppError } from "@/middleware/errorHandler";
import { generateReference } from "@/utils/reference";

type CreateEstimateData = {
  serviceRequestId: string;
  laborCost: number;
  partsCost: number;
  validUntil: string;
  status?: string;
};

export class EstimatesService {
  async getAll(tenantId: string) {
    return estimatesRepository.findAll(tenantId);
  }

  async getById(id: string, tenantId: string) {
    const item = await estimatesRepository.findById(id, tenantId);
    if (!item) throw new AppError("Estimate not found", 404);
    return item;
  }

  async create(tenantId: string, data: CreateEstimateData) {
    const sr = await serviceRequestsRepository.findById(data.serviceRequestId, tenantId);
    if (!sr) throw new AppError("Service request not found", 404);

    const reference = await generateReference(tenantId, "EST", "estimate");
    const total = (Number(data.laborCost) || 0) + (Number(data.partsCost) || 0);

    const estimate = await estimatesRepository.create(tenantId, {
      reference,
      requestRef: sr.reference,
      customerName: sr.customerName,
      equipmentName: (sr.equipmentName ?? "Equipment").split(" (")[0],
      laborCost: data.laborCost,
      partsCost: data.partsCost,
      total,
      status: (data.status ?? "draft") as never,
      validUntil: new Date(data.validUntil),
    });

    if (sr.status === "inspection" || sr.status === "new") {
      await serviceRequestsRepository.update(sr.id, tenantId, { status: "estimate" });
    }

    return estimate;
  }

  async update(id: string, tenantId: string, data: Record<string, unknown>) {
    const existing = await this.getById(id, tenantId);
    if (data.laborCost != null || data.partsCost != null) {
      data.total =
        (Number(data.laborCost ?? existing.laborCost) || 0) +
        (Number(data.partsCost ?? existing.partsCost) || 0);
    }
    if (data.validUntil) {
      data.validUntil = new Date(data.validUntil as string);
    }
    const updated = await estimatesRepository.update(id, tenantId, data);
    if (data.status === "approved" && existing.status !== "approved") {
      await notificationsService.notifyEstimateApproved(
        tenantId,
        existing.reference,
        existing.customerName,
        Number(updated.total),
      );
    }
    return updated;
  }

  async delete(id: string, tenantId: string) {
    await this.getById(id, tenantId);
    return estimatesRepository.delete(id, tenantId);
  }
}

export const estimatesService = new EstimatesService();

