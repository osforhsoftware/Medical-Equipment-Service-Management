import { prisma } from "@/db/prisma";
import type { PurchaseOrder, Prisma } from "@prisma/client";
import type { PaginatedResult } from "@/types";
import { searchContains } from "@/utils/searchFilter";

export interface PurchaseOrderListFilters {
  status?: string;
  search?: string;
  skip: number;
  take: number;
  orderBy: Prisma.PurchaseOrderOrderByWithRelationInput;
}

function buildWhere(tenantId: string, filters: Omit<PurchaseOrderListFilters, "skip" | "take" | "orderBy">): Prisma.PurchaseOrderWhereInput {
  const where: Prisma.PurchaseOrderWhereInput = {
    tenantId,
    ...(filters.status ? { status: filters.status as PurchaseOrder["status"] } : {}),
  };

  if (filters.search) {
    where.OR = [
      { reference: searchContains(filters.search) },
      { supplier: searchContains(filters.search) },
    ];
  }

  return where;
}

export class PurchaseOrdersRepository {
  async findPaginated(tenantId: string, filters: PurchaseOrderListFilters): Promise<PaginatedResult<PurchaseOrder>> {
    const where = buildWhere(tenantId, filters);
    const [data, total] = await Promise.all([
      prisma.purchaseOrder.findMany({ where, orderBy: filters.orderBy, skip: filters.skip, take: filters.take }),
      prisma.purchaseOrder.count({ where }),
    ]);
    return { data, total };
  }

  async findAll(tenantId: string, status?: string): Promise<PurchaseOrder[]> {
    const { data } = await this.findPaginated(tenantId, {
      status,
      skip: 0,
      take: 100,
      orderBy: { createdAt: "desc" },
    });
    return data;
  }

  async findById(id: string, tenantId: string) {
    return prisma.purchaseOrder.findFirst({
      where: { id, tenantId },
      include: {
        lineItems: true,
        receipts: true,
        purchaseReturns: { include: { lines: true }, orderBy: { createdAt: "desc" } },
      },
    });
  }

  async create(tenantId: string, data: Omit<Prisma.PurchaseOrderUncheckedCreateInput, "tenantId">): Promise<PurchaseOrder> {
    return prisma.purchaseOrder.create({ data: { ...data, tenantId } });
  }

  async update(id: string, tenantId: string, data: Prisma.PurchaseOrderUpdateInput): Promise<PurchaseOrder> {
    return prisma.purchaseOrder.update({ where: { id }, data });
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await prisma.purchaseOrder.deleteMany({ where: { id, tenantId } });
  }
}

export const purchaseOrdersRepository = new PurchaseOrdersRepository();
