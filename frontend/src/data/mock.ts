import type { Role } from "./types";

export const roleLabels: Record<Role, string> = {
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
