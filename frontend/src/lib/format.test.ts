import { describe, expect, it } from "vitest";
import { formatCount, formatCurrency, formatDocumentCurrency, parseAmount, toMoney } from "./format";

describe("parseAmount", () => {
  it("accepts numbers, locale strings, and currency symbols", () => {
    expect(parseAmount(250000)).toBe(250000);
    expect(parseAmount("2,50,000")).toBe(250000);
    expect(parseAmount("₹1,250.50")).toBe(1250.5);
    expect(parseAmount(null)).toBe(0);
    expect(parseAmount("abc")).toBe(0);
  });
});

describe("toMoney / formatCurrency", () => {
  it("formats typical INR amounts with Indian grouping", () => {
    expect(toMoney(250000)).toBe("2,50,000");
    expect(formatCurrency(1250.5)).toBe("₹1,250.5");
    expect(formatDocumentCurrency(1250)).toBe("₹1,250.00");
  });

  it("compacts values that would overflow UI cells", () => {
    expect(formatCurrency(2.5e32).length).toBeLessThan(16);
    expect(formatCount(2.5e32).length).toBeLessThan(16);
  });
});
