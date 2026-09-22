export type EquipmentWarrantyLike = {
  warrantyStart?: string | null;
  warrantyEnd?: string | null;
};

/** Operational lifecycle — distinct from physical condition and warranty coverage. */
export const EQUIPMENT_CURRENT_STATUS_OPTIONS = [
  { value: "in_service", label: "In service" },
  { value: "in_repair", label: "In repair" },
  { value: "in_storage", label: "In storage" },
  { value: "decommissioned", label: "Decommissioned" },
  { value: "disposed", label: "Disposed" },
] as const;

export function formatEquipmentCurrentStatus(status?: string | null) {
  const value = (status ?? "in_service").toLowerCase();
  return (
    EQUIPMENT_CURRENT_STATUS_OPTIONS.find((option) => option.value === value)?.label ?? "In service"
  );
}

export function hasEquipmentWarrantyCoverage(equipment: EquipmentWarrantyLike | null | undefined) {
  if (!equipment) return false;
  const start = equipment.warrantyStart?.trim();
  const end = equipment.warrantyEnd?.trim();
  return Boolean(start || end);
}

export function warrantyTone(equipment: EquipmentWarrantyLike | null | undefined): "ok" | "warn" | "danger" | "muted" {
  if (!equipment) return "muted";
  if (!equipment.warrantyEnd) return hasEquipmentWarrantyCoverage(equipment) ? "ok" : "muted";
  const end = new Date(equipment.warrantyEnd);
  if (Number.isNaN(end.getTime())) return "muted";
  const now = Date.now();
  const days = (end.getTime() - now) / (1000 * 60 * 60 * 24);
  if (days < 0) return "danger";
  if (days <= 60) return "warn";
  return "ok";
}
