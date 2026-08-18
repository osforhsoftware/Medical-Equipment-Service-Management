/** Shared fixed select options that include an "Other" choice with free-text. */

export type FixedOption = { value: string; label: string };

export function formatFixedOption(
  options: readonly FixedOption[],
  value: string,
  otherText?: string | null,
) {
  if (value === "Other" && otherText?.trim()) return `Other — ${otherText.trim()}`;
  return options.find((o) => o.value === value)?.label ?? value;
}

export const CUSTOMER_TYPE_OPTIONS: FixedOption[] = [
  { value: "Hospital", label: "Hospital" },
  { value: "Clinic", label: "Clinic" },
  { value: "DiagnosticLab", label: "Diagnostic Lab" },
  { value: "Research", label: "Research" },
  { value: "Dental", label: "Dental" },
  { value: "Other", label: "Other" },
];

export const SERVICE_TYPE_OPTIONS: FixedOption[] = [
  { value: "Repair", label: "Repair" },
  { value: "Maintenance", label: "Maintenance" },
  { value: "Calibration", label: "Calibration" },
  { value: "Inspection", label: "Inspection" },
  { value: "Installation", label: "Installation" },
  { value: "Other", label: "Other" },
];

export const INVENTORY_CATEGORY_OPTIONS: FixedOption[] = [
  { value: "Modules", label: "Modules" },
  { value: "Sensors", label: "Sensors" },
  { value: "Consumables", label: "Consumables" },
  { value: "Boards", label: "Boards" },
  { value: "Tools", label: "Tools" },
  { value: "Other", label: "Other" },
];

export const PAYMENT_METHOD_OPTIONS: FixedOption[] = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "card", label: "Card" },
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
];
