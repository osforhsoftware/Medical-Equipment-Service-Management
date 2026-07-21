import { prisma } from "@/db/prisma";
import type { Customer, Prisma } from "@prisma/client";

export class CustomersRepository {
  async findAll(tenantId: string, branchId?: string): Promise<Customer[]> {
    return prisma.customer.findMany({
      where: { tenantId, ...(branchId && branchId !== "all" ? { branchId } : {}) },
      orderBy: { name: "asc" },
    });
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
