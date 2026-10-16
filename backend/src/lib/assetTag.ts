/** First sequence number issued for a prefix that has no higher existing suffix. */
export const ASSET_TAG_SEQUENCE_START = 1001;

const STOP_WORDS = new Set([
  "THE",
  "AND",
  "OF",
  "FOR",
  "A",
  "AN",
  "INC",
  "LLC",
  "LTD",
  "PVT",
  "PRIVATE",
  "LIMITED",
  "COMPANY",
  "CO",
  "CORP",
  "CORPORATION",
  "GMBH",
  "PLC",
]);

/**
 * Central abbreviation rule for a company name.
 * Uppercase the name, drop punctuation, and drop legal or filler words.
 * One remaining word uses its first six letters.
 * Two or more words use the first three letters of the first word, a hyphen,
 * and the first letter of each of the next two words.
 * "Medical Facility Diagnostics" becomes MED-FD.
 * Stored prefixes are what new assets use; this function only suggests one.
 */
export function companyNameToAssetTagPrefix(companyName: string): string {
  const words = companyName
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9\s]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 0 && !STOP_WORDS.has(word));

  if (words.length === 0) return "AST";
  if (words.length === 1) {
    const word = words[0].replace(/[^A-Z0-9]/g, "");
    return word.slice(0, 6) || "AST";
  }

  const head = words[0].replace(/[^A-Z0-9]/g, "").slice(0, 3);
  const tail = words
    .slice(1, 3)
    .map((word) => word.replace(/[^A-Z0-9]/g, "").charAt(0))
    .filter(Boolean)
    .join("");
  const prefix = tail && head ? `${head}-${tail}` : head || tail;
  return isValidAssetTagPrefix(prefix) ? prefix : "AST";
}

export function normalizeAssetTagPrefix(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isValidAssetTagPrefix(prefix: string): boolean {
  return (
    prefix.length >= 2 &&
    prefix.length <= 20 &&
    /^[A-Z0-9]{1,12}(?:-[A-Z0-9]{1,12}){0,2}$/.test(prefix)
  );
}

export function formatAssetTag(prefix: string, sequence: number): string {
  return `${prefix}-${sequence}`;
}

/** Numeric suffix when the tag is exactly `{prefix}-{integer}`. */
export function sequenceFromAssetTag(prefix: string, assetTag: string): number | null {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`^${escaped}-(\\d+)$`, "i").exec(assetTag.trim());
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isInteger(value) || value < 1) return null;
  return value;
}

/**
 * Next number to store for a prefix that does not yet have a counter row.
 * Uses the highest matching suffix, and never starts below 1001.
 */
export function nextSequenceFromExisting(
  prefix: string,
  assetTags: string[],
  floor = ASSET_TAG_SEQUENCE_START,
): number {
  let maxBelow = floor - 1;
  for (const assetTag of assetTags) {
    const sequence = sequenceFromAssetTag(prefix, assetTag);
    if (sequence != null && sequence > maxBelow) maxBelow = sequence;
  }
  return Math.max(floor, maxBelow + 1);
}

/**
 * Reserve the next tag from a counter. Occupied tags are skipped forward.
 * The returned counter is the following number and is never lower than the input.
 */
export function claimNextSequence(
  nextSequence: number,
  isTaken: (assetTag: string) => boolean,
  prefix: string,
  maxSkips = 1000,
): { assetTag: string; nextSequence: number } {
  let sequence = Number.isInteger(nextSequence) ? nextSequence : ASSET_TAG_SEQUENCE_START;
  if (sequence < ASSET_TAG_SEQUENCE_START) sequence = ASSET_TAG_SEQUENCE_START;

  for (let skip = 0; skip < maxSkips; skip += 1) {
    const assetTag = formatAssetTag(prefix, sequence);
    if (!isTaken(assetTag)) {
      return { assetTag, nextSequence: sequence + 1 };
    }
    sequence += 1;
  }

  throw new Error("Unable to allocate a unique asset tag");
}
