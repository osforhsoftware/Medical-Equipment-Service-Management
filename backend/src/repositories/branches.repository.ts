import { prisma } from "@/db/prisma";
import type { Branch, Prisma } from "@prisma/client";

export class BranchesRepository {
  async findAll(tenantId: string): Promise<Branch[]> {
    return prisma.branch.findMany({ where: { tenantId }, orderBy: { name: "asc" } });
  }

  async findById(id: string, tenantId: string): Promise<Branch | null> {
    return prisma.branch.findFirst({ where: { id, tenantId } });
  }

  async create(tenantId: string, data: Prisma.BranchCreateWithoutTenantInput): Promise<Branch> {
    return prisma.branch.create({ data: { ...data, tenantId } });
  }

  async update(id: string, tenantId: string, data: Prisma.BranchUpdateInput): Promise<Branch> {
    return prisma.branch.update({ where: { id }, data });
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await prisma.branch.deleteMany({ where: { id, tenantId } });
  }
}

export const branchesRepository = new BranchesRepository();
