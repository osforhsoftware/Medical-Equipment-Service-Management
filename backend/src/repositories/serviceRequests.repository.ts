import { prisma } from "@/db/prisma";
import type { ServiceRequest, TimelineEvent, Prisma } from "@prisma/client";
import type { PaginatedResult } from "@/types";
import { searchContains } from "@/utils/searchFilter";
import {
  BOARD_COMPLETED_STATUSES,
  completedAtForStatusChange,
  completedBoardCutoff,
  type CompletedScope,
} from "@/lib/ticketBoardArchive";

const withEquipmentItems = {
  equipmentItems: { orderBy: { createdAt: "asc" as const } },
  inspectionReport: true,
};

const withInspectionDetails = {
  equipmentItems: { orderBy: { createdAt: "asc" as const } },
  inspectionReport: {
    include: {
      recommendations: { include: { catalogItem: true, inventoryItem: true } },
      attachments: { include: { file: true } },
    },
  },
};

export interface ServiceRequestListFilters {
  status?: string;
  assignedTo?: string;
  inspectorId?: string;
  estimatorId?: string;
  engineerId?: string;
  priority?: string;
  assignee?: string;
  overdue?: boolean;
  mineUserId?: string;
  slaDueFrom?: string;
  slaDueTo?: string;
  search?: string;
  statuses?: string[];
  /** recent (default) = hide completed older than 7 days; archive = only those; all = no hide */
  completedScope?: CompletedScope;
  skip: number;
  take: number;
  // Allow multi-field sorting. We will also add a deterministic tie-breaker to avoid
  // pagination overlap when multiple rows share the same timestamp.
  orderBy: Prisma.ServiceRequestOrderByWithRelationInput | Prisma.ServiceRequestOrderByWithRelationInput[];
}

function pushAnd(where: Prisma.ServiceRequestWhereInput, clause: Prisma.ServiceRequestWhereInput) {
  where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), clause];
}

function applyCompletedScope(
  where: Prisma.ServiceRequestWhereInput,
  completedScope: CompletedScope | undefined,
) {
  const scope = completedScope ?? "recent";
  if (scope === "all") return;

  const cutoff = completedBoardCutoff();
  const completed = [...BOARD_COMPLETED_STATUSES] as ServiceRequest["status"][];

  if (scope === "archive") {
    pushAnd(where, {
      status: { in: completed },
      completedAt: { lt: cutoff },
    });
    return;
  }

  // recent: active work + completed within retention window
  // (kept for API compatibility; UI now defaults to "all" + See more pagination)
  pushAnd(where, {
    OR: [
      { status: { notIn: completed } },
      {
        status: { in: completed },
        OR: [{ completedAt: null }, { completedAt: { gte: cutoff } }],
      },
    ],
  });
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
    ...(filters.priority ? { priority: filters.priority as ServiceRequest["priority"] } : {}),
    ...(filters.assignee ? { assignedName: filters.assignee } : {}),
  };

  if (filters.inspectorId) {
    pushAnd(where, {
      OR: [
        { assignedInspectorId: filters.inspectorId },
        { assignedTo: filters.inspectorId },
      ],
    });
  }

  if (filters.estimatorId) {
    pushAnd(where, {
      OR: [
        { assignedEstimatorId: filters.estimatorId },
        { assignedTo: filters.estimatorId },
        {
          estimates: {
            some: {
              OR: [
                { salespersonId: filters.estimatorId },
                { revisions: { some: { createdBy: filters.estimatorId } } },
              ],
            },
          },
        },
        { assignedEstimatorId: null, status: { in: ["estimate"] } },
      ],
    });
  }

  if (filters.engineerId) {
    pushAnd(where, {
      OR: [
        { assignedEngineerId: filters.engineerId },
        { assignedTo: filters.engineerId },
      ],
    });
  }

  if (filters.overdue) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const terminal = ["pending_final_approval", "pending_invoice", "invoiced", "closed", "completed", "finished"] as ServiceRequest["status"][];
    const slaDue: Prisma.DateTimeFilter = {
      ...(filters.slaDueFrom ? { gte: new Date(filters.slaDueFrom) } : {}),
      ...(filters.slaDueTo ? { lte: new Date(`${filters.slaDueTo}T23:59:59.999Z`) } : {}),
      lt: start,
    };
    where.slaDue = slaDue;
    if (filters.statuses?.length) {
      const openStatuses = filters.statuses.filter((s) => !terminal.includes(s as ServiceRequest["status"]));
      where.status = { in: (openStatuses.length ? openStatuses : filters.statuses) as ServiceRequest["status"][] };
    } else if (!filters.status) {
      where.status = { notIn: terminal };
    }
  } else if (filters.slaDueFrom || filters.slaDueTo) {
    where.slaDue = {
      ...(filters.slaDueFrom ? { gte: new Date(filters.slaDueFrom) } : {}),
      ...(filters.slaDueTo ? { lte: new Date(`${filters.slaDueTo}T23:59:59.999Z`) } : {}),
    };
  }

  if (filters.mineUserId) {
    pushAnd(where, {
      OR: [
        { assignedTo: filters.mineUserId },
        { assignedInspectorId: filters.mineUserId },
        { assignedEstimatorId: filters.mineUserId },
        { assignedEngineerId: filters.mineUserId },
      ],
    });
  }

  if (filters.search) {
    pushAnd(where, {
      OR: [
        { reference: searchContains(filters.search) },
        { customerName: searchContains(filters.search) },
        { equipmentName: searchContains(filters.search) },
        { description: searchContains(filters.search) },
        { assignedName: searchContains(filters.search) },
      ],
    });
  }

  applyCompletedScope(where, filters.completedScope);

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
    filters?: { status?: string; assignedTo?: string; inspectorId?: string; estimatorId?: string; engineerId?: string },
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
      include: withInspectionDetails,
    });
  }

  async findWithTimeline(id: string, tenantId: string) {
    return prisma.serviceRequest.findFirst({
      where: { id, tenantId },
      include: { ...withInspectionDetails, timelineEvents: { orderBy: { at: "asc" } } },
    });
  }

  async create(tenantId: string, data: Omit<Prisma.ServiceRequestUncheckedCreateInput, "tenantId">) {
    return prisma.serviceRequest.create({
      data: { ...data, tenantId },
      include: withInspectionDetails,
    });
  }

  async update(id: string, tenantId: string, data: Prisma.ServiceRequestUpdateInput) {
    const nextStatus =
      typeof data.status === "string"
        ? data.status
        : data.status && typeof data.status === "object" && "set" in data.status
          ? (data.status as { set?: string }).set
          : undefined;

    let patch = data;
    if (nextStatus) {
      const existing = await prisma.serviceRequest.findFirst({
        where: { id, tenantId },
        select: { status: true, completedAt: true },
      });
      if (existing) {
        const completedAt = completedAtForStatusChange({
          previousStatus: existing.status,
          nextStatus,
          existingCompletedAt: existing.completedAt,
        });
        if (completedAt !== undefined) {
          patch = { ...data, completedAt };
        }
      }
    }

    return prisma.serviceRequest.update({
      where: { id },
      data: patch,
      include: withInspectionDetails,
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
