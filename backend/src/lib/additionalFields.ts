export type AdditionalField = { label: string; value: string };

export function normalizeAdditionalFields(value: unknown): AdditionalField[] | null {
  if (value == null) return null;
  if (!Array.isArray(value)) return null;
  const rows = value
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const label = String((row as { label?: unknown }).label ?? "").trim();
      const fieldValue = String((row as { value?: unknown }).value ?? "").trim();
      if (!label) return null;
      return { label, value: fieldValue };
    })
    .filter((row): row is AdditionalField => Boolean(row));
  return rows.length ? rows : null;
}
