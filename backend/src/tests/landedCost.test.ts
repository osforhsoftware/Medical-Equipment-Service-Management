import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma } from "@prisma/client";
import { computeLandedCostTotal, computeLandedUnitCost } from "@/lib/landedCost";

describe("landed cost", () => {
  it("sums merchandise and import extras", () => {
    const total = computeLandedCostTotal({
      merchandiseTotal: 1000,
      freightCost: 50,
      customsCost: 30,
      insuranceCost: 20,
    });
    assert.equal(Number(total), 1100);
  });

  it("allocates import extras to unit cost by line share", () => {
    const unit = computeLandedUnitCost(
      { lineTotal: 500, unitCost: 10, quantityOrdered: 50 },
      new Prisma.Decimal(1000),
      new Prisma.Decimal(100),
    );
    assert.ok(Math.abs(Number(unit) - 11) < 0.01);
  });
});
