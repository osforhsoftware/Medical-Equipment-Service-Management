import { customersRepository, type CustomerListFilters } from "@/repositories/customers.repository";
import { taxonomyService } from "@/services/taxonomy.service";
import { AppError } from "@/middleware/errorHandler";
import { getDefaultBranchId } from "@/utils/defaultBranch";
import { generateReference } from "@/utils/reference";
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

  async previewReference(tenantId: string) {
    const reference = await generateReference(tenantId, "CUST", "customer");
    return { reference };
  }

  async create(tenantId: string, data: {
    name: string; type?: string; typeOther?: string | null; contactPerson: string; email?: string;
    phone?: string; address?: string; city: string; country: string; licenseGst?: string | null;
    note?: string | null;
    branchId?: string; status?: string;
  }) {
    const typeValue = data.type?.trim() ?? "";
    const type = typeValue
      ? await taxonomyService.resolveSlug(tenantId, "customer_type", typeValue)
      : "";
    const branchId = data.branchId || await getDefaultBranchId(tenantId);
    const licenseGst = data.licenseGst?.trim() || null;
    const note = data.note?.trim() || null;
    const reference = await generateReference(tenantId, "CUST", "customer");
    return customersRepository.create(tenantId, {
      ...data,
      reference,
      email: data.email?.trim() ?? "",
      type,
      typeOther: data.typeOther?.trim() || null,
      phone: data.phone?.trim() ?? "",
      address: data.address?.trim() ?? "",
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
      const typeValue = next.type.trim();
      next.type = typeValue
        ? await taxonomyService.resolveSlug(tenantId, "customer_type", typeValue, existing.type)
        : "";
    }
    if (typeof next.phone === "string") next.phone = next.phone.trim();
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
