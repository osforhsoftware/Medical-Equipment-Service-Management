import { prisma } from "@/db/prisma";
import type { Prisma } from "@prisma/client";
import type { PaginatedResult } from "@/types";
import { searchContains } from "@/utils/searchFilter";

const listIncludes = {
  lineItems: true,
  decisions: { orderBy: { createdAt: "desc" as const }, take: 1 },
  revisions: { orderBy: { revision: "desc" as const }, take: 1 },
  reservations: true,
};

export interface EstimateListFilters {
  status?: string;
  search?: string;
  customerId?: string;
  createdFrom?: string;
  createdTo?: string;
  skip: number;
  take: number;
  orderBy: Prisma.EstimateOrderByWithRelationInput;
}

function buildWhere(tenantId: string, filters: Omit<EstimateListFilters, "skip" | "take" | "orderBy">): Prisma.EstimateWhereInput {
  const where: Prisma.EstimateWhereInput = {
    tenantId,
    ...(filters.status ? { status: filters.status as never } : {}),
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
  };

  if (filters.createdFrom || filters.createdTo) {
    where.createdAt = {
      ...(filters.createdFrom ? { gte: new Date(filters.createdFrom) } : {}),
      ...(filters.createdTo ? { lte: new Date(`${filters.createdTo}T23:59:59.999Z`) } : {}),
    };
  }

  if (filters.search) {
    where.OR = [
      { reference: searchContains(filters.search) },
      { customerName: searchContains(filters.search) },
      { equipmentName: searchContains(filters.search) },
      { requestRef: searchContains(filters.search) },
    ];
  }

  return where;
}

export class EstimatesRepository {
  async findPaginated(tenantId: string, filters: EstimateListFilters): Promise<PaginatedResult<Awaited<ReturnType<typeof prisma.estimate.findMany>>[number]>> {
    const where = buildWhere(tenantId, filters);
    const [data, total] = await Promise.all([
      prisma.estimate.findMany({
        where,
        include: listIncludes,
        orderBy: filters.orderBy,
        skip: filters.skip,
        take: filters.take,
      }),
      prisma.estimate.count({ where }),
    ]);
    return { data, total };
  }

  async findAll(tenantId: string) {
    const { data } = await this.findPaginated(tenantId, {
      skip: 0,
      take: 100,
      orderBy: { createdAt: "desc" },
    });
    return data;
  }

  async findById(id: string, tenantId: string) {
    return prisma.estimate.findFirst({
      where: { id, tenantId },
      include: {
        lineItems: true,
        decisions: { orderBy: { createdAt: "desc" } },
        revisions: { orderBy: { revision: "desc" } },
        reservations: true,
      },
    });
  }

  async create(tenantId: string, data: Omit<Prisma.EstimateUncheckedCreateInput, "tenantId">) {
    return prisma.estimate.create({ data: { ...data, tenantId } });
  }

  async update(id: string, tenantId: string, data: Prisma.EstimateUpdateInput) {
    const exists = await prisma.estimate.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!exists) return null;
    return prisma.estimate.update({
      where: { id },
      data,
      include: { lineItems: true, decisions: true, revisions: true, reservations: true },
    });
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await prisma.estimate.deleteMany({ where: { id, tenantId } });
  }
}

export const estimatesRepository = new EstimatesRepository();
