import { describe, expect, it } from "vitest";
import { normalizeNumberInputValue, parseNumberInput } from "./numberInput";

describe("normalizeNumberInputValue", () => {
  it("strips leading zeroes", () => {
    expect(normalizeNumberInputValue("010")).toBe("10");
    expect(normalizeNumberInputValue("000")).toBe("0");
    expect(normalizeNumberInputValue("0")).toBe("0");
  });

  it("preserves decimals and in-progress entry", () => {
    expect(normalizeNumberInputValue("0.5")).toBe("0.5");
    expect(normalizeNumberInputValue("00.5")).toBe("0.5");
    expect(normalizeNumberInputValue("10.")).toBe("10.");
    expect(normalizeNumberInputValue("")).toBe("");
    expect(normalizeNumberInputValue("-")).toBe("-");
    expect(normalizeNumberInputValue(".")).toBe(".");
  });

  it("handles negatives", () => {
    expect(normalizeNumberInputValue("-010")).toBe("-10");
    expect(normalizeNumberInputValue("-0.5")).toBe("-0.5");
  });
});

describe("parseNumberInput", () => {
  it("falls back cleanly for empty values", () => {
    expect(parseNumberInput("")).toBe(0);
    expect(parseNumberInput("-")).toBe(0);
    expect(parseNumberInput(null)).toBe(0);
    expect(parseNumberInput("010")).toBe(10);
    expect(parseNumberInput("  " , 5)).toBe(5);
  });
});
