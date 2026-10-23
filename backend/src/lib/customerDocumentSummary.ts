/**
 * Customer-copy amounts for an estimate or invoice.
 * Mirror of frontend/src/lib/customerDocumentSummary.ts.
 *
 * Work amount  = sum of non-service lines after line discount, before tax.
 * Service amount = sum of service and labor lines on the same basis.
 * Total        = grand total, including tax and any header discount.
 */
import { chargeGroupForType } from "@/utils/invoiceCharges";
import {
  calculateEstimateTotals,
  priceLine,
  roundMoney,
  type EstimatePricedLine,
} from "@/lib/estimateTotals";

export const DEFAULT_CUSTOMER_SUMMARY_LABEL = "Service";
export const SERVICE_CHARGE_LABEL = "Service Charge";

export type CustomerSummaryLine = EstimatePricedLine & {
  type?: string | null;
};

export function isCustomerServiceCharge(type: string | null | undefined) {
  return chargeGroupForType(String(type ?? "other")).key === "serviceCharges";
}

export function customerSummaryLabel(value: string | null | undefined) {
  const text = value?.trim() ?? "";
  return text || DEFAULT_CUSTOMER_SUMMARY_LABEL;
}

export function customerDocumentSummary(
  lines: CustomerSummaryLine[],
  options?: { label?: string | null; headerDiscount?: number },
) {
  let work = 0;
  let service = 0;
  let serviceLines = 0;
  for (const line of lines) {
    const taxable = priceLine(line).taxable;
    if (isCustomerServiceCharge(line.type)) {
      service += taxable;
      serviceLines += 1;
    } else {
      work += taxable;
    }
  }
  const totals = calculateEstimateTotals(lines, options?.headerDiscount ?? 0);
  return {
    label: customerSummaryLabel(options?.label),
    workAmount: roundMoney(work),
    serviceAmount: roundMoney(service),
    showServiceCharge: serviceLines > 0,
    total: totals.total,
  };
}
