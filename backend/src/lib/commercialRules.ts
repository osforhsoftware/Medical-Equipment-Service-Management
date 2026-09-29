import { Prisma } from "@prisma/client";
import { prisma } from "@/db/prisma";
import { AppError } from "@/middleware/errorHandler";

export const PRICE_CATEGORY_MULTIPLIER: Record<string, number> = {
  retail: 1,
  wholesale: 0.85,
  vip: 0.9,
  government: 0.92,
  standard: 1,
};

export const MIN_MARGIN_PCT = 20;

export type MarginMode = "off" | "fixed" | "on";

export type MarginRule = {
  mode: MarginMode;
  minMarginPct: number;
};

export const DEFAULT_MARGIN_RULE: MarginRule = { mode: "fixed", minMarginPct: MIN_MARGIN_PCT };

export function normalizeMarginMode(value: unknown): MarginMode {
  if (value === "off" || value === "on" || value === "fixed") return value;
  return "fixed";
}

/** Minimum margin for a line. Null means the percent check is skipped. */
export function requiredMarginPercent(
  rule: MarginRule,
  unitCost: number,
  catalogUnitPrice?: number | null,
): number | null {
  if (rule.mode === "off") return null;
  if (rule.mode === "fixed") {
    const pct = Number(rule.minMarginPct);
    if (!Number.isFinite(pct) || pct <= 0) return null;
    return pct;
  }
  const catalogMargin = marginPercent(Number(catalogUnitPrice ?? 0), unitCost);
  if (catalogMargin == null || catalogMargin <= 0) return null;
  return catalogMargin;
}

export async function loadMarginRule(
  tenantId: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<MarginRule> {
  const settings = await tx.tenantSettings.findUnique({
    where: { tenantId },
    select: { marginMode: true, minMarginPct: true },
  });
  return {
    mode: normalizeMarginMode(settings?.marginMode),
    minMarginPct: Number(settings?.minMarginPct ?? MIN_MARGIN_PCT),
  };
}

const OPEN_INVOICE_STATUSES = ["draft", "pendingApproval", "approved", "sent", "overdue"] as const;

export function applyPriceCategory(basePrice: number, category: string | null | undefined): number {
  if (!category) return roundMoney(basePrice);
  const multiplier = PRICE_CATEGORY_MULTIPLIER[category.toLowerCase().trim()] ?? 1;
  return roundMoney(basePrice * multiplier);
}

export function marginPercent(unitPrice: number, unitCost: number): number | null {
  if (!(unitPrice > 0)) return null;
  return ((unitPrice - unitCost) / unitPrice) * 100;
}

export function assertLineMargin(
  description: string,
  unitPrice: number,
  unitCost: number | null | undefined,
  rule: MarginRule = DEFAULT_MARGIN_RULE,
  catalogUnitPrice?: number | null,
) {
  if (unitCost == null || !Number.isFinite(unitCost) || unitCost <= 0) return;
  if (unitPrice < unitCost) {
    throw new AppError(`Cannot save below cost: ${description}`, 409);
  }
  const minimum = requiredMarginPercent(rule, unitCost, catalogUnitPrice);
  if (minimum == null) return;
  const margin = marginPercent(unitPrice, unitCost);
  if (margin != null && margin < minimum) {
    const label = Number.isInteger(minimum) ? String(minimum) : minimum.toFixed(1);
    throw new AppError(
      `Margin for ${description} is ${margin.toFixed(1)}% (minimum ${label}%). Increase the price before saving.`,
      409,
    );
  }
}

export async function customerOutstandingBalance(tenantId: string, customerId: string, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  const agg = await tx.invoice.aggregate({
    where: {
      tenantId,
      customerId,
      status: { in: [...OPEN_INVOICE_STATUSES] },
    },
    _sum: { balanceDue: true },
  });
  return Number(agg._sum.balanceDue ?? 0);
}

export async function assertCustomerCreditAllows(
  tenantId: string,
  customerId: string,
  additionalAmount: number,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const customer = await tx.customer.findFirst({
    where: { id: customerId, tenantId },
    select: { name: true, creditLimit: true },
  });
  if (!customer?.creditLimit) return;
  const limit = Number(customer.creditLimit);
  if (!(limit > 0)) return;
  const outstanding = await customerOutstandingBalance(tenantId, customerId, tx);
  const projected = outstanding + Math.max(0, additionalAmount);
  if (projected > limit + 0.009) {
    throw new AppError(
      `Credit limit exceeded for ${customer.name}. Limit ${limit.toFixed(2)}, outstanding ${outstanding.toFixed(2)}, this document ${Math.max(0, additionalAmount).toFixed(2)}.`,
      409,
    );
  }
}

function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}
