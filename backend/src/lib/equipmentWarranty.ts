export type EquipmentWarrantyFields = {
  warrantyStart?: Date | string | null;
  warrantyEnd?: Date | string | null;
  noMachineWarranty?: boolean | null;
  serviceWarrantyStart?: Date | string | null;
  serviceWarrantyEnd?: Date | string | null;
  noServiceWarranty?: boolean | null;
  amcStatus?: string | null;
};

function hasDateValue(value: Date | string | null | undefined): boolean {
  return Boolean(value ? String(value).trim() : "");
}

/** True when machine or service warranty dates (or AMC) indicate active coverage. */
export function hasEquipmentWarrantyCoverage(equipment: EquipmentWarrantyFields | null | undefined): boolean {
  if (!equipment) return false;
  const amc = (equipment.amcStatus ?? "none").trim().toLowerCase();
  const machineCovered =
    !equipment.noMachineWarranty &&
    (hasDateValue(equipment.warrantyStart) || hasDateValue(equipment.warrantyEnd));
  const serviceCovered =
    !equipment.noServiceWarranty &&
    (hasDateValue(equipment.serviceWarrantyStart) || hasDateValue(equipment.serviceWarrantyEnd));
  return Boolean(machineCovered || serviceCovered || (amc && amc !== "none"));
}

/**
 * True when service warranty has been decided for billing:
 * either dates are set, or "no service warranty" was explicitly chosen.
 */
export function hasServiceWarrantyCoverage(equipment: EquipmentWarrantyFields | null | undefined): boolean {
  if (!equipment) return false;
  if (equipment.noServiceWarranty) return true;
  return hasDateValue(equipment.serviceWarrantyStart) || hasDateValue(equipment.serviceWarrantyEnd);
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
  noMachineWarranty?: boolean;
  serviceWarrantyStart?: string | Date | null;
  serviceWarrantyEnd?: string | Date | null;
  noServiceWarranty?: boolean;
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
  if (input.noMachineWarranty !== undefined) {
    data.noMachineWarranty = Boolean(input.noMachineWarranty);
    if (input.noMachineWarranty) {
      data.warrantyStart = null;
      data.warrantyEnd = null;
    }
  }
  if (input.serviceWarrantyStart !== undefined) {
    data.serviceWarrantyStart = parseOptionalWarrantyDate(input.serviceWarrantyStart) ?? null;
  }
  if (input.serviceWarrantyEnd !== undefined) {
    data.serviceWarrantyEnd = parseOptionalWarrantyDate(input.serviceWarrantyEnd) ?? null;
  }
  if (input.noServiceWarranty !== undefined) {
    data.noServiceWarranty = Boolean(input.noServiceWarranty);
    if (input.noServiceWarranty) {
      data.serviceWarrantyStart = null;
      data.serviceWarrantyEnd = null;
    }
  }
  if (input.amcStatus !== undefined && input.amcStatus !== null && input.amcStatus !== "") {
    data.amcStatus = input.amcStatus;
  }
  if (input.touchLastService) {
    data.lastServiceDate = new Date();
  }
  return data;
}
