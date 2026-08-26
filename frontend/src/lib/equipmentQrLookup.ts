import { api, type BackendEquipmentHistory } from "@/lib/api";
import { parseEquipmentQrValue } from "@/lib/parseEquipmentQr";

export async function lookupScannedEquipment(
  raw: string,
  source: "camera" | "manual" | "label" = "manual",
): Promise<{ assetTag: string; history: BackendEquipmentHistory }> {
  const assetTag = parseEquipmentQrValue(raw);
  if (!assetTag) {
    throw new Error("The QR code did not contain an asset tag.");
  }
  await api.recordQrScan(assetTag, source);
  const history = await api.getEquipmentHistory(assetTag);
  return { assetTag, history };
}
