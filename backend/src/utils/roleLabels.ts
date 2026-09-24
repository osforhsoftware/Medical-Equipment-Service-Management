export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  coordinator: "Service Coordinator",
  inspector: "Inspection Technician",
  estimator: "Estimate Staff",
  sales: "Sales Staff",
  engineer: "Service Engineer",
  inventory: "Inventory Manager",
  billing: "Billing Staff",
  qa: "Quality Assurance",
  customer: "Customer Portal",
};

export function getRoleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}
