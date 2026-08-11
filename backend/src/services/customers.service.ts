import { customersRepository } from "@/repositories/customers.repository";
import { AppError } from "@/middleware/errorHandler";
import { getDefaultBranchId } from "@/utils/defaultBranch";

function resolveCustomerType(type: string, typeOther?: string | null) {
  const trimmed = type.trim();
  if (trimmed === "Other") {
    const other = typeOther?.trim();
    return { type: other || trimmed, typeOther: other || null };
  }
  return { type: trimmed, typeOther: null };
}

export class CustomersService {
  async getAll(tenantId: string) {
    return customersRepository.findAll(tenantId);
  }

  async getById(id: string, tenantId: string) {
    const customer = await customersRepository.findById(id, tenantId);
    if (!customer) throw new AppError("Customer not found", 404);
    return customer;
  }

  async create(tenantId: string, data: {
    name: string; type: string; typeOther?: string | null; contactPerson: string; email: string;
    phone: string; address: string; city: string; country: string; licenseGst?: string | null;
    branchId?: string; status?: string;
  }) {
    const { type, typeOther } = resolveCustomerType(data.type, data.typeOther);
    const branchId = data.branchId || await getDefaultBranchId(tenantId);
    const licenseGst = data.licenseGst?.trim() || null;
    return customersRepository.create(tenantId, {
      ...data,
      type,
      typeOther,
      address: data.address.trim(),
      country: data.country.trim(),
      licenseGst,
      branchId,
    } as never);
  }

  async update(id: string, tenantId: string, data: Record<string, unknown>) {
    await this.getById(id, tenantId);
    const next = { ...data };
    if (typeof next.type === "string") {
      const resolved = resolveCustomerType(
        next.type,
        typeof next.typeOther === "string" ? next.typeOther : null,
      );
      next.type = resolved.type;
      next.typeOther = resolved.typeOther;
    }
    if (typeof next.address === "string") next.address = next.address.trim();
    if (typeof next.country === "string") next.country = next.country.trim();
    if (typeof next.licenseGst === "string") next.licenseGst = next.licenseGst.trim() || null;
    return customersRepository.update(id, tenantId, next);
  }

  async delete(id: string, tenantId: string) {
    await this.getById(id, tenantId);
    return customersRepository.delete(id, tenantId);
  }
}

export const customersService = new CustomersService();
