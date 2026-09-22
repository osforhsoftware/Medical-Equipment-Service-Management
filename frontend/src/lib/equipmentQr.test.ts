import { describe, expect, it } from "vitest";
import { QR_LABEL_DPI, QR_LABEL_SIZE_MM, QR_LABEL_SIZE_PX } from "./equipmentQr";

describe("equipment QR label size", () => {
  it("defaults to a 50 × 50 mm sticker at 300 DPI (~591 px)", () => {
    expect(QR_LABEL_SIZE_MM).toBe(50);
    expect(QR_LABEL_DPI).toBe(300);
    expect(QR_LABEL_SIZE_PX).toBe(Math.round((50 / 25.4) * 300));
    expect(QR_LABEL_SIZE_PX).toBe(591);
  });
});
