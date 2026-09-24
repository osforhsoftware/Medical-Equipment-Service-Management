export type EquipmentWarrantyLike = {
  warrantyStart?: string | null;
  warrantyEnd?: string | null;
  noMachineWarranty?: boolean | null;
  serviceWarrantyStart?: string | null;
  serviceWarrantyEnd?: string | null;
  noServiceWarranty?: boolean | null;
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

export function formatMachineWarrantyLabel(equipment: EquipmentWarrantyLike | null | undefined): string {
  if (!equipment) return "—";
  if (equipment.noMachineWarranty) return "No machine warranty";
  if (equipment.warrantyEnd) return `Ends ${equipment.warrantyEnd}`;
  if (equipment.warrantyStart) return `Starts ${equipment.warrantyStart}`;
  return "Not set";
}

export function formatServiceWarrantyLabel(equipment: EquipmentWarrantyLike | null | undefined): string {
  if (!equipment) return "—";
  if (equipment.noServiceWarranty) return "No service warranty";
  if (equipment.serviceWarrantyEnd) return `Ends ${equipment.serviceWarrantyEnd}`;
  if (equipment.serviceWarrantyStart) return `Starts ${equipment.serviceWarrantyStart}`;
  return "Not set";
}

export function hasEquipmentWarrantyCoverage(equipment: EquipmentWarrantyLike | null | undefined) {
  if (!equipment) return false;
  const machine =
    !equipment.noMachineWarranty &&
    Boolean(equipment.warrantyStart?.trim() || equipment.warrantyEnd?.trim());
  const service =
    !equipment.noServiceWarranty &&
    Boolean(equipment.serviceWarrantyStart?.trim() || equipment.serviceWarrantyEnd?.trim());
  return machine || service;
}

function toneForEndDate(endValue: string | null | undefined): "ok" | "warn" | "danger" | "muted" {
  if (!endValue) return "muted";
  const end = new Date(endValue);
  if (Number.isNaN(end.getTime())) return "muted";
  const now = Date.now();
  const days = (end.getTime() - now) / (1000 * 60 * 60 * 24);
  if (days < 0) return "danger";
  if (days <= 60) return "warn";
  return "ok";
}

/** Prefer the nearer-expiring of machine vs service warranty for list badges. */
export function warrantyTone(equipment: EquipmentWarrantyLike | null | undefined): "ok" | "warn" | "danger" | "muted" {
  if (!equipment) return "muted";
  if (equipment.noMachineWarranty && equipment.noServiceWarranty) return "muted";
  if (!hasEquipmentWarrantyCoverage(equipment)) {
    if (equipment.noMachineWarranty || equipment.noServiceWarranty) return "muted";
    return "muted";
  }
  const machine = equipment.noMachineWarranty ? "muted" : toneForEndDate(equipment.warrantyEnd);
  const service = equipment.noServiceWarranty ? "muted" : toneForEndDate(equipment.serviceWarrantyEnd);
  const rank = { danger: 3, warn: 2, ok: 1, muted: 0 } as const;
  return rank[machine] >= rank[service] ? machine : service;
}
