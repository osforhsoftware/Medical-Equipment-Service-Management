/**
 * Helpers for numeric text fields so default "0" values do not produce leading zeroes
 * (e.g. typing 10 into a field that showed 0 becoming "010").
 */

/** Strip leading zeroes while preserving sign, decimals, and in-progress entry (e.g. "0.", "-"). */
export function normalizeNumberInputValue(value: string): string {
  if (value === "" || value === "-" || value === "." || value === "-.") {
    return value;
  }

  const negative = value.startsWith("-");
  let body = negative ? value.slice(1) : value;

  const endsWithDot = body.endsWith(".");
  if (endsWithDot) {
    body = body.slice(0, -1);
  }

  if (body === "") {
    return `${negative ? "-" : ""}${endsWithDot ? "." : ""}`;
  }

  const dotIndex = body.indexOf(".");
  let intPart = dotIndex >= 0 ? body.slice(0, dotIndex) : body;
  const fracPart = dotIndex >= 0 ? body.slice(dotIndex + 1) : null;

  // "010" → "10", "000" → "0", "0" → "0"
  intPart = intPart.replace(/^0+(?=\d)/, "");
  if (intPart === "") intPart = "0";

  let result = intPart;
  if (fracPart !== null) {
    result += `.${fracPart}`;
  } else if (endsWithDot) {
    result += ".";
  }

  return negative ? `-${result}` : result;
}

/** Parse a numeric input for save/submit; empty / incomplete values fall back cleanly. */
export function parseNumberInput(value: string | number | null | undefined, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;

  const trimmed = value.trim();
  if (trimmed === "" || trimmed === "-" || trimmed === "." || trimmed === "-.") {
    return fallback;
  }

  const n = Number(normalizeNumberInputValue(trimmed));
  return Number.isFinite(n) ? n : fallback;
}
