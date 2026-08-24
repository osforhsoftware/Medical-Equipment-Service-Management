import { estimatesRepository } from "@/repositories/estimates.repository";
import { serviceRequestsRepository } from "@/repositories/serviceRequests.repository";
import { customersRepository } from "@/repositories/customers.repository";
import { AppError } from "@/middleware/errorHandler";
import { generateReference } from "@/utils/reference";
import { resolveTicketEventStatus } from "@/services/workflow/serviceTicketStateMachine";
import { prisma } from "@/db/prisma";

type CreateEstimateData = {
  serviceRequestId?: string;
  customerId?: string;
  equipmentId?: string;
  laborCost: number;
  partsCost: number;
  validUntil: string;
  status?: string;
};

export class EstimatesService {
  async getPaginated(tenantId: string, filters: import("@/repositories/estimates.repository").EstimateListFilters) {
    return estimatesRepository.findPaginated(tenantId, filters);
  }

  async getAll(tenantId: string) {
    return estimatesRepository.findAll(tenantId);
  }

  async getById(id: string, tenantId: string) {
    const item = await estimatesRepository.findById(id, tenantId);
    if (!item) throw new AppError("Estimate not found", 404);
    return item;
  }

  async create(tenantId: string, data: CreateEstimateData) {
    const reference = await generateReference(tenantId, "EST", "estimate");
    const total = (Number(data.laborCost) || 0) + (Number(data.partsCost) || 0);

    if (!data.serviceRequestId) {
      const customer = await customersRepository.findById(data.customerId!, tenantId);
      if (!customer) throw new AppError("Customer not found", 404);

      let equipmentName = "Sales quotation";
      if (data.equipmentId) {
        const equipment = await prisma.equipment.findFirst({
          where: { id: data.equipmentId, tenantId, customerId: customer.id },
        });
        if (!equipment) throw new AppError("Equipment not found for this customer", 404);
        equipmentName = equipment.name;
      }

      return estimatesRepository.create(tenantId, {
        serviceRequestId: null,
        customerId: customer.id,
        equipmentId: data.equipmentId ?? null,
        reference,
        requestRef: "SALE",
        customerName: customer.name,
        equipmentName,
        laborCost: data.laborCost,
        partsCost: data.partsCost,
        total,
        status: "draft",
        validUntil: new Date(data.validUntil),
      });
    }

    const sr = await serviceRequestsRepository.findById(data.serviceRequestId, tenantId);
    if (!sr) throw new AppError("Service ticket not found", 404);

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

    if (sr.status === "inspection" || sr.status === "estimate") {
      const next = resolveTicketEventStatus(sr.status, "estimateCreated");
      if (next !== sr.status) {
        await prisma.serviceRequest.update({
          where: { id: sr.id },
          data: { status: next as never },
        });
      }
    } else if (sr.status === "new") {
      await prisma.serviceRequest.update({
        where: { id: sr.id },
        data: { status: "estimate" as never },
      });
    }

    return estimate;
  }

  async update(id: string, tenantId: string, data: Record<string, unknown>) {
    const existing = await this.getById(id, tenantId);
    if (data.status && data.status !== existing.status) {
      const maySend =
        ["draft", "revision"].includes(existing.status) &&
        (data.status === "sent" || data.status === "pendingAdminApproval");
      if (!maySend) {
        throw new AppError("Use the estimate decision endpoint for approval, rejection, or revision", 409);
      }
      data.sentAt = new Date();
      if (data.status === "sent") data.status = "pendingAdminApproval";
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
    const updated = await estimatesRepository.update(id, tenantId, data);
    if (
      existing.serviceRequestId &&
      (data.status === "pendingAdminApproval" || data.status === "sent")
    ) {
      const sr = await prisma.serviceRequest.findFirst({ where: { id: existing.serviceRequestId, tenantId } });
      if (sr) {
        const next = resolveTicketEventStatus(sr.status, "estimatePendingApproval");
        if (next !== sr.status) {
          await prisma.serviceRequest.update({ where: { id: sr.id }, data: { status: next as never } });
        }
      }
    }
    return updated;
  }

  async delete(id: string, tenantId: string) {
    await this.getById(id, tenantId);
    return estimatesRepository.delete(id, tenantId);
  }
}

export const estimatesService = new EstimatesService();
