import type { BackendTaxonomyTerm, TaxonomyType } from "@/lib/api";

export type { TaxonomyType };

export const TAXONOMY_TABS: { type: TaxonomyType; label: string; singular: string }[] = [
  { type: "equipment_category", label: "Equipment Categories", singular: "category" },
  { type: "equipment_condition", label: "Equipment Conditions", singular: "condition" },
  { type: "customer_type", label: "Customer Types", singular: "customer type" },
  { type: "inventory_category", label: "Inventory Categories", singular: "inventory category" },
  { type: "inventory_subcategory", label: "Inventory Subcategories", singular: "subcategory" },
];

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
  return slug || "";
}

export function termLabel(
  terms: BackendTaxonomyTerm[] | undefined,
  value: string | null | undefined,
  fallback?: string | null,
): string {
  if (!value && !fallback) return "—";
  const needle = value?.trim() || "";
  const term = terms?.find((t) => t.slug === needle || t.name === needle);
  if (term) return term.name;
  if (needle === "Other" && fallback?.trim()) return fallback.trim();
  return needle || fallback?.trim() || "—";
}

export function activeTerms(terms: BackendTaxonomyTerm[] | undefined): BackendTaxonomyTerm[] {
  return (terms ?? []).filter((t) => t.isActive);
}
