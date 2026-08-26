import { prisma } from "@/db/prisma";
import type { ServiceRequest, TimelineEvent, Prisma } from "@prisma/client";
import type { PaginatedResult } from "@/types";
import { searchContains } from "@/utils/searchFilter";

const withEquipmentItems = {
  equipmentItems: { orderBy: { createdAt: "asc" as const } },
  inspectionReport: true,
};

export interface ServiceRequestListFilters {
  status?: string;
  assignedTo?: string;
  estimatorId?: string;
  priority?: string;
  assignee?: string;
  overdue?: boolean;
  search?: string;
  statuses?: string[];
  skip: number;
  take: number;
  // Allow multi-field sorting. We will also add a deterministic tie-breaker to avoid
  // pagination overlap when multiple rows share the same timestamp.
  orderBy: Prisma.ServiceRequestOrderByWithRelationInput | Prisma.ServiceRequestOrderByWithRelationInput[];
}

function buildWhere(
  tenantId: string,
  filters: Omit<ServiceRequestListFilters, "skip" | "take" | "orderBy">,
): Prisma.ServiceRequestWhereInput {
  const where: Prisma.ServiceRequestWhereInput = {
    tenantId,
    ...(filters.status ? { status: filters.status as ServiceRequest["status"] } : {}),
    ...(filters.statuses?.length ? { status: { in: filters.statuses as ServiceRequest["status"][] } } : {}),
    ...(filters.assignedTo ? { assignedTo: filters.assignedTo } : {}),
    ...(filters.estimatorId
      ? {
          estimates: {
            some: {
              OR: [
                { salespersonId: filters.estimatorId },
                { revisions: { some: { createdBy: filters.estimatorId } } },
              ],
            },
          },
        }
      : {}),
    ...(filters.priority ? { priority: filters.priority as ServiceRequest["priority"] } : {}),
    ...(filters.assignee ? { assignedName: filters.assignee } : {}),
  };

  if (filters.overdue) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    where.slaDue = { lt: start };
    where.status = { notIn: ["pending_final_approval", "pending_invoice", "invoiced", "closed", "completed", "finished"] as ServiceRequest["status"][] };
  }

  if (filters.search) {
    where.OR = [
      { reference: searchContains(filters.search) },
      { customerName: searchContains(filters.search) },
      { equipmentName: searchContains(filters.search) },
      { description: searchContains(filters.search) },
      { assignedName: searchContains(filters.search) },
    ];
  }

  return where;
}

export class ServiceRequestsRepository {
  async findPaginated(tenantId: string, filters: ServiceRequestListFilters): Promise<PaginatedResult<ServiceRequest>> {
    const where = buildWhere(tenantId, filters);
    const orderBy = Array.isArray(filters.orderBy) ? filters.orderBy : [filters.orderBy];
    // Always add a stable tie-breaker (if not already present).
    const hasIdOrderBy = orderBy.some((o: Prisma.ServiceRequestOrderByWithRelationInput) => (o as any).id !== undefined);
    const finalOrderBy = hasIdOrderBy ? orderBy : [...orderBy, { id: "desc" } as never];
    const [data, total] = await Promise.all([
      prisma.serviceRequest.findMany({
        where,
        include: withEquipmentItems,
        orderBy: finalOrderBy,
        skip: filters.skip,
        take: filters.take,
      }),
      prisma.serviceRequest.count({ where }),
    ]);
    return { data, total };
  }

  async countByStatus(
    tenantId: string,
    filters: Omit<ServiceRequestListFilters, "skip" | "take" | "orderBy" | "status" | "statuses">,
    statuses: string[],
  ): Promise<Record<string, number>> {
    const baseWhere = buildWhere(tenantId, { ...filters, status: undefined, statuses: undefined });
    const counts = await prisma.serviceRequest.groupBy({
      by: ["status"],
      where: {
        ...baseWhere,
        status: { in: statuses as ServiceRequest["status"][] },
      },
      _count: { _all: true },
    });
    const result: Record<string, number> = {};
    for (const s of statuses) result[s] = 0;
    for (const row of counts) result[row.status] = row._count._all;
    return result;
  }

  async findAll(
    tenantId: string,
    filters?: { status?: string; assignedTo?: string; estimatorId?: string },
  ) {
    const { data } = await this.findPaginated(tenantId, {
      ...filters,
      skip: 0,
      take: 100,
      orderBy: { createdAt: "desc" },
    });
    return data;
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
