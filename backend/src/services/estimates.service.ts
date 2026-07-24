import { estimatesRepository } from "@/repositories/estimates.repository";
import { serviceRequestsRepository } from "@/repositories/serviceRequests.repository";
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
      serviceRequestId: sr.id,
      customerId: sr.customerId,
      equipmentId: sr.equipmentId,
      reference,
      requestRef: sr.reference,
      customerName: sr.customerName,
      equipmentName: (sr.equipmentName ?? "Equipment").split(" (")[0],
      laborCost: data.laborCost,
      partsCost: data.partsCost,
      total,
      status: "draft",
      validUntil: new Date(data.validUntil),
    });

    if (sr.status === "inspection" || sr.status === "new") {
      await serviceRequestsRepository.update(sr.id, tenantId, { status: "estimate" });
    }

    return estimate;
  }

  async update(id: string, tenantId: string, data: Record<string, unknown>) {
    const existing = await this.getById(id, tenantId);
    if (data.status && data.status !== existing.status) {
      const maySend = ["draft", "revision"].includes(existing.status) && data.status === "sent";
      if (!maySend) {
        throw new AppError("Use the estimate decision endpoint for approval, rejection, or revision", 409);
      }
      data.sentAt = new Date();
    }
    if (["approved", "rejected"].includes(existing.status) && (data.laborCost != null || data.partsCost != null)) {
      throw new AppError("Decided estimates are immutable", 409);
    }
    if (data.laborCost != null || data.partsCost != null) {
      data.total =
        (Number(data.laborCost ?? existing.laborCost) || 0) +
        (Number(data.partsCost ?? existing.partsCost) || 0);
    }
    if (data.validUntil) {
      data.validUntil = new Date(data.validUntil as string);
    }
    return estimatesRepository.update(id, tenantId, data);
  }

  async delete(id: string, tenantId: string) {
    await this.getById(id, tenantId);
    return estimatesRepository.delete(id, tenantId);
  }
}

export const estimatesService = new EstimatesService();

