import { AppError } from "@/middleware/errorHandler";

/** Sales staff only see their own commercial records; admins and other desk roles see all. */
export function isSalesSelfScoped(role: string | undefined | null): boolean {
  return role === "sales";
}

export function salesOwnerFilter(role: string | undefined | null, userId: string): { salespersonId: string } | Record<string, never> {
  return isSalesSelfScoped(role) ? { salespersonId: userId } : {};
}

export function assertOwnSalesRecord(
  role: string | undefined | null,
  userId: string,
  ownerId: string | null | undefined,
  notFoundMessage = "Record not found",
) {
  if (isSalesSelfScoped(role) && ownerId !== userId) {
    throw new AppError(notFoundMessage, 404);
  }
}
