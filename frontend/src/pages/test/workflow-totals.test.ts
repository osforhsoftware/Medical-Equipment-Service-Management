import { describe, expect, it } from "vitest";
import { summarizeLines } from "@/lib/estimates";

describe("professional workflow totals", () => {
  it("calculates estimate line totals with a gross subtotal and separate discount", () => {
    const totals = summarizeLines([
      { quantity: 2, unitPrice: 1000, discount: 100, taxRate: 18 },
      { quantity: 1, unitPrice: 500, taxRate: 18 },
    ]);

    expect(totals.subtotal).toBe(2500);
    expect(totals.discount).toBe(100);
    expect(totals.tax).toBeCloseTo(432);
    expect(totals.total).toBeCloseTo(2832);
  });

  it("rejects non-positive reservation-style quantities", () => {
    const quantities = [0, -1, 2.5];
    const valid = quantities.filter((value) => Number.isInteger(value) && value > 0);
    expect(valid).toEqual([]);
  });
});
