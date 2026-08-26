/** Pull an asset tag from a scanned QR payload (plain tag or URL). */
export function parseEquipmentQrValue(raw: string): string {
  const value = raw.trim().replace(/^\uFEFF/, "");
  if (!value) return "";

  try {
    const url = new URL(value);
    const keys = ["assetTag", "asset_tag", "tag", "q", "code"];
    for (const key of keys) {
      const found = url.searchParams.get(key)?.trim();
      if (found) return found;
    }
    const segments = url.pathname.split("/").filter(Boolean);
    const marker = segments.findIndex((part) => part === "by-tag" || part === "qr-tracking");
    if (marker >= 0 && segments[marker + 1]) {
      return decodeURIComponent(segments[marker + 1]);
    }
    const last = segments[segments.length - 1];
    if (last && /^(MED-|EQ-|ASSET-)/i.test(last)) {
      return decodeURIComponent(last);
    }
  } catch {
    /* not a URL */
  }

  return value;
}
