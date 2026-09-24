import type { Role } from "@/data/types";

export const SALES_DESK_ROLES: Role[] = ["admin", "sales", "billing", "inventory"];
export const SALES_WRITE_ROLES: Role[] = ["admin", "sales"];
export const SALES_BILL_ROLES: Role[] = ["admin", "billing", "sales"];
export const ESTIMATE_READ_ROLES: Role[] = ["admin", "coordinator", "estimator", "billing"];
export const ESTIMATE_WRITE_ROLES: Role[] = ["admin", "coordinator", "estimator"];
export const SERVICE_BILLING_ROLES: Role[] = ["admin", "billing"];
export const CUSTOMER_READ_ROLES: Role[] = ["admin", "coordinator", "estimator", "sales", "billing"];
export const CUSTOMER_WRITE_ROLES: Role[] = ["admin", "coordinator", "estimator", "sales"];
export const CATALOG_WRITE_ROLES: Role[] = ["admin", "coordinator"];
export const TICKET_CREATE_ROLES: Role[] = ["admin", "coordinator"];
export const INSPECTION_READ_ROLES: Role[] = ["admin", "coordinator", "inspector", "estimator", "billing", "qa"];
export const INSPECTION_WRITE_ROLES: Role[] = ["admin", "coordinator", "inspector"];
export const JOB_CREATE_ROLES: Role[] = ["admin", "coordinator"];
/** Staff who can pass/fail job QA and confirm delivery (matches backend QA_APPROVER_ROLES). */
export const QA_APPROVER_ROLES: Role[] = ["admin", "coordinator", "qa"];
export const INVENTORY_WRITE_ROLES: Role[] = ["admin", "inventory"];
