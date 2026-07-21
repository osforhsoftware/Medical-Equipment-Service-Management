import { branchesRepository } from "@/repositories/branches.repository";
import { AppError } from "@/middleware/errorHandler";

export class BranchesService {
  async getAll(tenantId: string) {
    return branchesRepository.findAll(tenantId);
  }

  async getById(id: string, tenantId: string) {
    const branch = await branchesRepository.findById(id, tenantId);
    if (!branch) throw new AppError("Branch not found", 404);
    return branch;
  }

  async create(tenantId: string, data: { name: string; city: string; phone: string }) {
    return branchesRepository.create(tenantId, data);
  }

  async update(id: string, tenantId: string, data: { name?: string; city?: string; phone?: string }) {
    await this.getById(id, tenantId); // verify exists
    return branchesRepository.update(id, tenantId, data);
  }

  async delete(id: string, tenantId: string) {
    await this.getById(id, tenantId);
    return branchesRepository.delete(id, tenantId);
  }
}

export const branchesService = new BranchesService();
