/** PPT Part/Item Master business classes: Spare Parts, Consumables, Equipment */

export const INVENTORY_ITEM_CLASSES = ["spare_part", "consumable", "equipment"] as const;

export type InventoryItemClass = (typeof INVENTORY_ITEM_CLASSES)[number];

export const INVENTORY_ITEM_CLASS_LABELS: Record<InventoryItemClass, string> = {
  spare_part: "Spare Parts",
  consumable: "Consumables",
  equipment: "Equipment",
};

export function isInventoryItemClass(value: unknown): value is InventoryItemClass {
  return value === "spare_part" || value === "consumable" || value === "equipment";
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
  if (raw === "equipment" || raw.includes("equipment")) {
    return "equipment";
  }
  return "spare_part";
}

export function formatInventoryItemClass(value?: string | null): string {
  if (isInventoryItemClass(value)) return INVENTORY_ITEM_CLASS_LABELS[value];
  return INVENTORY_ITEM_CLASS_LABELS.spare_part;
}
