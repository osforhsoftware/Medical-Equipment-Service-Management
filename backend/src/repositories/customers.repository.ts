import { prisma } from "@/db/prisma";
import type { Customer, Prisma } from "@prisma/client";
import type { PaginatedResult } from "@/types";
import { searchContains } from "@/utils/searchFilter";

export interface CustomerListFilters {
  status?: string;
  type?: string;
  search?: string;
  skip: number;
  take: number;
  orderBy: Prisma.CustomerOrderByWithRelationInput;
}

function buildWhere(tenantId: string, filters: Omit<CustomerListFilters, "skip" | "take" | "orderBy">): Prisma.CustomerWhereInput {
  const where: Prisma.CustomerWhereInput = {
    tenantId,
    ...(filters.status ? { status: filters.status as Customer["status"] } : {}),
    ...(filters.type ? { type: filters.type } : {}),
  };

  if (filters.search) {
    where.OR = [
      { reference: searchContains(filters.search) },
      { name: searchContains(filters.search) },
      { contactPerson: searchContains(filters.search) },
      { email: searchContains(filters.search) },
      { phone: searchContains(filters.search) },
      { city: searchContains(filters.search) },
      { country: searchContains(filters.search) },
      { address: searchContains(filters.search) },
      { licenseGst: searchContains(filters.search) },
        { note: searchContains(filters.search) },
    ];
  }

  return where;
}

export class CustomersRepository {
  async findPaginated(tenantId: string, filters: CustomerListFilters): Promise<PaginatedResult<Customer>> {
    const where = buildWhere(tenantId, filters);
    const [data, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: filters.orderBy,
        skip: filters.skip,
        take: filters.take,
      }),
      prisma.customer.count({ where }),
    ]);
    return { data, total };
  }

  async findById(id: string, tenantId: string): Promise<Customer | null> {
    return prisma.customer.findFirst({ where: { id, tenantId } });
  }

  async create(tenantId: string, data: Prisma.CustomerCreateWithoutTenantInput & { branchId: string }): Promise<Customer> {
    return prisma.customer.create({ data: { ...data, tenantId } });
  }

  async update(id: string, tenantId: string, data: Prisma.CustomerUpdateInput): Promise<Customer> {
    return prisma.customer.update({ where: { id }, data });
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await prisma.customer.deleteMany({ where: { id, tenantId } });
  }

  async count(tenantId: string): Promise<number> {
    return prisma.customer.count({ where: { tenantId } });
  }
}

export const customersRepository = new CustomersRepository();
