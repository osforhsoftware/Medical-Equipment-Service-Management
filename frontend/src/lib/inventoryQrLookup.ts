import { api, type BackendInventoryItem } from "@/lib/api";
import { parseInventoryQrValue } from "@/lib/parseInventoryQr";

export async function lookupScannedInventory(
  raw: string,
): Promise<{ sku: string; item: BackendInventoryItem }> {
  const sku = parseInventoryQrValue(raw);
  if (!sku) {
    throw new Error("The QR code did not contain a part SKU.");
  }
  const item = await api.getInventoryBySku(sku);
  return { sku: item.sku, item };
}
