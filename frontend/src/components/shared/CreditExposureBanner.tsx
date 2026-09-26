import React from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useCustomerCreditExposure } from "@/hooks/useCustomerCreditExposure";
import { formatCurrency } from "@/lib/format";

interface CreditExposureBannerProps {
  customerId: string | undefined | null;
  currentTotal?: number;
}

export function CreditExposureBanner({ customerId, currentTotal = 0 }: CreditExposureBannerProps) {
  const { customer, creditLimit, outstandingBalance, isOverLimit, isNearLimit } =
    useCustomerCreditExposure(customerId);

  if (!customerId || !customer || creditLimit == null || creditLimit <= 0) {
    return null;
  }

  const projectedExposure = outstandingBalance + currentTotal;
  const projectedOver = projectedExposure > creditLimit;

  if (!isOverLimit && !isNearLimit && !projectedOver) {
    return null;
  }

  return (
    <Alert variant={isOverLimit || projectedOver ? "destructive" : "default"} className="mb-4">
      {isOverLimit || projectedOver ? (
        <AlertTriangle className="h-4 w-4" />
      ) : (
        <ShieldAlert className="h-4 w-4 text-amber-600" />
      )}
      <AlertTitle className="font-semibold">
        {isOverLimit || projectedOver
          ? "Credit Limit Exceeded / High Exposure Alert"
          : "Customer Nearing Credit Limit"}
      </AlertTitle>
      <AlertDescription className="text-xs mt-1">
        Customer <span className="font-bold">{customer.name}</span> has a defined credit limit of{" "}
        <span className="font-bold tabular-nums">{formatCurrency(creditLimit)}</span>. Current
        outstanding balance is{" "}
        <span className="font-bold tabular-nums">{formatCurrency(outstandingBalance)}</span>.
        {currentTotal > 0 && (
          <>
            {" "}Projected total with this transaction:{" "}
            <span className="font-bold tabular-nums">{formatCurrency(projectedExposure)}</span>.
          </>
        )}
        {(isOverLimit || projectedOver) && (
          <p className="mt-1 font-semibold text-destructive">
            Save is blocked until outstanding invoices are paid or the credit limit is increased.
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}
