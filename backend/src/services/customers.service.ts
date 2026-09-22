import { customersRepository, type CustomerListFilters } from "@/repositories/customers.repository";
import { taxonomyService } from "@/services/taxonomy.service";
import { AppError } from "@/middleware/errorHandler";
import { getDefaultBranchId } from "@/utils/defaultBranch";
import { generateReference } from "@/utils/reference";
import type { PaginatedResult } from "@/types";
import type { Customer, Prisma } from "@prisma/client";
import { Prisma as PrismaNS } from "@prisma/client";

type AdditionalField = { label: string; value: string };

function normalizeAdditionalFields(value: unknown): AdditionalField[] | null {
  if (value == null) return null;
  if (!Array.isArray(value)) return null;
  const rows = value
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const label = String((row as { label?: unknown }).label ?? "").trim();
      const fieldValue = String((row as { value?: unknown }).value ?? "").trim();
      if (!label) return null;
      return { label, value: fieldValue };
    })
    .filter((row): row is AdditionalField => Boolean(row));
  return rows.length ? rows : null;
}

function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeCreditLimit(value: unknown): Prisma.Decimal | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) throw new AppError("Credit limit must be a non-negative number", 400);
  return new PrismaNS.Decimal(Math.round(n * 100) / 100);
}

function serializeCustomer(customer: Customer) {
  return {
    ...customer,
    creditLimit: customer.creditLimit == null ? null : Number(customer.creditLimit),
    additionalFields: normalizeAdditionalFields(customer.additionalFields) ?? [],
  };
}

export class CustomersService {
  async getPaginated(tenantId: string, filters: CustomerListFilters): Promise<PaginatedResult<ReturnType<typeof serializeCustomer>>> {
    const result = await customersRepository.findPaginated(tenantId, filters);
    return { ...result, data: result.data.map(serializeCustomer) };
  }

  async getById(id: string, tenantId: string) {
    const customer = await customersRepository.findById(id, tenantId);
    if (!customer) throw new AppError("Customer not found", 404);
    return serializeCustomer(customer);
  }

  async previewReference(tenantId: string) {
    const reference = await generateReference(tenantId, "CUST", "customer");
    return { reference };
  }

  async create(tenantId: string, data: {
    name: string; type?: string; typeOther?: string | null; contactPerson: string; email?: string;
    phone?: string; address?: string; city: string; country: string; licenseGst?: string | null;
    note?: string | null;
    paymentTerms?: string | null;
    creditLimit?: number | string | null;
    priceCategory?: string | null;
    deliveryAddress?: string | null;
    additionalFields?: AdditionalField[] | null;
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
    const created = await customersRepository.create(tenantId, {
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
      paymentTerms: normalizeOptionalText(data.paymentTerms),
      creditLimit: normalizeCreditLimit(data.creditLimit) ?? null,
      priceCategory: normalizeOptionalText(data.priceCategory),
      deliveryAddress: normalizeOptionalText(data.deliveryAddress),
      additionalFields: normalizeAdditionalFields(data.additionalFields) ?? PrismaNS.JsonNull,
      branchId,
    } as never);
    return serializeCustomer(created);
  }

  async update(id: string, tenantId: string, data: Record<string, unknown>) {
    const existing = await customersRepository.findById(id, tenantId);
    if (!existing) throw new AppError("Customer not found", 404);
    const next: Record<string, unknown> = { ...data };
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
    if ("paymentTerms" in next) next.paymentTerms = normalizeOptionalText(next.paymentTerms);
    if ("priceCategory" in next) next.priceCategory = normalizeOptionalText(next.priceCategory);
    if ("deliveryAddress" in next) next.deliveryAddress = normalizeOptionalText(next.deliveryAddress);
    if ("creditLimit" in next) next.creditLimit = normalizeCreditLimit(next.creditLimit) ?? null;
    if ("additionalFields" in next) {
      const fields = normalizeAdditionalFields(next.additionalFields);
      next.additionalFields = fields ?? PrismaNS.JsonNull;
    }
    const updated = await customersRepository.update(id, tenantId, next);
    return serializeCustomer(updated);
  }

  /**
   * Soft-delete a customer (status → inactive).
   * Related equipment, service requests, jobs, estimates, invoices, and sales
   * stay linked for history — never cascade-removed.
   */
  async delete(id: string, tenantId: string) {
    const existing = await customersRepository.findById(id, tenantId);
    if (!existing) throw new AppError("Customer not found", 404);
    if (existing.status === "inactive") {
      throw new AppError("Customer is already removed", 400);
    }
    const removed = await customersRepository.softDelete(id, tenantId);
    return {
      ...serializeCustomer(removed),
      related: {
        equipmentCount: existing.equipmentCount,
        activeJobs: existing.activeJobs,
      },
    };
  }

  async restore(id: string, tenantId: string) {
    const existing = await customersRepository.findById(id, tenantId);
    if (!existing) throw new AppError("Customer not found", 404);
    if (existing.status === "active") {
      throw new AppError("Customer is already active", 400);
    }
    return serializeCustomer(await customersRepository.restore(id, tenantId));
  }
}

export const customersService = new CustomersService();
