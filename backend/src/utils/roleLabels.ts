const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  coordinator: "Service Coordinator",
  inspector: "Inspection Technician",
  estimator: "Estimate Staff",
  engineer: "Service Engineer",
  inventory: "Inventory Manager",
  billing: "Billing Staff",
  customer: "Customer Portal",
};

export function getRoleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}
