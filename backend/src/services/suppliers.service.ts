import { suppliersRepository } from "@/repositories/suppliers.repository";
import { AppError } from "@/middleware/errorHandler";
export class SuppliersService {
  async getAll(tenantId: string) { return suppliersRepository.findAll(tenantId); }
  async getById(id: string, tenantId: string) {
    const s = await suppliersRepository.findById(id, tenantId);
    if (!s) throw new AppError("Supplier not found", 404);
    return s;
  }
  async create(tenantId: string, data: Record<string, unknown>) { return suppliersRepository.create(tenantId, data as never); }
  async update(id: string, tenantId: string, data: Record<string, unknown>) {
    await this.getById(id, tenantId);
    return suppliersRepository.update(id, tenantId, data);
  }
  async delete(id: string, tenantId: string) {
    await this.getById(id, tenantId);
    return suppliersRepository.delete(id, tenantId);
  }
}
export const suppliersService = new SuppliersService();
