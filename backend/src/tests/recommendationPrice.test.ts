import assert from "node:assert/strict";
import test from "node:test";
import { recommendationLinePrice, recommendationUnitPrice } from "@/lib/recommendationPrice";

test("recommendation price uses selling price, then cost, and extends by quantity", () => {
  assert.equal(
    recommendationUnitPrice({
      inventoryItem: { sellingPrice: 0, unitCost: 180 },
    }),
    180,
  );
  assert.equal(
    recommendationLinePrice({
      inventoryItem: { sellingPrice: 250, unitCost: 180 },
      quantity: 2,
      estimatedCost: 0,
    }),
    500,
  );
});

test("recommendation price keeps a stored amount when inventory has no price", () => {
  assert.equal(
    recommendationLinePrice({
      inventoryItem: { sellingPrice: 0, unitCost: 0 },
      quantity: 2,
      estimatedCost: 90,
    }),
    90,
  );
});
