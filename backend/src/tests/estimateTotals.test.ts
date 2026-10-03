import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateEstimateTotals, estimateLevelDiscount, priceLine } from "@/lib/estimateTotals";

describe("estimate totals", () => {
  it("keeps a 120 discount out of the subtotal for qty 1 at 600", () => {
    const line = { quantity: 1, unitPrice: 600, discount: 120, taxRate: 0 };
    assert.equal(priceLine(line).total, 480);
    const totals = calculateEstimateTotals([line]);
    assert.equal(totals.subtotal, 600);
    assert.equal(totals.discount, 120);
    assert.equal(totals.tax, 0);
    assert.equal(totals.total, 480);
    assert.equal(totals.lines[0].discount, 120);
  });

  it("sums two lines with different discounts and tax rates", () => {
    const totals = calculateEstimateTotals([
      { quantity: 2, unitPrice: 1000, discount: 100, taxRate: 18 },
      { quantity: 1, unitPrice: 500, discount: 25, taxRate: 5 },
    ]);
    assert.equal(totals.subtotal, 2500);
    assert.equal(totals.discount, 125);
    assert.equal(totals.tax, 365.75);
    assert.equal(totals.total, 2740.75);
  });

  it("clamps a line discount that is greater than the line amount", () => {
    const totals = calculateEstimateTotals([{ quantity: 1, unitPrice: 100, discount: 500, taxRate: 18 }]);
    assert.equal(totals.subtotal, 100);
    assert.equal(totals.discount, 100);
    assert.equal(totals.tax, 0);
    assert.equal(totals.total, 0);
    assert.equal(totals.lines[0].total, 0);
  });

  it("adds the estimate-level discount once, on top of line discounts", () => {
    const lines = [{ quantity: 1, unitPrice: 600, discount: 120, taxRate: 0 }];
    const totals = calculateEstimateTotals(lines, 50);
    assert.equal(totals.subtotal, 600);
    assert.equal(totals.discount, 170);
    assert.equal(totals.tax, 0);
    assert.equal(totals.total, 430);
    assert.equal(totals.lineDiscount, 120);
    assert.equal(totals.headerDiscount, 50);

    const saved = {
      subtotal: 600,
      discount: 170,
      lineItems: lines,
      revisions: [{ revision: 2, snapshot: { headerDiscount: 50 } }, { revision: 1, snapshot: { headerDiscount: 0 } }],
    };
    assert.equal(estimateLevelDiscount(saved), 50);
  });

  it("does not treat a stored combined discount as another estimate-level discount", () => {
    const lines = [{ quantity: 1, unitPrice: 600, discount: 120, taxRate: 0 }];
    const header = estimateLevelDiscount({ subtotal: 600, discount: 170, lineItems: lines });
    assert.equal(header, 50);
    assert.equal(calculateEstimateTotals(lines, header).discount, 170);
  });

  it("treats empty and invalid amounts as zero and converts a percent discount", () => {
    const empty = calculateEstimateTotals(
      [{ quantity: Number.NaN, unitPrice: "", discount: "nope", taxRate: null }],
      Number.NaN,
    );
    assert.equal(empty.subtotal, 0);
    assert.equal(empty.discount, 0);
    assert.equal(empty.tax, 0);
    assert.equal(empty.total, 0);

    const percent = calculateEstimateTotals([
      { quantity: 2, unitPrice: 100, discount: 10, discountType: "percent", taxRate: 0 },
    ]);
    assert.equal(percent.subtotal, 200);
    assert.equal(percent.discount, 20);
    assert.equal(percent.total, 180);
    assert.equal(percent.lines[0].discount, 20);
  });

  it("rounds only the summary figures", () => {
    const totals = calculateEstimateTotals([
      { quantity: 1, unitPrice: 10, discount: 0, taxRate: 10.04 },
      { quantity: 1, unitPrice: 10, discount: 0, taxRate: 10.04 },
    ]);
    assert.equal(totals.tax, 2.01);
    assert.equal(totals.subtotal, 20);
    assert.equal(totals.total, 22.01);
  });

  it("never lets the grand total go below zero", () => {
    assert.equal(calculateEstimateTotals([{ quantity: 1, unitPrice: 600, discount: 0, taxRate: 0 }], 10000).total, 0);
  });
});
