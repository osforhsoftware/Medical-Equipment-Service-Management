import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inventoryItemMatchesExtraType, requestableQuantity } from "@/lib/inventoryItemClass";

describe("requestable stock", () => {
  it("holds minimum stock and reserved units back", () => {
    assert.equal(requestableQuantity({ inStock: 15, reserved: 2, reorderLevel: 5 }), 8);
    assert.equal(requestableQuantity({ inStock: 1, reserved: 0, reorderLevel: 5 }), 0);
    assert.equal(requestableQuantity({ inStock: 4, reserved: 4, reorderLevel: 0 }), 0);
  });
});

describe("extra item type product filter", () => {
  const spare = { name: "Pulley", itemClass: "spare_part", category: "mechanical-components" };
  const oil = { name: "Oil tube", itemClass: "consumable", category: "consumables" };
  const scanner = { name: "CT Scanner", itemClass: "equipment", category: "equipment" };
  const namedMachine = { name: "X-Ray Machine", itemClass: "spare_part", category: "sensors" };

  it("lists spare parts and consumables only for product", () => {
    assert.equal(inventoryItemMatchesExtraType(spare, "product"), true);
    assert.equal(inventoryItemMatchesExtraType(oil, "product"), true);
    assert.equal(inventoryItemMatchesExtraType(scanner, "product"), false);
    assert.equal(inventoryItemMatchesExtraType(namedMachine, "product"), false);
  });

  it("lists equipment and machine-named items only for machine", () => {
    assert.equal(inventoryItemMatchesExtraType(scanner, "machine"), true);
    assert.equal(inventoryItemMatchesExtraType(namedMachine, "machine"), true);
    assert.equal(inventoryItemMatchesExtraType(spare, "machine"), false);
    assert.equal(inventoryItemMatchesExtraType(oil, "machine"), false);
  });

  it("keeps machine-named equipment off the equipment list", () => {
    assert.equal(inventoryItemMatchesExtraType(scanner, "equipment"), true);
    assert.equal(inventoryItemMatchesExtraType({ ...scanner, name: "CT Machine" }, "equipment"), false);
    assert.equal(inventoryItemMatchesExtraType(spare, "equipment"), false);
  });
});
