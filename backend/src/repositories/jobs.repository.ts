import { prisma } from "@/db/prisma";
import type { ServiceJob, Prisma } from "@prisma/client";
import type { PaginatedResult } from "@/types";
import { searchContains } from "@/utils/searchFilter";
import { COMPLETED_BOARD_RETENTION_DAYS, type CompletedScope } from "@/lib/ticketBoardArchive";

const jobIncludes = {
  assignments: { where: { endedAt: null }, include: { user: true } },
  workLogs: { orderBy: { startedAt: "desc" as const }, include: { user: true } },
  extras: { orderBy: { createdAt: "desc" as const } },
  reservations: true,
  stockMovements: { orderBy: { createdAt: "desc" as const } },
  photos: { include: { file: true }, orderBy: { createdAt: "asc" as const } },
  signature: true,
} satisfies Prisma.ServiceJobInclude;

export type JobQaScope = "pending" | "history";

export interface JobListFilters {
  status?: string;
  engineer?: string;
  engineerId?: string;
  search?: string;
  scheduledFrom?: string;
  scheduledTo?: string;
  overdue?: boolean;
  /** pending = awaiting QA (review); history = jobs with a recorded QA pass/fail */
  qaScope?: JobQaScope;
  /** recent (default) = hide completed older than 7 days; archive = only those; all = no hide */
  completedScope?: CompletedScope;
  skip: number;
  take: number;
  orderBy: Prisma.ServiceJobOrderByWithRelationInput;
}

/** Jobs that have a recorded QA result in stageDetails.qa.result (MySQL JSON). */
export function qaReviewedWhere(): Prisma.ServiceJobWhereInput {
  return {
    OR: [
      { stageDetails: { path: "$.qa.result", equals: "pass" } },
      { stageDetails: { path: "$.qa.result", equals: "fail" } },
    ],
  };
}

function buildWhere(tenantId: string, filters: Omit<JobListFilters, "skip" | "take" | "orderBy">): Prisma.ServiceJobWhereInput {
  const where: Prisma.ServiceJobWhereInput = { tenantId };

  if (filters.qaScope === "pending") {
    where.status = "review";
  } else if (filters.qaScope === "history") {
    Object.assign(where, qaReviewedWhere());
  } else if (filters.status) {
    where.status = filters.status as ServiceJob["status"];
  } else if (filters.overdue) {
    where.status = { not: "completed" };
  }

  const scheduledFor: Prisma.DateTimeFilter = {};
  if (filters.scheduledFrom) scheduledFor.gte = new Date(filters.scheduledFrom);
  if (filters.scheduledTo) scheduledFor.lte = new Date(`${filters.scheduledTo}T23:59:59.999Z`);
  if (filters.overdue) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    scheduledFor.lt = startOfToday;
  }
  if (Object.keys(scheduledFor).length > 0) {
    where.scheduledFor = scheduledFor;
  }

  if (filters.engineerId) {
    where.OR = [
      { engineerId: filters.engineerId },
      { assignments: { some: { userId: filters.engineerId, endedAt: null } } },
    ];
  } else if (filters.engineer) {
    where.engineer = filters.engineer;
  }

  if (filters.search) {
    const searchClause: Prisma.ServiceJobWhereInput = {
      OR: [
        { reference: searchContains(filters.search) },
        { requestRef: searchContains(filters.search) },
        { customerName: searchContains(filters.search) },
        { equipmentName: searchContains(filters.search) },
        { engineer: searchContains(filters.search) },
      ],
    };

    if (where.OR) {
      where.AND = [{ OR: where.OR }, searchClause];
      delete where.OR;
    } else {
      where.OR = searchClause.OR;
    }
  }

  // QA history must include older completed jobs; pending QA is never completed.
  const scope =
    filters.qaScope === "history" || filters.qaScope === "pending"
      ? "all"
      : (filters.completedScope ?? "recent");
  if (scope !== "all") {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - COMPLETED_BOARD_RETENTION_DAYS);
    const archiveClause: Prisma.ServiceJobWhereInput =
      scope === "archive"
        ? { status: "completed", completedAt: { lt: cutoff } }
        : {
            OR: [
              { status: { not: "completed" } },
              { status: "completed", OR: [{ completedAt: null }, { completedAt: { gte: cutoff } }] },
            ],
          };
    if (where.AND) {
      where.AND = [...(Array.isArray(where.AND) ? where.AND : [where.AND]), archiveClause];
    } else {
      where.AND = [archiveClause];
    }
  }

  // When both qa history + a status column are requested (board columns), AND them.
  if (filters.qaScope === "history" && filters.status) {
    where.status = filters.status as ServiceJob["status"];
  }

  return where;
}

export class JobsRepository {
  async findPaginated(tenantId: string, filters: JobListFilters): Promise<PaginatedResult<ServiceJob>> {
    const where = buildWhere(tenantId, filters);
    const [data, total] = await Promise.all([
      prisma.serviceJob.findMany({
        where,
        orderBy: filters.orderBy,
        skip: filters.skip,
        take: filters.take,
      }),
      prisma.serviceJob.count({ where }),
    ]);
    return { data, total };
  }

  async findAll(
    tenantId: string,
    filters?: { status?: string; engineer?: string; engineerId?: string },
  ) {
    const { data } = await this.findPaginated(tenantId, {
      ...filters,
      skip: 0,
      take: 100,
      orderBy: { scheduledFor: "asc" },
    });
    return data;
  }

  async findById(id: string, tenantId: string) {
    return prisma.serviceJob.findFirst({ where: { id, tenantId }, include: jobIncludes });
  }

  async create(tenantId: string, data: Omit<Prisma.ServiceJobUncheckedCreateInput, "tenantId">): Promise<ServiceJob> {
    return prisma.serviceJob.create({ data: { ...data, tenantId } });
  }

  async update(id: string, tenantId: string, data: Prisma.ServiceJobUpdateInput): Promise<ServiceJob> {
    return prisma.serviceJob.update({ where: { id }, data });
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await prisma.serviceJob.deleteMany({ where: { id, tenantId } });
  }
}

export const jobsRepository = new JobsRepository();
