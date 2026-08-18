export type InspectionSeverity = "low" | "medium" | "high" | "critical";

const SEVERITIES: InspectionSeverity[] = ["low", "medium", "high", "critical"];

export function normalizeSeverity(severity: string): InspectionSeverity {
  const key = severity.toLowerCase() as InspectionSeverity;
  return SEVERITIES.includes(key) ? key : "medium";
}

export function validateInspectionSubmission(input: {
  severity: string;
  findings: string;
  imageCount: number;
}) {
  return {
    ok: true as const,
    severity: normalizeSeverity(input.severity),
  };
}
