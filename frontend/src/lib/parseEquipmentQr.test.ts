import { describe, expect, it } from "vitest";
import { parseEquipmentQrValue } from "@/lib/parseEquipmentQr";

describe("parseEquipmentQrValue", () => {
  it("returns a plain asset tag", () => {
    expect(parseEquipmentQrValue("  MED-AX-2207  ")).toBe("MED-AX-2207");
  });

  it("reads assetTag from a URL query", () => {
    expect(parseEquipmentQrValue("https://mesms.local/app/qr-tracking?assetTag=MED-LR-3364")).toBe("MED-LR-3364");
  });

  it("reads a by-tag path segment", () => {
    expect(parseEquipmentQrValue("https://mesms.local/api/equipment/by-tag/MED-AX-1180")).toBe("MED-AX-1180");
  });
});
