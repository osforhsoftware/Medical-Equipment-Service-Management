import { type Request } from "express";
import {
  buildPaginationMeta,
  parseOptionalFilter,
  parsePaginationQuery,
  parseSearchQuery,
  parseSortQuery,
  toOrderBy,
} from "@/utils/pagination";
import { success } from "@/utils/response";
import type { Response } from "express";

const EQUIPMENT_SORT_FIELDS = {
  name: "name",
  assetTag: "assetTag",
  customerName: "customerName",
  category: "category",
  condition: "condition",
  lastServiceDate: "lastServiceDate",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
} as const;

export function parseEquipmentListQuery(req: Request) {
  const { page, limit, skip } = parsePaginationQuery(req.query);
  const sort = parseSortQuery(req.query, EQUIPMENT_SORT_FIELDS, "name");
  return {
    page,
    limit,
    skip,
    take: limit,
    search: parseSearchQuery(req.query),
    customerId: parseOptionalFilter(req.query.customerId),
    condition: parseOptionalFilter(req.query.condition),
    category: parseOptionalFilter(req.query.category),
    orderBy: toOrderBy(sort),
  };
}

const CUSTOMER_SORT_FIELDS = {
  reference: "reference",
  name: "name",
  city: "city",
  status: "status",
  type: "type",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
} as const;

export function parseCustomerListQuery(req: Request) {
  const { page, limit, skip } = parsePaginationQuery(req.query);
  const sort = parseSortQuery(req.query, CUSTOMER_SORT_FIELDS, "name");
  return {
    page,
    limit,
    skip,
    take: limit,
    search: parseSearchQuery(req.query),
    status: parseOptionalFilter(req.query.status),
    type: parseOptionalFilter(req.query.type),
    orderBy: toOrderBy(sort),
  };
}

/** Send a standardized paginated list response. */
export function sendPaginatedList<T>(
  res: Response,
  message: string,
  data: T[],
  total: number,
  page: number,
  limit: number,
) {
  res.json(success(message, data, buildPaginationMeta(total, page, limit)));
}

const JOB_SORT_FIELDS = {
  reference: "reference",
  customerName: "customerName",
  equipmentName: "equipmentName",
  engineer: "engineer",
  scheduledFor: "scheduledFor",
  progress: "progress",
  status: "status",
  createdAt: "createdAt",
} as const;

export function parseJobListQuery(req: Request) {
  const { page, limit, skip } = parsePaginationQuery(req.query);
  const sort = parseSortQuery(req.query, JOB_SORT_FIELDS, "scheduledFor");
  return {
    page,
    limit,
    skip,
    take: limit,
    search: parseSearchQuery(req.query),
    status: parseOptionalFilter(req.query.status),
    priority: parseOptionalFilter(req.query.priority),
    assignee: parseOptionalFilter(req.query.assignee),
    orderBy: toOrderBy(sort),
  };
}

const SERVICE_REQUEST_SORT_FIELDS = {
  reference: "reference",
  customerName: "customerName",
  priority: "priority",
  status: "status",
  createdAt: "createdAt",
  slaDue: "slaDue",
} as const;

export function parseServiceRequestListQuery(req: Request) {
  const { page, limit, skip } = parsePaginationQuery(req.query);
  const sort = parseSortQuery(req.query, SERVICE_REQUEST_SORT_FIELDS, "createdAt", "desc");
  const overdue = req.query.overdue === "true" || req.query.overdue === "1";
  const statusesRaw = parseOptionalFilter(req.query.statuses);
  const statuses = statusesRaw ? statusesRaw.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
  return {
    page,
    limit,
    skip,
    take: limit,
    search: parseSearchQuery(req.query),
    status: parseOptionalFilter(req.query.status),
    statuses,
    priority: parseOptionalFilter(req.query.priority),
    assignee: parseOptionalFilter(req.query.assignee),
    overdue,
    orderBy: toOrderBy(sort),
  };
}

const ESTIMATE_SORT_FIELDS = {
  reference: "reference",
  customerName: "customerName",
  total: "total",
  validUntil: "validUntil",
  status: "status",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
} as const;

export function parseEstimateListQuery(req: Request) {
  const { page, limit, skip } = parsePaginationQuery(req.query);
  const sort = parseSortQuery(req.query, ESTIMATE_SORT_FIELDS, "createdAt", "desc");
  return {
    page,
    limit,
    skip,
    take: limit,
    search: parseSearchQuery(req.query),
    status: parseOptionalFilter(req.query.status),
    customerId: parseOptionalFilter(req.query.customerId),
    createdFrom: parseOptionalFilter(req.query.createdFrom),
    createdTo: parseOptionalFilter(req.query.createdTo),
    kind: parseOptionalFilter(req.query.kind) as "service" | "sales" | undefined,
    orderBy: toOrderBy(sort),
  };
}

const INVENTORY_SORT_FIELDS = {
  name: "name",
  sku: "sku",
  category: "category",
  inStock: "inStock",
  createdAt: "createdAt",
} as const;

export function parseInventoryListQuery(req: Request) {
  const { page, limit, skip } = parsePaginationQuery(req.query);
  const sort = parseSortQuery(req.query, INVENTORY_SORT_FIELDS, "name");
  return {
    page,
    limit,
    skip,
    take: limit,
    search: parseSearchQuery(req.query),
    category: parseOptionalFilter(req.query.category),
    stockStatus: parseOptionalFilter(req.query.stockStatus),
    supplierId: parseOptionalFilter(req.query.supplierId),
    orderBy: toOrderBy(sort),
  };
}

const SUPPLIER_SORT_FIELDS = {
  name: "name",
  email: "email",
  contact: "contact",
  category: "category",
  createdAt: "createdAt",
} as const;

export function parseSupplierListQuery(req: Request) {
  const { page, limit, skip } = parsePaginationQuery(req.query);
  const sort = parseSortQuery(req.query, SUPPLIER_SORT_FIELDS, "name");
  return {
    page,
    limit,
    skip,
    take: limit,
    search: parseSearchQuery(req.query),
    orderBy: toOrderBy(sort),
  };
}

const PURCHASE_ORDER_SORT_FIELDS = {
  reference: "reference",
  supplier: "supplier",
  status: "status",
  createdAt: "createdAt",
} as const;

export function parsePurchaseOrderListQuery(req: Request) {
  const { page, limit, skip } = parsePaginationQuery(req.query);
  const sort = parseSortQuery(req.query, PURCHASE_ORDER_SORT_FIELDS, "createdAt", "desc");
  return {
    page,
    limit,
    skip,
    take: limit,
    search: parseSearchQuery(req.query),
    status: parseOptionalFilter(req.query.status),
    orderBy: toOrderBy(sort),
  };
}
