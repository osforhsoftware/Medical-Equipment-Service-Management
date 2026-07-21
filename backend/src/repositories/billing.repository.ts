import { prisma } from "@/db/prisma";
import type { Invoice, Prisma } from "@prisma/client";

export class BillingRepository {
  async findAll(tenantId: string, status?: string): Promise<Invoice[]> {
    return prisma.invoice.findMany({
      where: { tenantId, ...(status ? { status: status as Invoice["status"] } : {}) },
      orderBy: { issuedAt: "desc" },
    });
  }

  async findById(id: string, tenantId: string): Promise<Invoice | null> {
    return prisma.invoice.findFirst({ where: { id, tenantId } });
  }

  async create(tenantId: string, data: Omit<Prisma.InvoiceUncheckedCreateInput, "tenantId">): Promise<Invoice> {
    return prisma.invoice.create({ data: { ...data, tenantId } });
  }

  async update(id: string, tenantId: string, data: Prisma.InvoiceUpdateInput): Promise<Invoice> {
    return prisma.invoice.update({ where: { id }, data });
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await prisma.invoice.deleteMany({ where: { id, tenantId } });
  }

  async getSummary(tenantId: string) {
    const result = await prisma.invoice.groupBy({
      by: ["status"],
      where: { tenantId },
      _sum: { total: true },
      _count: true,
    });
    return result;
  }
}

export const billingRepository = new BillingRepository();
