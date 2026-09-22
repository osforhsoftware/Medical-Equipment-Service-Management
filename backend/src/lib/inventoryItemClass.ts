/** PPT Part/Item Master business classes: Spare Parts vs Consumables */

export const INVENTORY_ITEM_CLASSES = ["spare_part", "consumable"] as const;

export type InventoryItemClass = (typeof INVENTORY_ITEM_CLASSES)[number];

export const INVENTORY_ITEM_CLASS_LABELS: Record<InventoryItemClass, string> = {
  spare_part: "Spare Parts",
  consumable: "Consumables",
};

export function isInventoryItemClass(value: unknown): value is InventoryItemClass {
  return value === "spare_part" || value === "consumable";
}

/** Infer class from existing taxonomy category slug/name (legacy rows). */
export function inferItemClassFromCategory(category?: string | null): InventoryItemClass {
  const raw = (category ?? "").trim().toLowerCase();
  if (!raw) return "spare_part";
  if (
    raw === "consumables" ||
    raw === "consumable" ||
    raw.includes("consumable")
  ) {
    return "consumable";
  }
  return "spare_part";
}

export function formatInventoryItemClass(value?: string | null): string {
  if (isInventoryItemClass(value)) return INVENTORY_ITEM_CLASS_LABELS[value];
  return INVENTORY_ITEM_CLASS_LABELS.spare_part;
}
