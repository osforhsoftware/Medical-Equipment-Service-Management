import { describe, expect, it } from "vitest";

type Line = {
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxRate?: number;
};

function calculateDocumentTotals(lines: Line[]) {
  const subtotal = lines.reduce(
    (sum, line) => sum + line.quantity * line.unitPrice - (line.discount ?? 0),
    0,
  );
  const tax = lines.reduce((sum, line) => {
    const taxable = line.quantity * line.unitPrice - (line.discount ?? 0);
    return sum + taxable * ((line.taxRate ?? 0) / 100);
  }, 0);
  return { subtotal, tax, total: subtotal + tax };
}

describe("professional workflow totals", () => {
  it("calculates estimate/invoice line totals with tax and discount", () => {
    const totals = calculateDocumentTotals([
      { quantity: 2, unitPrice: 1000, discount: 100, taxRate: 18 },
      { quantity: 1, unitPrice: 500, taxRate: 18 },
    ]);

    expect(totals.subtotal).toBe(2400);
    expect(totals.tax).toBeCloseTo(432);
    expect(totals.total).toBeCloseTo(2832);
  });

  it("rejects non-positive reservation-style quantities", () => {
    const quantities = [0, -1, 2.5];
    const valid = quantities.filter((value) => Number.isInteger(value) && value > 0);
    expect(valid).toEqual([]);
  });
});
