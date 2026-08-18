export const TAXONOMY_TYPES = [
  "equipment_category",
  "equipment_condition",
  "customer_type",
] as const;

export type TaxonomyTypeName = (typeof TAXONOMY_TYPES)[number];

export type DefaultTaxonomyTerm = {
  name: string;
  slug: string;
  sortOrder: number;
};

export const DEFAULT_TAXONOMY_TERMS: Record<TaxonomyTypeName, DefaultTaxonomyTerm[]> = {
  equipment_category: [
    { name: "Imaging", slug: "imaging", sortOrder: 10 },
    { name: "Life Support", slug: "life-support", sortOrder: 20 },
    { name: "Diagnostics", slug: "diagnostics", sortOrder: 30 },
    { name: "Laboratory", slug: "laboratory", sortOrder: 40 },
    { name: "Surgical", slug: "surgical", sortOrder: 50 },
    { name: "Monitoring", slug: "monitoring", sortOrder: 60 },
    { name: "Other", slug: "other", sortOrder: 70 },
  ],
  equipment_condition: [
    { name: "Operational", slug: "operational", sortOrder: 10 },
    { name: "Needs Service", slug: "needsService", sortOrder: 20 },
    { name: "Down", slug: "down", sortOrder: 30 },
  ],
  customer_type: [
    { name: "Hospital", slug: "Hospital", sortOrder: 10 },
    { name: "Clinic", slug: "Clinic", sortOrder: 20 },
    { name: "Diagnostic Lab", slug: "DiagnosticLab", sortOrder: 30 },
    { name: "Research", slug: "Research", sortOrder: 40 },
    { name: "Dental", slug: "Dental", sortOrder: 50 },
    { name: "Other", slug: "Other", sortOrder: 60 },
  ],
};

/** Historical stored values → canonical slugs. */
export const TAXONOMY_LEGACY_ALIASES: Record<TaxonomyTypeName, Record<string, string>> = {
  equipment_category: {
    Imaging: "imaging",
    "Life Support": "life-support",
    Diagnostics: "diagnostics",
    Laboratory: "laboratory",
    Surgical: "surgical",
    Monitoring: "monitoring",
    Other: "other",
  },
  equipment_condition: {
    "needs-service": "needsService",
    "Needs Service": "needsService",
    Operational: "operational",
    Down: "down",
  },
  customer_type: {},
};

export function slugifyTerm(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 80);
  return slug || "term";
}
