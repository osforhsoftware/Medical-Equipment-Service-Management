/** Pull a part SKU from a scanned QR payload (plain SKU or URL). */
export function parseInventoryQrValue(raw: string): string {
  const value = raw.trim().replace(/^\uFEFF/, "");
  if (!value) return "";

  try {
    const url = new URL(value);
    const keys = ["sku", "partId", "part_id", "q", "code"];
    for (const key of keys) {
      const found = url.searchParams.get(key)?.trim();
      if (found) return found;
    }
    const segments = url.pathname.split("/").filter(Boolean);
    const marker = segments.findIndex((part) => part === "by-sku");
    if (marker >= 0 && segments[marker + 1]) {
      return decodeURIComponent(segments[marker + 1]);
    }
    const last = segments[segments.length - 1];
    if (last && last !== "qr" && last !== "inventory" && /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+$/.test(last)) {
      return decodeURIComponent(last);
    }
  } catch {
    /* not a URL */
  }

  return value;
}
