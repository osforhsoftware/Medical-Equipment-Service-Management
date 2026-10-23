import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { customerDocumentSummary } from "@/lib/customerDocumentSummary";

describe("customer document summary", () => {
  it("rolls parts into one line and labor into a single service charge", () => {
    const summary = customerDocumentSummary(
      [
        { type: "part", quantity: 1, unitPrice: 8000, discount: 0, taxRate: 0 },
        { type: "part", quantity: 2, unitPrice: 3700, discount: 0, taxRate: 0 },
        { type: "labor", quantity: 1, unitPrice: 1500, discount: 0, taxRate: 0 },
      ],
      { label: "Machine Service" },
    );
    assert.equal(summary.label, "Machine Service");
    assert.equal(summary.workAmount, 15400);
    assert.equal(summary.showServiceCharge, true);
    assert.equal(summary.serviceAmount, 1500);
    assert.equal(summary.total, 16900);
  });

  it("uses Service when the label is blank and omits a zero service row", () => {
    const summary = customerDocumentSummary(
      [{ type: "product", quantity: 1, unitPrice: 500, discount: 100, taxRate: 0 }],
      { label: "  " },
    );
    assert.equal(summary.label, "Service");
    assert.equal(summary.workAmount, 400);
    assert.equal(summary.showServiceCharge, false);
    assert.equal(summary.total, 400);
  });

  it("keeps tax and the header discount in the total only", () => {
    const summary = customerDocumentSummary(
      [
        { type: "equipment", quantity: 1, unitPrice: 10000, discount: 0, taxRate: 18 },
        { type: "service", quantity: 1, unitPrice: 1000, discount: 0, taxRate: 18 },
      ],
      { label: "Machine Service", headerDiscount: 500 },
    );
    assert.equal(summary.workAmount, 10000);
    assert.equal(summary.serviceAmount, 1000);
    assert.equal(summary.total, 12480);
  });
});
