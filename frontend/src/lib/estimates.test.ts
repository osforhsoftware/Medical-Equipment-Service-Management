import { describe, expect, it } from "vitest";
import {
  estimateLevelDiscount,
  lineTotal,
  summarizeLines,
  totalsForEstimate,
} from "./estimates";

describe("estimate totals", () => {
  it("keeps a 120 discount out of the subtotal for qty 1 at 600", () => {
    const line = { quantity: 1, unitPrice: 600, discount: 120, taxRate: 0 };
    expect(lineTotal(line)).toBe(480);
    expect(summarizeLines([line])).toEqual({
      subtotal: 600,
      discount: 120,
      tax: 0,
      total: 480,
      lineDiscount: 120,
      headerDiscount: 0,
    });
  });

  it("sums two lines with different discounts and tax rates", () => {
    const totals = summarizeLines([
      { quantity: 2, unitPrice: 1000, discount: 100, taxRate: 18 },
      { quantity: 1, unitPrice: 500, discount: 25, taxRate: 5 },
    ]);
    // gross 2000 + 500 = 2500
    // taxable 1900 @ 18% = 342, taxable 475 @ 5% = 23.75
    expect(totals.subtotal).toBe(2500);
    expect(totals.discount).toBe(125);
    expect(totals.tax).toBe(365.75);
    expect(totals.total).toBe(2740.75);
  });

  it("clamps a line discount that is greater than the line amount", () => {
    const totals = summarizeLines([{ quantity: 1, unitPrice: 100, discount: 500, taxRate: 18 }]);
    expect(totals).toMatchObject({
      subtotal: 100,
      discount: 100,
      tax: 0,
      total: 0,
    });
  });

  it("adds the estimate-level discount once, on top of line discounts", () => {
    const lines = [{ quantity: 1, unitPrice: 600, discount: 120, taxRate: 0 }];
    const totals = summarizeLines(lines, 50);
    expect(totals).toMatchObject({
      subtotal: 600,
      discount: 170,
      tax: 0,
      total: 430,
      lineDiscount: 120,
      headerDiscount: 50,
    });

    const saved = {
      subtotal: 600,
      discount: 170,
      tax: 0,
      total: 430,
      lineItems: lines,
      revisions: [{ revision: 1, snapshot: { headerDiscount: 50 } }],
    };
    expect(estimateLevelDiscount(saved)).toBe(50);
    expect(totalsForEstimate(saved).discount).toBe(170);
  });

  it("does not treat a stored combined discount as another estimate-level discount", () => {
    const lines = [{ quantity: 1, unitPrice: 600, discount: 120, taxRate: 0 }];
    const saved = { subtotal: 600, discount: 170, lineItems: lines };
    expect(estimateLevelDiscount(saved)).toBe(50);
    expect(summarizeLines(lines, estimateLevelDiscount(saved)).discount).toBe(170);
  });

  it("treats empty and invalid amounts as zero and converts a percent discount", () => {
    expect(
      summarizeLines([{ quantity: Number.NaN, unitPrice: "", discount: "nope", taxRate: null }], Number.NaN),
    ).toMatchObject({ subtotal: 0, discount: 0, tax: 0, total: 0 });

    expect(
      summarizeLines([{ quantity: 2, unitPrice: 100, discount: 10, discountType: "percent", taxRate: 0 }]),
    ).toMatchObject({ subtotal: 200, discount: 20, tax: 0, total: 180 });
  });

  it("rounds only the summary figures", () => {
    const totals = summarizeLines([
      { quantity: 1, unitPrice: 10, discount: 0, taxRate: 10.04 },
      { quantity: 1, unitPrice: 10, discount: 0, taxRate: 10.04 },
    ]);
    // Each line tax is 1.004. Rounding each line first would total 2.00; the sum rounds to 2.01.
    expect(totals.tax).toBe(2.01);
    expect(totals.subtotal).toBe(20);
    expect(totals.total).toBe(22.01);
  });

  it("never lets the grand total go below zero", () => {
    expect(summarizeLines([{ quantity: 1, unitPrice: 600, discount: 0, taxRate: 0 }], 10000).total).toBe(0);
  });
});
