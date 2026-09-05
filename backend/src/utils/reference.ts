import { Prisma } from "@prisma/client";
import { prisma } from "@/db/prisma";
import { AppError } from "@/middleware/errorHandler";

export type RefModel =
  | "serviceRequest"
  | "estimate"
  | "serviceJob"
  | "purchaseOrder"
  | "stockTransfer"
  | "salesOrder"
  | "customer";

type DbClient = Prisma.TransactionClient | typeof prisma;

export function formatReference(prefix: string, year: number, sequence: number): string {
  return `${prefix}-${year}-${String(sequence).padStart(4, "0")}`;
}

export function parseReferenceSequence(reference: string, prefix: string, year: number): number | null {
  const expected = `${prefix}-${year}-`;
  if (!reference.startsWith(expected)) return null;
  const n = Number(reference.slice(expected.length));
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

async function findLastReference(
  db: DbClient,
  tenantId: string,
  model: RefModel,
  yearPrefix: string,
) {
  const where = { tenantId, reference: { startsWith: yearPrefix } };
  const orderBy = { reference: "desc" as const };
  const select = { reference: true };

  switch (model) {
    case "serviceRequest":
      return db.serviceRequest.findFirst({ where, orderBy, select });
    case "estimate":
      return db.estimate.findFirst({ where, orderBy, select });
    case "serviceJob":
      return db.serviceJob.findFirst({ where, orderBy, select });
    case "purchaseOrder":
      return db.purchaseOrder.findFirst({ where, orderBy, select });
    case "stockTransfer":
      return db.stockTransfer.findFirst({ where, orderBy, select });
    case "salesOrder":
      return db.salesOrder.findFirst({ where, orderBy, select });
    case "customer":
      return db.customer.findFirst({ where, orderBy, select });
  }
}

async function referenceExists(
  db: DbClient,
  tenantId: string,
  model: RefModel,
  reference: string,
) {
  const where = { tenantId, reference };
  const select = { id: true };

  switch (model) {
    case "serviceRequest":
      return db.serviceRequest.findFirst({ where, select });
    case "estimate":
      return db.estimate.findFirst({ where, select });
    case "serviceJob":
      return db.serviceJob.findFirst({ where, select });
    case "purchaseOrder":
      return db.purchaseOrder.findFirst({ where, select });
    case "stockTransfer":
      return db.stockTransfer.findFirst({ where, select });
    case "salesOrder":
      return db.salesOrder.findFirst({ where, select });
    case "customer":
      return db.customer.findFirst({ where, select });
  }
}

/**
 * Allocate PREFIX-YEAR-NNNN using the highest existing number for that year,
 * then skip any leftover gaps so deleted records cannot reuse a live number.
 */
export async function generateReference(
  tenantId: string,
  prefix: string,
  model: RefModel,
  db: DbClient = prisma,
): Promise<string> {
  const year = new Date().getFullYear();
  const yearPrefix = `${prefix}-${year}-`;
  const last = await findLastReference(db, tenantId, model, yearPrefix);
  let sequence = 1;
  if (last?.reference) {
    sequence = (parseReferenceSequence(last.reference, prefix, year) ?? 0) + 1;
  }
  if (sequence < 1) sequence = 1;

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const reference = formatReference(prefix, year, sequence);
    if (!(await referenceExists(db, tenantId, model, reference))) {
      return reference;
    }
    sequence += 1;
  }

  throw new AppError("Unable to allocate a unique reference number. Please try again.", 409);
}
