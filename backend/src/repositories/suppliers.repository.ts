import { prisma } from "@/db/prisma";
import type { Supplier, Prisma } from "@prisma/client";

export class SuppliersRepository {
  async findAll(tenantId: string): Promise<Supplier[]> {
    return prisma.supplier.findMany({ where: { tenantId }, orderBy: { name: "asc" } });
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
