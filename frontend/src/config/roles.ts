import type { Role } from "@/data/types";

export const SALES_DESK_ROLES: Role[] = ["admin", "coordinator", "sales", "billing", "inventory"];
export const SALES_WRITE_ROLES: Role[] = ["admin", "coordinator", "sales"];
export const SALES_BILL_ROLES: Role[] = ["admin", "billing", "sales"];
export const ESTIMATE_READ_ROLES: Role[] = ["admin", "coordinator", "estimator", "billing", "inspector", "engineer"];
export const ESTIMATE_WRITE_ROLES: Role[] = ["admin", "coordinator", "estimator"];
export const SERVICE_BILLING_ROLES: Role[] = ["admin", "billing", "estimator"];
