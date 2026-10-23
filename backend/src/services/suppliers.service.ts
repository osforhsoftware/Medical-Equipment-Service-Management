import { suppliersRepository } from "@/repositories/suppliers.repository";
import { AppError } from "@/middleware/errorHandler";

function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export class SuppliersService {
  async getPaginated(tenantId: string, filters: import("@/repositories/suppliers.repository").SupplierListFilters) {
    return suppliersRepository.findPaginated(tenantId, filters);
  }
  async getAll(tenantId: string) { return suppliersRepository.findAll(tenantId); }
  async getById(id: string, tenantId: string) {
    const s = await suppliersRepository.findById(id, tenantId);
    if (!s) throw new AppError("Supplier not found", 404);
    return s;
  }
  async create(tenantId: string, data: Record<string, unknown>) {
    const next = { ...data };
    if ("address" in next) next.address = normalizeOptionalText(next.address);
    return suppliersRepository.create(tenantId, next as never);
  }
  async update(id: string, tenantId: string, data: Record<string, unknown>) {
    await this.getById(id, tenantId);
    const next = { ...data };
    if ("address" in next) next.address = normalizeOptionalText(next.address);
    return suppliersRepository.update(id, tenantId, next);
  }
  async delete(id: string, tenantId: string) {
    await this.getById(id, tenantId);
    return suppliersRepository.delete(id, tenantId);
  }
}
export const suppliersService = new SuppliersService();
