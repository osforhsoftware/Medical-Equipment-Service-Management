import type { Role } from "@/data/types";

export const SALES_DESK_ROLES: Role[] = ["admin", "coordinator", "sales", "billing", "inventory"];
export const SALES_WRITE_ROLES: Role[] = ["admin", "coordinator", "sales"];
export const SALES_BILL_ROLES: Role[] = ["admin", "billing", "sales"];
export const ESTIMATE_READ_ROLES: Role[] = ["admin", "coordinator", "estimator", "billing", "inspector", "engineer"];
export const ESTIMATE_WRITE_ROLES: Role[] = ["admin", "coordinator", "estimator"];
export const SERVICE_BILLING_ROLES: Role[] = ["admin", "billing", "estimator"];
export const CUSTOMER_READ_ROLES: Role[] = ["admin", "coordinator", "estimator", "sales", "billing"];
export const CUSTOMER_WRITE_ROLES: Role[] = ["admin", "coordinator", "estimator", "sales"];
export const CATALOG_WRITE_ROLES: Role[] = ["admin", "coordinator"];
export const TICKET_CREATE_ROLES: Role[] = ["admin", "coordinator"];
export const JOB_CREATE_ROLES: Role[] = ["admin", "coordinator"];
export const INVENTORY_WRITE_ROLES: Role[] = ["admin", "inventory"];
