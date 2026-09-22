export type EquipmentWarrantyFields = {
  warrantyStart?: Date | string | null;
  warrantyEnd?: Date | string | null;
  amcStatus?: string | null;
};

export function hasEquipmentWarrantyCoverage(equipment: EquipmentWarrantyFields | null | undefined): boolean {
  if (!equipment) return false;
  const start = equipment.warrantyStart ? String(equipment.warrantyStart).trim() : "";
  const end = equipment.warrantyEnd ? String(equipment.warrantyEnd).trim() : "";
  const amc = (equipment.amcStatus ?? "none").trim().toLowerCase();
  return Boolean(start || end || (amc && amc !== "none"));
}

export function parseOptionalWarrantyDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function buildEquipmentWarrantyUpdate(input: {
  warrantyStart?: string | Date | null;
  warrantyEnd?: string | Date | null;
  amcStatus?: string | null;
  touchLastService?: boolean;
}): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (input.warrantyStart !== undefined) {
    data.warrantyStart = parseOptionalWarrantyDate(input.warrantyStart) ?? null;
  }
  if (input.warrantyEnd !== undefined) {
    data.warrantyEnd = parseOptionalWarrantyDate(input.warrantyEnd) ?? null;
  }
  if (input.amcStatus !== undefined && input.amcStatus !== null && input.amcStatus !== "") {
    data.amcStatus = input.amcStatus;
  }
  if (input.touchLastService) {
    data.lastServiceDate = new Date();
  }
  return data;
}
