import { customersRepository, type CustomerListFilters } from "@/repositories/customers.repository";
import { taxonomyService } from "@/services/taxonomy.service";
import { AppError } from "@/middleware/errorHandler";
import { getDefaultBranchId } from "@/utils/defaultBranch";
import type { PaginatedResult } from "@/types";
import type { Customer } from "@prisma/client";

export class CustomersService {
  async getPaginated(tenantId: string, filters: CustomerListFilters): Promise<PaginatedResult<Customer>> {
    return customersRepository.findPaginated(tenantId, filters);
  }

  async getById(id: string, tenantId: string) {
    const customer = await customersRepository.findById(id, tenantId);
    if (!customer) throw new AppError("Customer not found", 404);
    return customer;
  }

  async create(tenantId: string, data: {
    name: string; type: string; typeOther?: string | null; contactPerson: string; email?: string;
    phone: string; address: string; city: string; country: string; licenseGst?: string | null;
    note?: string | null;
    branchId?: string; status?: string;
  }) {
    const type = await taxonomyService.resolveSlug(tenantId, "customer_type", data.type);
    const branchId = data.branchId || await getDefaultBranchId(tenantId);
    const licenseGst = data.licenseGst?.trim() || null;
    const note = data.note?.trim() || null;
    return customersRepository.create(tenantId, {
      ...data,
      email: data.email?.trim() ?? "",
      type,
      typeOther: data.typeOther?.trim() || null,
      address: data.address.trim(),
      city: data.city?.trim() ?? "",
      country: data.country?.trim() ?? "",
      licenseGst,
      note,
      branchId,
    } as never);
  }

  async update(id: string, tenantId: string, data: Record<string, unknown>) {
    const existing = await this.getById(id, tenantId);
    const next = { ...data };
    if (typeof next.type === "string") {
      next.type = await taxonomyService.resolveSlug(
        tenantId,
        "customer_type",
        next.type,
        existing.type,
      );
    }
    if (typeof next.address === "string") next.address = next.address.trim();
    if (typeof next.city === "string") next.city = next.city.trim();
    if (typeof next.country === "string") next.country = next.country.trim();
    if (typeof next.licenseGst === "string") next.licenseGst = next.licenseGst.trim() || null;
    if (typeof next.note === "string") next.note = next.note.trim() || null;
    return customersRepository.update(id, tenantId, next);
  }

  async delete(id: string, tenantId: string) {
    await this.getById(id, tenantId);
    return customersRepository.delete(id, tenantId);
  }
}

export const customersService = new CustomersService();
