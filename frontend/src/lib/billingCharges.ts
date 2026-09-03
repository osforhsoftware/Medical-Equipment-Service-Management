export const BILLING_CHARGE_GROUPS = [
  { key: "products", label: "Products", types: ["product", "part", "parts"] },
  { key: "equipment", label: "Equipment", types: ["equipment"] },
  { key: "machines", label: "Machines", types: ["machine"] },
  { key: "serviceCharges", label: "Service Charges", types: ["service", "labor", "labour"] },
  { key: "otherCharges", label: "Other Charges", types: ["other", "extra", "adjustment", "transport", "testing", "calibration"] },
] as const;

export type BillingChargeGroupKey = (typeof BILLING_CHARGE_GROUPS)[number]["key"];

export const BILLING_ADD_LINE_TYPES = [
  { value: "product", label: "Product" },
  { value: "part", label: "Part" },
  { value: "equipment", label: "Equipment" },
  { value: "machine", label: "Machine" },
  { value: "service", label: "Service" },
  { value: "labor", label: "Labor" },
  { value: "other", label: "Other Charge" },
] as const;

export function newBillingLine(type: string = "product") {
  return {
    type,
    description: "",
    quantity: 1,
    unitPrice: 0,
    taxRate: 0,
    discount: 0,
  };
}

export const ENGINEER_EXTRA_TYPES = [
  { value: "product", label: "Product" },
  { value: "equipment", label: "Equipment" },
  { value: "machine", label: "Machine" },
  { value: "other", label: "Other" },
] as const;

export type ChargeLine = {
  type?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxRate?: number;
  lineTotal?: number;
};

const emptyGroups = (): Record<BillingChargeGroupKey, number> => ({
  products: 0,
  equipment: 0,
  machines: 0,
  serviceCharges: 0,
  otherCharges: 0,
});

export function chargeGroupForType(type: string): { key: BillingChargeGroupKey; label: string } {
  const normalized = (type || "other").toLowerCase();
  for (const group of BILLING_CHARGE_GROUPS) {
    if ((group.types as readonly string[]).includes(normalized)) {
      return { key: group.key, label: group.label };
    }
  }
  return { key: "otherCharges", label: "Other Charges" };
}

export function billingLineTypeLabel(type: string) {
  return BILLING_ADD_LINE_TYPES.find((item) => item.value === type)?.label
    ?? ENGINEER_EXTRA_TYPES.find((item) => item.value === type)?.label
    ?? type.replace(/_/g, " ");
}

export function lineAmount(line: ChargeLine) {
  if (typeof line.lineTotal === "number" && Number.isFinite(line.lineTotal)) {
    return Math.max(0, line.lineTotal);
  }
  const net = Math.max(0, Number(line.quantity || 0) * Number(line.unitPrice || 0) - Number(line.discount || 0));
  return net + net * (Number(line.taxRate || 0) / 100);
}

export function summarizeChargeGroups(lines: ChargeLine[]) {
  const groups = emptyGroups();
  for (const line of lines) {
    groups[chargeGroupForType(line.type ?? "other").key] += lineAmount(line);
  }
  const total = BILLING_CHARGE_GROUPS.reduce((sum, group) => sum + groups[group.key], 0);
  return { groups, total };
}

export function extraLineTotal(extra: { quantity: unknown; unitPrice: unknown; taxRate?: unknown }) {
  const net = Number(extra.quantity ?? 0) * Number(extra.unitPrice ?? 0);
  return net + net * (Number(extra.taxRate ?? 0) / 100);
}

export function groupDocumentLines<T extends { type?: string }>(lines: T[]) {
  return BILLING_CHARGE_GROUPS.map((group) => ({
    ...group,
    lines: lines.filter((line) => chargeGroupForType(String(line.type ?? "other")).key === group.key),
  })).filter((group) => group.lines.length > 0);
}
