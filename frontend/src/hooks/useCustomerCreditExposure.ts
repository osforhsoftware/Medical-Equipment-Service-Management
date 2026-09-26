import { useQuery } from "@tanstack/react-query";
import { api, type BackendCustomer } from "@/lib/api";

export interface CreditExposureResult {
  customer: BackendCustomer | null;
  creditLimit: number | null;
  outstandingBalance: number;
  availableCredit: number | null;
  isOverLimit: boolean;
  isNearLimit: boolean;
  exposurePercentage: number;
  isLoading: boolean;
}

export function useCustomerCreditExposure(customerId: string | undefined | null): CreditExposureResult {
  const customerQuery = useQuery({
    queryKey: ["customers", customerId],
    queryFn: () => api.getCustomer(customerId!),
    enabled: Boolean(customerId),
  });

  const customer = customerQuery.data ?? null;
  const creditLimit = customer?.creditLimit != null ? Number(customer.creditLimit) : null;
  const outstandingBalance =
    customer?.outstandingBalance != null ? Number(customer.outstandingBalance) : 0;

  let isOverLimit = false;
  let isNearLimit = false;
  let availableCredit: number | null = null;
  let exposurePercentage = 0;

  if (creditLimit != null && creditLimit > 0) {
    availableCredit = Math.max(0, creditLimit - outstandingBalance);
    exposurePercentage = Math.round((outstandingBalance / creditLimit) * 100);
    isOverLimit = outstandingBalance > creditLimit;
    isNearLimit = exposurePercentage >= 80 && !isOverLimit;
  }

  return {
    customer,
    creditLimit,
    outstandingBalance,
    availableCredit,
    isOverLimit,
    isNearLimit,
    exposurePercentage,
    isLoading: customerQuery.isLoading,
  };
}

export function creditBlocksSave(
  result: Pick<CreditExposureResult, "creditLimit" | "outstandingBalance">,
  currentTotal = 0,
) {
  if (result.creditLimit == null || result.creditLimit <= 0) return false;
  return result.outstandingBalance + Math.max(0, currentTotal) > result.creditLimit + 0.009;
}
