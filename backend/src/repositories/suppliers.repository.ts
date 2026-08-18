import { prisma } from "@/db/prisma";
import type { Supplier, Prisma } from "@prisma/client";
import type { PaginatedResult } from "@/types";
import { searchContains } from "@/utils/searchFilter";

export interface SupplierListFilters {
  search?: string;
  skip: number;
  take: number;
  orderBy: Prisma.SupplierOrderByWithRelationInput;
}

function buildWhere(tenantId: string, filters: Omit<SupplierListFilters, "skip" | "take" | "orderBy">): Prisma.SupplierWhereInput {
  const where: Prisma.SupplierWhereInput = { tenantId };

  if (filters.search) {
    where.OR = [
      { name: searchContains(filters.search) },
      { email: searchContains(filters.search) },
      { phone: searchContains(filters.search) },
      { contact: searchContains(filters.search) },
      { category: searchContains(filters.search) },
    ];
  }

  return where;
}

export class SuppliersRepository {
  async findPaginated(tenantId: string, filters: SupplierListFilters): Promise<PaginatedResult<Supplier>> {
    const where = buildWhere(tenantId, filters);
    const [data, total] = await Promise.all([
      prisma.supplier.findMany({ where, orderBy: filters.orderBy, skip: filters.skip, take: filters.take }),
      prisma.supplier.count({ where }),
    ]);
    return { data, total };
  }

  async findAll(tenantId: string): Promise<Supplier[]> {
    const { data } = await this.findPaginated(tenantId, { skip: 0, take: 100, orderBy: { name: "asc" } });
    return data;
  }

  async findById(id: string, tenantId: string): Promise<Supplier | null> {
    return prisma.supplier.findFirst({ where: { id, tenantId } });
  }

  async create(tenantId: string, data: Omit<Prisma.SupplierUncheckedCreateInput, "tenantId">): Promise<Supplier> {
    return prisma.supplier.create({ data: { ...data, tenantId } });
  }

  async update(id: string, tenantId: string, data: Prisma.SupplierUpdateInput): Promise<Supplier> {
    return prisma.supplier.update({ where: { id }, data });
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await prisma.supplier.deleteMany({ where: { id, tenantId } });
  }
}

export const suppliersRepository = new SuppliersRepository();
