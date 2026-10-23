export const DEFAULT_QA_CHECKLIST_POINTS = [
  "Repair & Part Replacement Verified",
  "Functional Testing Passed",
  "Calibration & Specs Checked",
  "Cleanliness & Decontamination OK",
  "Service Report & Documentation Ready",
] as const;

export type QaChecklistItem = {
  id: string;
  label: string;
  checked: boolean;
  isExtra?: boolean;
};

const LEGACY_QA_KEYS: Array<{ key: string; label: string }> = [
  { key: "repairVerified", label: "Repair & Part Replacement Verified" },
  { key: "testingPassed", label: "Functional Testing Passed" },
  { key: "calibrationChecked", label: "Calibration & Specs Checked" },
  { key: "cleanlinessOk", label: "Cleanliness & Decontamination OK" },
  { key: "docsReady", label: "Service Report & Documentation Ready" },
];

export function normalizeQaChecklistDefaults(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [...DEFAULT_QA_CHECKLIST_POINTS];
  const points = raw
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((label) => label.length > 0)
    .map((label) => label.slice(0, 200))
    .slice(0, 30);
  return points.length ? points : [...DEFAULT_QA_CHECKLIST_POINTS];
}

export function buildQaChecklistFromDefaults(defaults: string[]): QaChecklistItem[] {
  return normalizeQaChecklistDefaults(defaults).map((label, index) => ({
    id: `default-${index}`,
    label,
    checked: false,
    isExtra: false,
  }));
}

export function parseQaChecklist(raw: unknown): QaChecklistItem[] | null {
  if (raw == null) return null;

  if (Array.isArray(raw)) {
    const items: QaChecklistItem[] = [];
    for (const entry of raw) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
      const row = entry as Record<string, unknown>;
      const label = typeof row.label === "string" ? row.label.trim().slice(0, 200) : "";
      if (!label) continue;
      const id =
        typeof row.id === "string" && row.id.trim()
          ? row.id.trim().slice(0, 64)
          : `item-${items.length}`;
      items.push({
        id,
        label,
        checked: Boolean(row.checked),
        isExtra: Boolean(row.isExtra),
      });
      if (items.length >= 40) break;
    }
    return items.length ? items : null;
  }

  if (typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    if (!LEGACY_QA_KEYS.some(({ key }) => key in obj)) return null;
    return LEGACY_QA_KEYS.map(({ key, label }, index) => ({
      id: `default-${index}`,
      label,
      checked: Boolean(obj[key]),
      isExtra: false,
    }));
  }

  return null;
}

/** Resolve checklist for a job: saved items win; otherwise settings defaults. */
export function resolveJobQaChecklist(
  saved: unknown,
  defaults: string[] | undefined | null,
): QaChecklistItem[] {
  return parseQaChecklist(saved) ?? buildQaChecklistFromDefaults(defaults ?? DEFAULT_QA_CHECKLIST_POINTS);
}

export function allQaChecklistChecked(items: QaChecklistItem[]): boolean {
  const required = items.filter((item) => item.label.trim().length > 0);
  return required.length > 0 && required.every((item) => item.checked);
}

export function newExtraQaChecklistItem(existing: QaChecklistItem[]): QaChecklistItem {
  return {
    id: `extra-${Date.now()}-${existing.length}`,
    label: "",
    checked: false,
    isExtra: true,
  };
}
