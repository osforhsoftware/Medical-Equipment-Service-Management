import { customersRepository } from "@/repositories/customers.repository";
import { AppError } from "@/middleware/errorHandler";

export class CustomersService {
  async getAll(tenantId: string, branchId?: string) {
    return customersRepository.findAll(tenantId, branchId);
  }

  async getById(id: string, tenantId: string) {
    const customer = await customersRepository.findById(id, tenantId);
    if (!customer) throw new AppError("Customer not found", 404);
    return customer;
  }

  async create(tenantId: string, data: {
    name: string; type: string; contactPerson: string; email: string;
    phone: string; city: string; branchId: string; status?: string;
  }) {
    return customersRepository.create(tenantId, data as never);
  }

  async update(id: string, tenantId: string, data: Record<string, unknown>) {
    await this.getById(id, tenantId);
    return customersRepository.update(id, tenantId, data);
  }

  async delete(id: string, tenantId: string) {
    await this.getById(id, tenantId);
    return customersRepository.delete(id, tenantId);
  }
}

export const customersService = new CustomersService();
