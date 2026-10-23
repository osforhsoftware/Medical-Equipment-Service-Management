import { describe, expect, it } from "vitest";
import { parseInventoryQrValue } from "@/lib/parseInventoryQr";

describe("parseInventoryQrValue", () => {
  it("returns a plain SKU", () => {
    expect(parseInventoryQrValue("  SKU-2024-0001  ")).toBe("SKU-2024-0001");
  });

  it("reads sku from a URL query", () => {
    expect(parseInventoryQrValue("https://mesms.local/app/inventory/qr?sku=SP-ECG-001")).toBe("SP-ECG-001");
  });

  it("reads a by-sku path segment", () => {
    expect(parseInventoryQrValue("https://mesms.local/api/inventory/by-sku/CON-GEL-250")).toBe("CON-GEL-250");
  });

  it("reads a hyphenated code from the last path segment", () => {
    expect(parseInventoryQrValue("https://mesms.local/inventory/PART-AX-1001")).toBe("PART-AX-1001");
  });
});
