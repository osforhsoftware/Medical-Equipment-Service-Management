export type CustomerAdditionalField = {
  label: string;
  value: string;
};

export function parseCustomerAdditionalFields(value: unknown): CustomerAdditionalField[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const label = String((row as { label?: unknown }).label ?? "").trim();
      const fieldValue = String((row as { value?: unknown }).value ?? "").trim();
      if (!label) return null;
      return { label, value: fieldValue };
    })
    .filter((row): row is CustomerAdditionalField => Boolean(row));
}

export function sanitizeCustomerAdditionalFields(rows: CustomerAdditionalField[]): CustomerAdditionalField[] {
  return rows
    .map((row) => ({
      label: row.label.trim(),
      value: row.value.trim(),
    }))
    .filter((row) => row.label.length > 0)
    .slice(0, 30);
}
