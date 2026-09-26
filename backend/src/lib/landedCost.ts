import { Prisma } from "@prisma/client";

export type LandedCostInputs = {
  merchandiseTotal: Prisma.Decimal | number;
  freightCost?: Prisma.Decimal | number | null;
  customsCost?: Prisma.Decimal | number | null;
  insuranceCost?: Prisma.Decimal | number | null;
};

function dec(value: Prisma.Decimal | number | null | undefined): Prisma.Decimal {
  if (value == null) return new Prisma.Decimal(0);
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

/** PDF: purchase cost + freight + customs + import (insurance) costs. */
export function computeLandedCostTotal(input: LandedCostInputs): Prisma.Decimal {
  const base = dec(input.merchandiseTotal);
  return base
    .plus(dec(input.freightCost))
    .plus(dec(input.customsCost))
    .plus(dec(input.insuranceCost));
}

export function computeLandedImportExtras(input: Omit<LandedCostInputs, "merchandiseTotal">): Prisma.Decimal {
  return dec(input.freightCost).plus(dec(input.customsCost)).plus(dec(input.insuranceCost));
}

type PoLineForLanded = {
  lineTotal: Prisma.Decimal | number;
  unitCost: Prisma.Decimal | number;
  quantityOrdered: number;
};

/**
 * Allocates import extras across PO lines by line value share; returns per-unit landed cost.
 */
export function computeLandedUnitCost(
  line: PoLineForLanded,
  merchandiseTotal: Prisma.Decimal | number,
  importExtras: Prisma.Decimal | number,
): Prisma.Decimal {
  const merch = dec(merchandiseTotal);
  const extras = dec(importExtras);
  const lineTotal = dec(line.lineTotal);
  if (line.quantityOrdered <= 0) return dec(line.unitCost);
  if (merch.lte(0) || extras.lte(0)) return dec(line.unitCost);
  const lineExtra = lineTotal.div(merch).mul(extras);
  const extraPerUnit = lineExtra.div(line.quantityOrdered);
  return dec(line.unitCost).plus(extraPerUnit);
}
