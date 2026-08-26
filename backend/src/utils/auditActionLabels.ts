const RESOURCE_LABELS: Record<string, string> = {
  customers: "customer",
  equipment: "equipment",
  "service-requests": "service ticket",
  "service-tickets": "service ticket",
  estimates: "estimate",
  jobs: "job",
  inventory: "inventory item",
  suppliers: "supplier",
  "purchase-orders": "purchase order",
  "purchase-returns": "purchase return",
  "stock-transfers": "stock transfer",
  amc: "AMC contract",
  billing: "billing record",
  invoices: "invoice",
  users: "user",
  settings: "settings",
  inspections: "inspection report",
  files: "file",
  notifications: "notification",
  "inspection-reports": "inspection report",
  "stock-purchase-requests": "stock purchase request",
  "office-assets": "office asset",
  roles: "role",
  "role-assignments": "role assignment",
  "service-catalog": "service catalog item",
  documents: "document",
  "qr-scans": "QR scan",
  finance: "finance record",
};

const LEGACY_ACTION_LABELS: Record<string, string> = {
  CREATE: "Created record",
  UPDATE: "Updated record",
  DELETE: "Deleted record",
  SEED: "Seeded system data",
  "ticket.reopen": "Reopened service ticket",
};

const SUB_PATH_LABELS: Record<string, string> = {
  assign: "Assigned service ticket",
  workflow: "Advanced ticket workflow",
  reopen: "Reopened service ticket",
  "approve-estimate": "Approved estimate",
  "reject-estimate": "Rejected estimate",
  "change-requests": "Submitted change request",
  decide: "Decided change request",
  "final-approval": "Approved final work",
  "reject-final-approval": "Rejected final approval",
  close: "Closed service ticket",
  photos: "Uploaded job photos",
  "parts-requests": "Requested job parts",
  signature: "Captured job signature",
  "deduct-stock": "Deducted stock for job",
  "status-counts": "Viewed status counts",
  timeline: "Viewed ticket timeline",
  activities: "Viewed job activities",
  read: "Marked notification as read",
  "read-all": "Marked all notifications as read",
  "demo-seed": "Seeded demo data",
  recommendations: "Added inspection recommendation",
  attachments: "Added inspection attachment",
  revisions: "Created estimate revision",
  decisions: "Recorded estimate decision",
  assignments: "Assigned job technician",
  "work-logs": "Added job work log",
  extras: "Added job extra charge",
  approve: "Approved job extra charge",
  action: "Updated stock reservation",
  convert: "Converted stock purchase request",
  dispatch: "Dispatched stock transfer",
  receive: "Received stock transfer",
  receipts: "Recorded purchase order receipt",
  "purchase-returns": "Posted purchase return",
  "from-job": "Created invoice from job",
  payments: "Recorded invoice payment",
  finish: "Finished service ticket",
  maintenance: "Logged office asset maintenance",
  expenses: "Recorded expense",
  referrals: "Recorded referral",
  commissions: "Updated commission",
  adjust: "Adjusted inventory stock",
};

const METHOD_VERBS: Record<string, Record<"create" | "update" | "delete", string>> = {
  POST: { create: "Created", update: "Submitted", delete: "Removed" },
  PUT: { create: "Created", update: "Updated", delete: "Removed" },
  PATCH: { create: "Created", update: "Updated", delete: "Removed" },
  DELETE: { create: "Created", update: "Updated", delete: "Deleted" },
};

const CUID_LIKE = /^[a-z0-9]{20,}$/i;

function isIdSegment(segment: string): boolean {
  return CUID_LIKE.test(segment) || /^[0-9a-f-]{36}$/i.test(segment);
}

function capitalize(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function getResourceLabel(resource: string): string {
  return RESOURCE_LABELS[resource] ?? resource.replace(/-/g, " ");
}

function parseApiPath(path: string): string[] {
  const normalized = path.split("?")[0];
  const segments = normalized.split("/").filter(Boolean);
  return segments[0] === "api" ? segments.slice(1) : segments;
}

export function formatAuditActionFromRequest(method: string, path: string): string {
  const parts = parseApiPath(path);
  if (parts.length === 0) return `${method} request`;

  const resource = parts[0];
  const resourceLabel = getResourceLabel(resource);
  const verbs = METHOD_VERBS[method] ?? METHOD_VERBS.POST;

  if (parts.length === 1) {
    if (method === "POST") return `Created ${resourceLabel}`;
    if (method === "DELETE") return `Deleted ${resourceLabel}`;
    return `${verbs.update} ${resourceLabel}`;
  }

  const tail = parts[parts.length - 1];
  const parent = parts[parts.length - 2];

  if (SUB_PATH_LABELS[tail]) {
    return SUB_PATH_LABELS[tail];
  }

  if (SUB_PATH_LABELS[parent]) {
    return SUB_PATH_LABELS[parent];
  }

  if (method === "DELETE" || (method === "POST" && isIdSegment(tail))) {
    return `Deleted ${resourceLabel}`;
  }

  if (method === "POST") {
    return `Created ${resourceLabel}`;
  }

  return `${verbs.update} ${resourceLabel}`;
}

export function formatAuditEntityFromPath(path: string): string {
  const parts = parseApiPath(path);
  if (parts.length === 0) return "System";

  const resource = capitalize(getResourceLabel(parts[0]));
  const detailSegment = parts.find((segment, index) => index > 0 && !isIdSegment(segment));
  if (detailSegment && SUB_PATH_LABELS[detailSegment]) {
    return `${resource} · ${SUB_PATH_LABELS[detailSegment]}`;
  }

  return resource;
}

export function formatAuditAction(action: string, entity?: string): string {
  const trimmed = action.trim();
  if (!trimmed) return "Unknown action";

  if (LEGACY_ACTION_LABELS[trimmed]) {
    return LEGACY_ACTION_LABELS[trimmed];
  }

  const apiMatch = trimmed.match(/^(POST|PUT|PATCH|DELETE)\s+(\S+)/);
  if (apiMatch) {
    return formatAuditActionFromRequest(apiMatch[1], apiMatch[2]);
  }

  if (entity && entity.includes(":")) {
    const [resource] = entity.split(":");
    const resourceLabel = capitalize(getResourceLabel(resource));
    if (trimmed === "CREATE") return `Created ${resourceLabel.toLowerCase()}`;
    if (trimmed === "UPDATE") return `Updated ${resourceLabel.toLowerCase()}`;
    if (trimmed === "DELETE") return `Deleted ${resourceLabel.toLowerCase()}`;
  }

  return trimmed;
}

export function formatAuditEntity(entity: string): string {
  if (!entity || entity === "unknown" || entity === "system") {
    return entity === "system" ? "System" : "—";
  }

  if (entity.includes(":")) {
    const [resource, detail] = entity.split(":");
    const resourceLabel = capitalize(getResourceLabel(resource.replace(/^api$/, "system")));
    if (!detail || detail === "demo-seed") {
      return detail === "demo-seed" ? "Demo data" : resourceLabel;
    }
    return `${resourceLabel} (${detail})`;
  }

  if (RESOURCE_LABELS[entity]) {
    return capitalize(getResourceLabel(entity));
  }

  return entity;
}

export function isLikelyUserId(value: string): boolean {
  if (!value || value.includes("@") || value.includes(" ")) return false;
  return CUID_LIKE.test(value);
}
