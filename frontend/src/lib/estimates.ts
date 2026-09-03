import type { BackendEstimate, BackendEstimateLine, EstimateLineInput } from "@/lib/api";
import type { DocumentLine } from "@/components/shared/ProfessionalDocument";

export const ESTIMATE_STATUS_OPTIONS = [
  { label: "Draft", value: "draft" },
  { label: "Pending Approval", value: "pendingAdminApproval" },
  { label: "Sent", value: "sent" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "Revision Required", value: "revision" },
  { label: "Converted", value: "converted" },
] as const;

export const ESTIMATE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pendingAdminApproval: "Pending Approval",
  sent: "Sent",
  approved: "Approved",
  rejected: "Rejected",
  revision: "Revision Required",
  converted: "Converted",
};

export const ESTIMATE_LINE_TYPES = [
  { value: "labor", label: "Labor" },
  { value: "part", label: "Part" },
  { value: "service", label: "Service" },
  { value: "transport", label: "Transport" },
  { value: "testing", label: "Testing" },
  { value: "calibration", label: "Calibration" },
  { value: "other", label: "Other" },
] as const;

export const ESTIMATE_WORKFLOW_STEPS = [
  "Details",
  "Line Items",
  "Totals",
  "Review",
  "Approval",
] as const;

export function estimateStatusLabel(status: string) {
  return ESTIMATE_STATUS_LABELS[status] ?? status.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function isEstimatePendingDecision(status: string) {
  return status === "pendingAdminApproval" || status === "sent" || status === "revision";
}

export function canEditEstimate(status: string) {
  return status === "draft" || status === "revision" || status === "rejected";
}

export function lineNet(line: Pick<EstimateLineInput, "quantity" | "unitPrice" | "discount">) {
  return Math.max(0, line.quantity * line.unitPrice - (line.discount || 0));
}

export function lineTotal(line: Pick<EstimateLineInput, "quantity" | "unitPrice" | "discount" | "taxRate">) {
  const net = lineNet(line);
  return net + (net * (line.taxRate || 0)) / 100;
}

export function summarizeLines(lines: EstimateLineInput[], discount = 0) {
  const subtotal = lines.reduce((sum, line) => sum + lineNet(line), 0);
  const tax = lines.reduce((sum, line) => {
    const net = lineNet(line);
    return sum + (net * (line.taxRate || 0)) / 100;
  }, 0);
  const headerDiscount = Math.max(0, discount);
  return {
    subtotal,
    discount: headerDiscount,
    tax,
    total: Math.max(0, subtotal - headerDiscount) + tax,
  };
}

export function newEstimateLine(taxRate = 0, partial?: Partial<EstimateLineInput>): EstimateLineInput {
  return {
    type: "service",
    description: "",
    quantity: 1,
    unitPrice: 0,
    taxRate,
    discount: 0,
    ...partial,
  };
}

export function fallbackEstimateLines(estimate: BackendEstimate): DocumentLine[] {
  return [
    ...(Number(estimate.laborCost)
      ? [{ id: "labor", description: "Services and labor", quantity: 1, unitPrice: Number(estimate.laborCost), taxRate: 0 }]
      : []),
    ...(Number(estimate.partsCost)
      ? [{ id: "parts", description: "Products and parts", quantity: 1, unitPrice: Number(estimate.partsCost), taxRate: 0 }]
      : []),
  ];
}

export function estimateToDocumentLines(estimate: BackendEstimate): DocumentLine[] {
  if (estimate.lineItems?.length) {
    return estimate.lineItems.map((line) => mapEstimateLine(line));
  }
  return fallbackEstimateLines(estimate);
}

export function mapEstimateLine(line: BackendEstimateLine): DocumentLine {
  return {
    id: line.id,
    description: line.description,
    type: line.type,
    quantity: Number(line.quantity),
    unitPrice: Number(line.unitPrice),
    discount: Number(line.discount),
    taxRate: Number(line.taxRate),
  };
}

export function formatLineType(type: string) {
  return ESTIMATE_LINE_TYPES.find((item) => item.value === type)?.label
    ?? type.replace(/_/g, " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

export function workflowStepIndex(status?: string | null, hasLines = false, hasValidity = false) {
  if (!status || status === "draft" || status === "revision") {
    if (!hasValidity) return 0;
    if (!hasLines) return 1;
    return 2;
  }
  if (status === "pendingAdminApproval" || status === "sent") return 4;
  if (status === "approved" || status === "rejected") return 4;
  return 3;
}
