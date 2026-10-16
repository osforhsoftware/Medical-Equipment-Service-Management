import { customersRepository } from "@/repositories/customers.repository";
import { AppError } from "@/middleware/errorHandler";

export function inactiveCustomerMessage(name: string): string {
  return `${name} is inactive and cannot be selected for new transactions.`;
}

/** Load a customer and reject inactive records for a new transaction. */
export async function requireActiveCustomer(tenantId: string, customerId: string) {
  const customer = await customersRepository.findById(customerId, tenantId);
  if (!customer) throw new AppError("Customer not found", 404);
  if (customer.status !== "active") {
    throw new AppError(inactiveCustomerMessage(customer.name), 422);
  }
  return customer;
}

/**
 * Allow the customer already stored on a record to stay, including when inactive.
 * A different inactive customer cannot be chosen.
 */
export function assertCustomerSelectable<T extends { id: string; name: string; status: string }>(
  customer: T,
  currentCustomerId?: string | null,
): T {
  if (customer.status !== "active" && customer.id !== currentCustomerId) {
    throw new AppError(inactiveCustomerMessage(customer.name), 422);
  }
  return customer;
}
