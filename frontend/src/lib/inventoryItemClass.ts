/** PPT Part/Item Master business classes: Spare Parts, Consumables, Equipment */

export const INVENTORY_ITEM_CLASSES = ["spare_part", "consumable", "equipment"] as const;

export type InventoryItemClass = (typeof INVENTORY_ITEM_CLASSES)[number];

export const INVENTORY_ITEM_CLASS_OPTIONS: { value: InventoryItemClass; label: string }[] = [
  { value: "spare_part", label: "Spare Parts" },
  { value: "consumable", label: "Consumables" },
  { value: "equipment", label: "Equipment" },
];

export const INVENTORY_ITEM_CLASS_LABELS: Record<InventoryItemClass, string> = {
  spare_part: "Spare Parts",
  consumable: "Consumables",
  equipment: "Equipment",
};

export function isInventoryItemClass(value: unknown): value is InventoryItemClass {
  return value === "spare_part" || value === "consumable" || value === "equipment";
}

export function formatInventoryItemClass(value?: string | null): string {
  if (isInventoryItemClass(value)) return INVENTORY_ITEM_CLASS_LABELS[value];
  return INVENTORY_ITEM_CLASS_LABELS.spare_part;
}

/** Units that can be requested. Reserved stock and the reorder minimum stay in the warehouse. */
export function requestableStock(item: {
  inStock: number;
  reserved: number;
  reorderLevel?: number | null;
}): number {
  return Math.max(0, item.inStock - Math.max(0, item.reserved) - Math.max(0, item.reorderLevel ?? 0));
}

function mentionsMachine(item: { name?: string | null; category?: string | null; subcategory?: string | null }): boolean {
  const text = `${item.name ?? ""} ${item.category ?? ""} ${item.subcategory ?? ""}`.toLowerCase();
  return /\bmachines?\b/.test(text);
}

export function inventoryMatchesExtraType(
  item: { itemClass?: string | null; category?: string | null; subcategory?: string | null; name?: string | null },
  type: string,
): boolean {
  const normalized = (type || "product").toLowerCase();
  if (normalized === "custom" || normalized === "other") return false;
  const itemClass = isInventoryItemClass(item.itemClass) ? item.itemClass : inferItemClassFromCategory(item.category);
  const machine = mentionsMachine(item);
  if (normalized === "machine") return machine || itemClass === "equipment";
  if (normalized === "equipment") return itemClass === "equipment" && !machine;
  if (normalized === "product") return (itemClass === "spare_part" || itemClass === "consumable") && !machine;
  return false;
}

export function inferItemClassFromCategory(category?: string | null): InventoryItemClass {
  const raw = (category ?? "").trim().toLowerCase();
  if (!raw) return "spare_part";
  if (raw === "consumables" || raw === "consumable" || raw.includes("consumable")) {
    return "consumable";
  }
  if (raw === "equipment" || raw.includes("equipment")) {
    return "equipment";
  }
  return "spare_part";
}
