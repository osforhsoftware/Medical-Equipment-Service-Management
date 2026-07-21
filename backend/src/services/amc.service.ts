import { amcRepository } from "@/repositories/amc.repository";
import { AppError } from "@/middleware/errorHandler";
export class AmcService {
  async getAll(tenantId: string, status?: string) { return amcRepository.findAll(tenantId, status); }
  async getById(id: string, tenantId: string) {
    const amc = await amcRepository.findById(id, tenantId);
    if (!amc) throw new AppError("AMC contract not found", 404);
    return amc;
  }
  async create(tenantId: string, data: Record<string, unknown>) { return amcRepository.create(tenantId, data as never); }
  async update(id: string, tenantId: string, data: Record<string, unknown>) {
    await this.getById(id, tenantId);
    return amcRepository.update(id, tenantId, data);
  }
  async delete(id: string, tenantId: string) {
    await this.getById(id, tenantId);
    return amcRepository.delete(id, tenantId);
  }
}
export const amcService = new AmcService();
