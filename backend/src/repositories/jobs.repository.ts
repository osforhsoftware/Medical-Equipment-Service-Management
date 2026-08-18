import { prisma } from "@/db/prisma";
import type { ServiceJob, Prisma } from "@prisma/client";
import type { PaginatedResult } from "@/types";
import { searchContains } from "@/utils/searchFilter";

const jobIncludes = {
  assignments: { where: { endedAt: null }, include: { user: true } },
  workLogs: { orderBy: { startedAt: "desc" as const }, include: { user: true } },
  extras: { orderBy: { createdAt: "desc" as const } },
  reservations: true,
  stockMovements: { orderBy: { createdAt: "desc" as const } },
  photos: { include: { file: true }, orderBy: { createdAt: "asc" as const } },
  signature: true,
} satisfies Prisma.ServiceJobInclude;

export interface JobListFilters {
  status?: string;
  engineer?: string;
  engineerId?: string;
  search?: string;
  skip: number;
  take: number;
  orderBy: Prisma.ServiceJobOrderByWithRelationInput;
}

function buildWhere(tenantId: string, filters: Omit<JobListFilters, "skip" | "take" | "orderBy">): Prisma.ServiceJobWhereInput {
  const where: Prisma.ServiceJobWhereInput = { tenantId };

  if (filters.status) {
    where.status = filters.status as ServiceJob["status"];
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
