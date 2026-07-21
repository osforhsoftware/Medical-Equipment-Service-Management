import { prisma } from "@/db/prisma";
import type { ServiceRequest, TimelineEvent, Prisma } from "@prisma/client";

const withEquipmentItems = {
  equipmentItems: { orderBy: { createdAt: "asc" as const } },
  inspectionReport: true,
};

export class ServiceRequestsRepository {
  async findAll(
    tenantId: string,
    filters?: { branchId?: string; status?: string; assignedTo?: string }
  ) {
    return prisma.serviceRequest.findMany({
      where: {
        tenantId,
        ...(filters?.branchId && filters.branchId !== "all" ? { branchId: filters.branchId } : {}),
        ...(filters?.status ? { status: filters.status as ServiceRequest["status"] } : {}),
        ...(filters?.assignedTo ? { assignedTo: filters.assignedTo } : {}),
      },
      include: withEquipmentItems,
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(id: string, tenantId: string) {
    return prisma.serviceRequest.findFirst({
      where: { id, tenantId },
      include: withEquipmentItems,
    });
  }

  async findWithTimeline(id: string, tenantId: string) {
    return prisma.serviceRequest.findFirst({
      where: { id, tenantId },
      include: { ...withEquipmentItems, timelineEvents: { orderBy: { at: "asc" } } },
    });
  }

  async create(tenantId: string, data: Omit<Prisma.ServiceRequestUncheckedCreateInput, "tenantId">) {
    return prisma.serviceRequest.create({
      data: { ...data, tenantId },
      include: withEquipmentItems,
    });
  }

  async update(id: string, tenantId: string, data: Prisma.ServiceRequestUpdateInput) {
    return prisma.serviceRequest.update({
      where: { id },
      data,
      include: withEquipmentItems,
    });
  }

  async addEquipmentItems(serviceRequestId: string, items: { equipmentId: string; equipmentName: string; assetTag: string }[]) {
    await prisma.serviceRequestEquipment.deleteMany({ where: { serviceRequestId } });
    if (items.length > 0) {
      await prisma.serviceRequestEquipment.createMany({
        data: items.map((i) => ({ serviceRequestId, ...i })),
      });
    }
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await prisma.serviceRequest.deleteMany({ where: { id, tenantId } });
  }

  async addTimelineEvent(requestId: string, actor: string, action: string, note?: string): Promise<TimelineEvent> {
    return prisma.timelineEvent.create({ data: { requestId, actor, action, note } });
  }

  async getTimeline(requestId: string): Promise<TimelineEvent[]> {
    return prisma.timelineEvent.findMany({
      where: { requestId },
      orderBy: { at: "asc" },
    });
  }
}

export const serviceRequestsRepository = new ServiceRequestsRepository();
