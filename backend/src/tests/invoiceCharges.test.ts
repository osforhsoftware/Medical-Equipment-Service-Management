import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  chargeGroupForType,
  extraLineTotal,
  lineAmount,
  summarizeChargeGroups,
} from "@/utils/invoiceCharges";

describe("invoice charge grouping", () => {
  it("maps estimate, engineer, and billing types into the bill sections", () => {
    assert.equal(chargeGroupForType("part").label, "Products");
    assert.equal(chargeGroupForType("product").label, "Products");
    assert.equal(chargeGroupForType("equipment").label, "Equipment");
    assert.equal(chargeGroupForType("machine").label, "Machines");
    assert.equal(chargeGroupForType("labor").label, "Service Charges");
    assert.equal(chargeGroupForType("service").label, "Service Charges");
    assert.equal(chargeGroupForType("custom").label, "Custom");
    assert.equal(chargeGroupForType("extra").label, "Other Charges");
    assert.equal(chargeGroupForType("unknown").label, "Other Charges");
  });

  it("sums estimate + extras + billing lines into a final amount", () => {
    const summary = summarizeChargeGroups([
      { type: "labor", quantity: 1, unitPrice: 1000, taxRate: 0 },
      { type: "part", quantity: 2, unitPrice: 250, taxRate: 0 },
      { type: "machine", quantity: 1, unitPrice: 5000, taxRate: 0 },
      { type: "equipment", quantity: 1, unitPrice: 1500, taxRate: 0 },
      { type: "custom", quantity: 1, unitPrice: 300, taxRate: 0 },
      { type: "other", quantity: 1, unitPrice: 200, taxRate: 0 },
    ]);
    assert.equal(summary.groups.serviceCharges, 1000);
    assert.equal(summary.groups.products, 500);
    assert.equal(summary.groups.machines, 5000);
    assert.equal(summary.groups.equipment, 1500);
    assert.equal(summary.groups.customCharges, 300);
    assert.equal(summary.groups.otherCharges, 200);
    assert.equal(summary.total, 8500);
  });

  it("applies tax on engineer extras", () => {
    assert.equal(extraLineTotal({ quantity: 2, unitPrice: 100, taxRate: 18 }), 236);
    assert.equal(lineAmount({ type: "product", quantity: 1, unitPrice: 100, taxRate: 18 }), 118);
  });

  it("recomputes amounts and ignores stored/client lineTotal", () => {
    // 2 × 100 − 50 = 150 net, +10% tax = 165 — the bogus lineTotal must not win.
    assert.equal(
      lineAmount({ type: "part", quantity: 2, unitPrice: 100, discount: 50, taxRate: 10, lineTotal: 9999 }),
      165,
    );
  });

  it("applies discount on extras and clamps negative nets to zero", () => {
    assert.equal(extraLineTotal({ quantity: 2, unitPrice: 100, discount: 50, taxRate: 10 }), 165);
    assert.equal(extraLineTotal({ quantity: 1, unitPrice: 100, discount: 500, taxRate: 18 }), 0);
    assert.equal(lineAmount({ type: "part", quantity: 1, unitPrice: 100, discount: 500 }), 0);
  });
});
