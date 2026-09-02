import type {
  AuditLogListParams,
  CustomerListParams,
  EquipmentListParams,
  EstimateListParams,
  InventoryListParams,
  JobListParams,
  PaginatedResult,
  PaginationMeta,
  PurchaseOrderListParams,
  ServiceRequestListParams,
} from "@/lib/listing";
import { buildListQuery, EMPTY_PAGINATION_META } from "@/lib/listing";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

const USER_KEY = "mesms.user";

export type { PaginatedResult, PaginationMeta };

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  meta?: PaginationMeta;
  errors?: string[];
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public errors?: string[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getStoredUser<T>(): T | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

export function setStoredUser<T>(user: T | null) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: HeadersInit = {
    ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers ?? {}),
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const json = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !json.success) {
    throw new ApiError(json.message || "Request failed", response.status, json.errors);
  }

  return json.data as T;
}

async function requestPaginated<T>(path: string, options: RequestInit = {}): Promise<PaginatedResult<T>> {
  const headers: HeadersInit = {
    ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers ?? {}),
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  const json = (await response.json()) as ApiResponse<T[]>;

  if (!response.ok || !json.success) {
    throw new ApiError(json.message || "Request failed", response.status, json.errors);
  }

  return {
    data: json.data ?? [],
    meta: json.meta ?? EMPTY_PAGINATION_META,
  };
}

export interface BackendUser {
  id: string;
  tenantId: string;
  name: string;
  username: string;
  email: string;
  role: string;
  roles?: string[];
  phone: string | null;
  isActive: boolean;
  branchId: string | null;
  avatarColor: string;
  customerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LoginResult {
  user: BackendUser;
}

export interface CreateUserInput {
  name: string;
  username: string;
  email: string;
  password: string;
  role: string;
  roles?: string[];
  primaryRole?: string;
  phone?: string;
  isActive?: boolean;
  branchId?: string;
}

export interface UpdateUserInput {
  name?: string;
  username?: string;
  email?: string;
  role?: string;
  roles?: string[];
  primaryRole?: string;
  phone?: string | null;
  isActive?: boolean;
  branchId?: string | null;
  password?: string;
}

export interface BackendBranch {
  id: string;
  tenantId: string;
  name: string;
  city: string;
  phone: string;
  createdAt: string;
  updatedAt: string;
}

export interface BackendCustomer {
  id: string;
  tenantId: string;
  reference: string;
  name: string;
  type: string;
  typeOther?: string | null;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  licenseGst?: string | null;
  note?: string | null;
  branchId: string;
  equipmentCount: number;
  activeJobs: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerInput {
  name: string;
  type?: string;
  typeOther?: string | null;
  contactPerson: string;
  email: string;
  phone?: string;
  address?: string;
  city: string;
  country: string;
  licenseGst?: string | null;
  note?: string | null;
  branchId?: string;
  status?: string;
}

export interface BackendEquipment {
  id: string;
  tenantId: string;
  assetTag: string;
  name: string;
  model: string;
  manufacturer: string;
  category: string;
  serialNumber: string;
  customerId: string;
  customerName: string;
  branchId: string;
  location: string;
  installDate: string;
  warrantyEnd: string;
  amcStatus: string;
  condition: string;
  lastServiceDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TaxonomyType =
  | "equipment_category"
  | "equipment_condition"
  | "customer_type"
  | "inventory_category"
  | "inventory_subcategory";

export interface BackendTaxonomyTerm {
  id: string;
  tenantId: string;
  type: TaxonomyType;
  name: string;
  slug: string;
  description: string | null;
  parentId?: string | null;
  sortOrder: number;
  isActive: boolean;
  isSystem: boolean;
  usageCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaxonomyInput {
  type: TaxonomyType;
  name: string;
  slug?: string | null;
  description?: string | null;
  parentId?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface UpdateTaxonomyInput {
  name?: string;
  slug?: string;
  description?: string | null;
  parentId?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface CreateEquipmentInput {
  assetTag: string;
  name: string;
  model: string;
  manufacturer: string;
  category: string;
  serialNumber: string;
  customerId: string;
  branchId?: string;
  location: string;
  installDate: string;
  warrantyEnd: string;
  amcStatus?: string;
  condition?: string;
  lastServiceDate?: string | null;
}

export interface BackendServiceRequestEquipment {
  id: string;
  serviceRequestId: string;
  equipmentId: string;
  equipmentName: string;
  assetTag: string;
}

export interface BackendInspectionRecommendation {
  id: string;
  inventoryItemId?: string | null;
  catalogItemId?: string | null;
  type: string;
  title: string;
  description: string;
  priority: string;
  quantity: string | number;
  estimatedCost: string | number;
  procurementStatus?: string | null;
}

export interface BackendInspectionReport {
  id: string;
  serviceRequestId: string;
  findings: string;
  recommendation: string;
  severity: string;
  machineCondition?: string | null;
  errorCodes?: unknown;
  checklist?: unknown;
  measurements?: unknown;
  calibrationStatus?: string | null;
  technicianRemarks?: string | null;
  reportedBy: string;
  reportedAt: string;
  submittedAt?: string | null;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
  recommendations?: BackendInspectionRecommendation[];
  attachments?: { id: string; fileId: string; caption?: string | null; kind: string; createdAt?: string; file?: { id: string; originalName: string } }[];
}

export interface BackendServiceRequest {
  id: string;
  tenantId: string;
  reference: string;
  customerId: string;
  customerName: string;
  equipmentId: string | null;
  equipmentName: string | null;
  branchId: string;
  type: string;
  typeOther?: string | null;
  priority: string;
  status: string;
  description: string;
  createdBy: string;
  assignedTo: string | null;
  assignedName: string | null;
  assignedInspectorId?: string | null;
  assignedEstimatorId?: string | null;
  assignedEngineerId?: string | null;
  assignedInspectorName?: string | null;
  assignedEstimatorName?: string | null;
  assignedEngineerName?: string | null;
  slaDue: string;
  createdAt: string;
  updatedAt: string;
  equipmentItems: BackendServiceRequestEquipment[];
  inspectionReport: BackendInspectionReport | null;
}

export interface BackendTimelineEvent {
  id: string;
  requestId: string;
  at: string;
  actor: string;
  action: string;
  note: string | null;
}

export interface CreateServiceRequestInput {
  customerId: string;
  equipmentId?: string;
  equipmentIds?: string[];
  type: string;
  typeOther?: string | null;
  priority: string;
  description: string;
  assignedTo?: string;
  assignedName?: string;
  slaDue?: string;
}

export interface UpdateServiceRequestInput {
  status?: string;
  priority?: string;
  assignedTo?: string | null;
  assignedName?: string | null;
  description?: string;
  timelineNote?: string;
}

export interface AssignServiceRequestInput {
  assignedTo: string;
  role?: string;
  note?: string;
}

export interface WorkflowServiceRequestInput {
  status: string;
  note: string;
}

export interface CreateInspectionInput {
  findings: string;
  recommendation: string;
  severity: string;
  attachmentFileIds?: string[];
  attachments?: { fileId: string; caption?: string }[];
  recommendedParts?: {
    inventoryItemId: string;
    quantity: number;
    title?: string;
    description?: string;
    priority?: "low" | "medium" | "high" | "critical";
  }[];
  submit?: boolean;
}

export interface InspectionPartResult {
  inventoryItemId: string;
  requestedQuantity: number;
  availableQuantity: number;
  procurementStatus: "available" | "pending_procurement";
  purchaseRequestId?: string;
  recommendationId: string;
}

export interface BackendSupplier {
  id: string;
  tenantId: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
  category: string;
  rating: string | number;
  openOrders: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupplierInput {
  name: string;
  contact: string;
  email: string;
  phone: string;
  category: string;
  rating?: number;
}

export interface BackendAmcContract {
  id: string;
  tenantId: string;
  reference: string;
  customerName: string;
  equipmentCount: number;
  startDate: string;
  endDate: string;
  value: string | number;
  visitsPerYear: number;
  visitsDone: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface BackendInvoice {
  id: string;
  tenantId: string;
  customerId?: string | null;
  serviceRequestId?: string | null;
  estimateId?: string | null;
  jobId?: string | null;
  reference: string;
  customerName: string;
  jobRef: string;
  amount: string | number;
  tax: string | number;
  total: string | number;
  paidTotal?: string | number;
  balanceDue?: string | number;
  currency?: string;
  status: string;
  issuedAt: string;
  dueAt: string;
  lineItems?: BackendInvoiceLine[];
  payments?: BackendInvoicePayment[];
  createdAt: string;
  updatedAt: string;
}

export interface BackendInvoiceLine {
  id: string;
  type: string;
  description: string;
  quantity: string | number;
  unitPrice: string | number;
  taxRate: string | number;
  discount: string | number;
  lineTotal: string | number;
}

export type InvoiceLineInput = {
  id?: string;
  type?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  discount?: number;
};

export interface BackendInvoicePayment {
  id: string;
  amount: string | number;
  method: string;
  reference?: string | null;
  note?: string | null;
  paidAt: string;
}

export type BillingQueueKey =
  | "readyForBilling"
  | "waitingVerification"
  | "invoiceDraft"
  | "waitingApproval"
  | "invoiceSent"
  | "pendingPayment"
  | "partialPayment"
  | "paid"
  | "overdue"
  | "closed";

export interface BillingQueueRow {
  queue: BillingQueueKey;
  id: string;
  jobId: string;
  invoiceId: string | null;
  priority: string;
  serviceRequestRef: string;
  serviceRequestId: string | null;
  jobNumber: string;
  customer: string;
  customerId: string | null;
  equipment: string;
  serialNumber: string | null;
  hospital: string;
  engineer: string;
  completionDate: string | null;
  verificationStatus: string;
  estimateAmount: number;
  actualPartsCost: number;
  labourCharges: number;
  invoiceStatus: string | null;
  invoiceRef: string | null;
  paymentStatus: string;
  total: number;
  balanceDue: number;
  paidTotal: number;
}

export interface BillingVerificationItem {
  key: string;
  label: string;
  passed: boolean;
}

export interface BillingJobContext {
  job: BackendServiceJob & {
    billingVerifiedAt?: string | null;
    billingVerifiedBy?: string | null;
    completedAt?: string | null;
    workLogs?: BackendJobWorkLog[];
    signature?: { customerName: string } | null;
    stockMovements?: { id: string; quantity: number; inventoryItem?: { name: string; unitCost: string | number } | null }[];
    extras?: BackendJobExtra[];
    invoices?: BackendInvoice[];
    estimate?: BackendEstimate & { lineItems?: BackendEstimateLine[] };
    serviceRequest?: BackendServiceRequest & {
      inspectionReport?: {
        findings?: string | null;
        diagnosis?: string | null;
        recommendations?: { description: string }[];
      } | null;
      timelineEvents?: BackendTimelineEvent[];
    } | null;
    equipment?: BackendEquipment | null;
  };
  verification: { allPassed: boolean; items: BillingVerificationItem[] };
  invoice: BackendInvoice | null;
  project: unknown;
  costs: {
    estimateAmount: number;
    partsCost: number;
    labourCharges: number;
    discount: number;
    products?: number;
    equipment?: number;
    machines?: number;
    serviceCharges?: number;
    otherCharges?: number;
    engineerExtras?: number;
    proposedTotal?: number;
  };
}

export interface BackendAuditLog {
  id: string;
  tenantId: string;
  actor: string;
  role: string;
  action: string;
  entity: string;
  ip: string;
  createdAt: string;
  updatedAt: string;
  actorName?: string;
  roleName?: string;
  actionLabel?: string;
  entityLabel?: string;
}

export interface BackendEstimate {
  id: string;
  tenantId: string;
  serviceRequestId?: string | null;
  customerId?: string | null;
  equipmentId?: string | null;
  reference: string;
  requestRef: string;
  customerName: string;
  equipmentName: string;
  laborCost: string | number;
  partsCost: string | number;
  subtotal?: string | number;
  discount?: string | number;
  tax?: string | number;
  total: string | number;
  status: string;
  validUntil: string;
  revision: number;
  terms?: string | null;
  notes?: string | null;
  sentAt?: string | null;
  approvedAt?: string | null;
  lineItems?: BackendEstimateLine[];
  revisions?: BackendEstimateRevision[];
  decisions?: BackendEstimateDecision[];
  createdAt: string;
  updatedAt: string;
}

export interface BackendEstimateLine {
  id: string;
  estimateId: string;
  type: string;
  description: string;
  catalogItemId?: string | null;
  inventoryItemId?: string | null;
  partNumber?: string | null;
  quantity: string | number;
  unitPrice: string | number;
  taxRate: string | number;
  discount: string | number;
  lineTotal: string | number;
}

export interface EstimateLineInput {
  type: "labor" | "part" | "transport" | "testing" | "calibration" | "service" | "other";
  description: string;
  catalogItemId?: string | null;
  inventoryItemId?: string | null;
  partNumber?: string | null;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount: number;
}

export interface BackendEstimateRevision {
  id: string;
  revision: number;
  subtotal: string | number;
  discount: string | number;
  tax: string | number;
  total: string | number;
  status: string;
  terms?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface BackendEstimateDecision {
  id: string;
  decision: string;
  note?: string | null;
  actorRole: string;
  createdAt: string;
}

export interface CreateEstimateInput {
  serviceRequestId?: string;
  customerId?: string;
  equipmentId?: string;
  laborCost: number;
  partsCost: number;
  validUntil: string;
  status?: string;
}

export interface UpdateEstimateInput {
  laborCost?: number;
  partsCost?: number;
  validUntil?: string;
  status?: string;
}

export interface BackendServiceJob {
  id: string;
  tenantId: string;
  serviceRequestId?: string | null;
  estimateId?: string | null;
  customerId?: string | null;
  equipmentId?: string | null;
  reference: string;
  requestRef: string;
  customerName: string;
  equipmentName: string;
  engineer: string;
  engineerId: string | null;
  type: string;
  typeOther?: string | null;
  status: string;
  scheduledFor: string;
  progress: number;
  assignments?: BackendJobAssignment[];
  workLogs?: BackendJobWorkLog[];
  extras?: BackendJobExtra[];
  photos?: BackendJobPhoto[];
  createdAt: string;
  updatedAt: string;
}

export interface BackendJobAssignment {
  id: string;
  userId: string;
  role: string;
  isLead: boolean;
  assignedAt: string;
  user?: Pick<BackendUser, "id" | "name" | "role">;
}

export interface BackendJobWorkLog {
  id: string;
  userId: string;
  startedAt: string;
  endedAt?: string | null;
  minutes: number;
  workPerformed: string;
  testingResult?: string | null;
  calibrationResult?: string | null;
  createdAt: string;
}

export interface BackendJobExtra {
  id: string;
  description: string;
  type?: string;
  reason: string;
  quantity: string | number;
  unitPrice: string | number;
  taxRate: string | number;
  status: string;
  inventoryItem?: { id: string; name: string; sku: string } | null;
  createdAt: string;
}

export interface CreateJobInput {
  serviceRequestId?: string;
  customerId?: string;
  equipmentId?: string;
  type?: string;
  typeOther?: string | null;
  engineerId: string;
  scheduledFor: string;
  status?: string;
  progress?: number;
}

export interface UpdateJobInput {
  engineerId?: string;
  scheduledFor?: string;
  status?: string;
  progress?: number;
}

export interface JobPhotoInput {
  filename?: string;
  mimeType?: string;
  dataUrl?: string;
  fileId?: string;
  caption?: string;
}

export interface BackendJobPhoto {
  id: string;
  filename: string;
  mimeType: string;
  fileId?: string | null;
  caption?: string | null;
  createdAt: string;
}

export interface BackendJobActivity {
  id: string;
  jobId: string;
  actor: string;
  action: string;
  note: string | null;
  createdAt: string;
}

export interface BackendInventoryItem {
  id: string;
  tenantId: string;
  sku: string;
  name: string;
  category: string;
  subcategory?: string | null;
  description?: string | null;
  branchId: string;
  inStock: number;
  reserved: number;
  /** Computed: inStock − reserved. Added in Phase 1; additive, non-breaking. */
  available?: number;
  reorderLevel: number;
  unitCost: string | number;
  sellingPrice?: string | number;
  deliveryCharge?: string | number;
  deliveryChargeType?: "flat" | "perUnit" | string;
  unitOfMeasure?: string;
  supplier: string;
  supplierId?: string | null;
  images?: { id: string; fileId: string; file?: { id: string; originalName: string; mimeType: string } }[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateInventoryInput {
  sku: string;
  name: string;
  category: string;
  subcategory: string;
  description?: string | null;
  branchId?: string;
  inStock?: number;
  reorderLevel?: number;
  unitCost?: number;
  sellingPrice?: number;
  deliveryCharge?: number;
  deliveryChargeType?: "flat" | "perUnit";
  unitOfMeasure?: string;
  supplier?: string;
  supplierId?: string | null;
  imageFileIds?: string[];
}

export interface BackendStockPurchaseRequest {
  id: string;
  tenantId: string;
  inventoryItemId: string;
  quantity: number;
  status: string;
  requestedBy: string;
  serviceRequestId?: string | null;
  jobId?: string | null;
  purchaseOrderId?: string | null;
  note?: string | null;
  inventoryItem?: BackendInventoryItem;
  createdAt: string;
  updatedAt: string;
}

export interface BackendPurchaseOrder {
  id: string;
  tenantId: string;
  supplierId?: string | null;
  branchId?: string | null;
  reference: string;
  supplier: string;
  items: number;
  total: string | number;
  status: string;
  expectedDate: string;
  lineItems?: BackendPurchaseOrderLine[];
  receipts?: BackendPurchaseReceipt[];
  purchaseReturns?: BackendPurchaseReturn[];
  createdAt: string;
  updatedAt: string;
}

export interface BackendPurchaseOrderLine {
  id: string;
  inventoryItemId?: string | null;
  sku: string;
  description: string;
  quantityOrdered: number;
  quantityReceived: number;
  quantityReturned?: number;
  unitCost: string | number;
  taxRate: string | number;
  lineTotal: string | number;
}

export interface BackendPurchaseReceipt {
  id: string;
  reference: string;
  receivedBy: string;
  receivedAt: string;
  notes?: string | null;
}

export interface BackendPurchaseReturnLine {
  id: string;
  purchaseOrderLineId: string;
  inventoryItemId: string;
  sku: string;
  description: string;
  quantity: number;
  unitCost: string | number;
}

export interface BackendPurchaseReturn {
  id: string;
  tenantId: string;
  purchaseOrderId: string;
  supplierId?: string | null;
  reference: string;
  reason?: string | null;
  notes?: string | null;
  status: string;
  returnedBy: string;
  returnedAt: string;
  items: number;
  total: string | number;
  lines?: BackendPurchaseReturnLine[];
  purchaseOrder?: { id: string; reference: string; supplier: string; status?: string };
  createdAt: string;
  updatedAt: string;
}

export interface BackendBranchOption {
  id: string;
  name: string;
  city?: string | null;
  phone?: string | null;
}

export interface BackendStockMovement {
  id: string;
  inventoryItemId: string;
  type: string;
  quantity: number;
  balanceAfter: number;
  referenceType?: string | null;
  referenceId?: string | null;
  reason?: string | null;
  createdAt: string;
  inventoryItem?: { sku: string; name: string };
}

export interface CreatePurchaseOrderInput {
  supplier: string;
  items: number;
  total: number;
  expectedDate: string;
  status?: string;
}

export interface BackendStockTransfer {
  id: string;
  tenantId: string;
  reference: string;
  fromBranch: string;
  toBranch: string;
  fromBranchId?: string | null;
  toBranchId?: string | null;
  items: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  lineItems?: Array<{
    id: string;
    sku: string;
    description: string;
    quantity: number;
    quantityReceived?: number;
  }>;
}

export interface CreateStockTransferInput {
  fromBranch: string;
  toBranch: string;
  items: number;
  status?: string;
}

export interface CreateDomainStockTransferInput {
  fromBranchId: string;
  toBranchId: string;
  lines: Array<{ inventoryItemId: string; quantity: number }>;
}

export interface BackendSettings {
  tenantId: string;
  companyName: string;
  supportEmail: string;
  logoFileId?: string | null;
  logoUrl?: string | null;
  defaultTaxRate: number;
  amcRenewalReminders: boolean;
  lowStockAlerts: boolean;
  autoReserveOnApproval: boolean;
  autoGenerateReport: boolean;
  autoAssignInspectorOnCreate: boolean;
  autoAssignCoordinatorAfterInspection: boolean;
  autoAssignEstimatorAfterInspection: boolean;
  autoAssignEngineerOnApproval: boolean;
  defaultCoordinatorUserId: string | null;
  defaultInspectorUserId: string | null;
  defaultEstimatorUserId: string | null;
  defaultEngineerUserId: string | null;
  rbacMatrix: Record<string, string[]>;
}

export interface UpdateSettingsInput {
  companyName?: string;
  supportEmail?: string;
  logoFileId?: string | null;
  defaultTaxRate?: number;
  amcRenewalReminders?: boolean;
  lowStockAlerts?: boolean;
  autoReserveOnApproval?: boolean;
  autoGenerateReport?: boolean;
  autoAssignInspectorOnCreate?: boolean;
  autoAssignCoordinatorAfterInspection?: boolean;
  autoAssignEstimatorAfterInspection?: boolean;
  autoAssignEngineerOnApproval?: boolean;
  defaultCoordinatorUserId?: string | null;
  defaultInspectorUserId?: string | null;
  defaultEstimatorUserId?: string | null;
  defaultEngineerUserId?: string | null;
  rbacMatrix?: Record<string, string[]>;
}

export interface DemoSeedCounts {
  branches: number;
  customers: number;
  equipment: number;
  serviceRequests: number;
  estimates: number;
  serviceJobs: number;
  inventory: number;
  suppliers: number;
  purchaseOrders: number;
  stockTransfers: number;
  invoices: number;
  auditLogs: number;
  users: number;
}

export interface DemoSeedStatus {
  seeded: boolean;
  modules: string[];
  counts: DemoSeedCounts;
}

export interface DashboardTrend {
  value: string;
  up: boolean;
}

export interface DashboardQueueItem {
  id: string;
  kind: "request" | "job" | "estimate" | "invoice" | "purchaseOrder" | "transfer" | "parts";
  reference: string;
  title: string;
  subtitle: string;
  status: string;
  priority?: string;
  dueAt?: string | null;
  progress?: number;
  href: string;
}

export interface DashboardScheduleItem {
  id: string;
  reference: string;
  title: string;
  subtitle: string;
  status: string;
  scheduledFor: string;
  progress: number;
  href: string;
}

export interface SalesDeskData {
  process: { key: string; label: string; hint: string }[];
  kpis: {
    activeCustomers: number;
    openQuotes: number;
    pendingApproval: number;
    quoteValue: number;
    outstanding: number;
    collected: number;
    overdueInvoices: number;
    openInvoices: number;
    todaySales: number;
    monthlySales: number;
    totalOrders: number;
    pendingOrders: number;
    pendingPayments: number;
    pendingPaymentAmount: number;
  };
  quotesByStatus: Record<string, { count: number; total: number }>;
  recentQuotes: {
    id: string;
    reference: string;
    customerName: string;
    status: string;
    total: number;
    validUntil: string;
    updatedAt: string;
    serviceRequestId: string | null;
    kind: "service" | "sales";
  }[];
  outstandingInvoices: {
    id: string;
    reference: string;
    customerName: string;
    status: string;
    total: number;
    balanceDue: number;
    dueAt: string;
  }[];
  topSellingProducts: { name: string; quantity: number; amount: number }[];
  lowStockProducts: {
    id: string;
    sku: string;
    name: string;
    category: string;
    inStock: number;
    reserved: number;
    reorderLevel: number;
    available: number;
  }[];
}

export interface BackendSalesOrderLine {
  id: string;
  type: string;
  description: string;
  sku?: string | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  lineTotal: number;
  inventoryItemId?: string | null;
}

export interface BackendSalesOrder {
  id: string;
  estimateId?: string | null;
  customerId: string;
  reference: string;
  customerName: string;
  salespersonName: string;
  status: string;
  deliveryStatus: string;
  paymentStatus: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paidTotal?: number;
  balanceDue?: number;
  notes?: string | null;
  orderedAt: string;
  deliveredAt?: string | null;
  lines: BackendSalesOrderLine[];
  invoices: { id: string; reference: string; status: string; total: number; paidTotal: number; balanceDue: number }[];
  estimate?: { id: string; reference: string; status: string } | null;
}

export interface SalesReportsData {
  dailySales: number;
  monthlySales: number;
  productWise: { name: string; quantity: number; amount: number }[];
  sparePartsSales: { name: string; quantity: number; amount: number }[];
  equipmentSales: { name: string; quantity: number; amount: number }[];
  salespersonWise: { name: string; quantity: number; amount: number }[];
  customerWise: { name: string; quantity: number; amount: number }[];
  outstanding: { id: string; customerName: string; total: number; paidTotal: number; balanceDue: number; status: string }[];
  topSelling: { name: string; quantity: number; amount: number }[];
}

export interface DashboardData {
  role: string;
  stats: {
    openRequests: number;
    activeJobs: number;
    lowStockItems: number;
    revenueMtd: number;
    revenueMtdLabel: string;
    expiringAmc: number;
    unassignedRequests: number;
    pendingEstimates: number;
    pendingInvoices: number;
    overdueInvoices: number;
    openPurchaseOrders: number;
    pendingTransfers: number;
    pendingPartsRequests: number;
    unreadNotifications: number;
  };
  personal: {
    assignedOpen: number;
    dueToday: number;
    overdue: number;
    inProgress: number;
    completedThisMonth: number;
    pendingApprovals: number;
  };
  roleQueues: {
    newAssigned: number;
    inspection: number;
    estimatePending: number;
    waitingApproval: number;
    servicePending: number;
    completed: number;
  };
  myQueue: DashboardQueueItem[];
  todaySchedule: DashboardScheduleItem[];
  upcomingJobs: DashboardScheduleItem[];
  trends: {
    openRequests?: DashboardTrend;
    activeJobs?: DashboardTrend;
    revenue?: DashboardTrend;
  };
  revenueTrend: { month: string; revenue: number; jobs: number }[];
  jobsByType: { type: string; count: number }[];
  activeJobs: {
    id: string;
    reference: string;
    equipmentName: string;
    customerName: string;
    engineer: string;
    status: string;
    progress: number;
    scheduledFor?: string;
  }[];
  recentActivity: { id: string; action: string; actor: string; at: string }[];
  lowStock: { id: string; name: string; inStock: number; reorderLevel: number }[];
  visibility: {
    showFinance: boolean;
    showCompanyOps: boolean;
    showInventoryAlerts: boolean;
    showCharts: boolean;
    showSchedule: boolean;
    canUpdateJobStatus: boolean;
  };
}

export interface BackendNotification {
  id: string;
  tenantId: string;
  type: "amc" | "stock" | "approval" | "job" | "system";
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BackendStoredFile {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface BackendCatalogItem {
  id: string;
  branchId?: string | null;
  code: string;
  name: string;
  description?: string | null;
  category: string;
  unit: string;
  unitPrice: string | number;
  taxRate: string | number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CatalogItemInput = Omit<BackendCatalogItem, "id" | "createdAt" | "updatedAt">;

export interface BackendEquipmentHistory {
  equipment: BackendEquipment;
  requests: BackendServiceRequest[];
  jobs: BackendServiceJob[];
  invoices: BackendInvoice[];
  scans: { id: string; source: string; scannedAt: string }[];
}

export interface BackendOfficeAsset {
  id: string;
  branchId?: string | null;
  assetTag: string;
  name: string;
  category: string;
  serialNumber?: string | null;
  purchaseDate?: string | null;
  purchaseCost: string | number;
  status: string;
  assignedTo?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface OfficeAssetInput {
  branchId?: string | null;
  assetTag: string;
  name: string;
  category: string;
  serialNumber?: string | null;
  purchaseDate?: string | null;
  purchaseCost: number;
  assignedTo?: string | null;
  notes?: string | null;
}

export interface BackendExpense {
  id: string;
  branchId?: string | null;
  projectRef?: string | null;
  jobId?: string | null;
  category: string;
  description: string;
  amount: string | number;
  incurredAt: string;
  vendor?: string | null;
  createdAt: string;
}

export interface BackendReferral {
  id: string;
  customerId?: string | null;
  referrerName: string;
  referrerType: string;
  source?: string | null;
  status: string;
  commissions?: BackendCommission[];
  createdAt: string;
}

export interface BackendCommission {
  id: string;
  referralId?: string | null;
  invoiceId?: string | null;
  payeeName: string;
  basisAmount: string | number;
  rate: string | number;
  amount: string | number;
  status: string;
  paidAt?: string | null;
  createdAt: string;
}

export interface BackendDomainRole {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  permissions: Record<string, unknown>;
  isSystem: boolean;
  assignments?: { id: string; userId: string; branchId?: string | null }[];
}

function queryString(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value && value !== "all") search.set(key, value);
  });
  const q = search.toString();
  return q ? `?${q}` : "";
}

export const api = {
  login: (username: string, password: string) =>
    request<LoginResult>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  logout: () =>
    request<void>("/api/auth/logout", {
      method: "POST",
    }),

  me: () => request<BackendUser>("/api/auth/me"),

  forgotPassword: (email: string) =>
    request<{ resetToken?: string } | null>("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, password: string) =>
    request<null>("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),

  uploadFile: (file: File) => {
    const data = new FormData();
    data.append("file", file);
    return request<BackendStoredFile>("/api/files", { method: "POST", body: data });
  },

  fileDownloadUrl: (id: string) => `${API_BASE}/api/files/${id}/download`,

  listUsers: (params?: { role?: string; isActive?: boolean }) =>
    request<BackendUser[]>(`/api/users${queryString({ role: params?.role, isActive: params?.isActive?.toString() })}`),

  createUser: (data: CreateUserInput) =>
    request<BackendUser>("/api/users", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateUser: (id: string, data: UpdateUserInput) =>
    request<BackendUser>(`/api/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteUser: (id: string) =>
    request<void>(`/api/users/${id}`, {
      method: "DELETE",
    }),

  listCustomers: (params?: CustomerListParams) =>
    requestPaginated<BackendCustomer>(`/api/customers${buildListQuery(params)}`),

  /** Compact customer list for dropdowns (capped server-side). */
  listCustomersOptions: () =>
    requestPaginated<BackendCustomer>("/api/customers?limit=100&page=1").then((r) => r.data),

  getCustomer: (id: string) =>
    request<BackendCustomer>(`/api/customers/${id}`),

  previewCustomerReference: () =>
    request<{ reference: string }>("/api/customers/next-reference"),

  createCustomer: (data: CreateCustomerInput) =>
    request<BackendCustomer>("/api/customers", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listEquipment: (params?: EquipmentListParams) =>
    requestPaginated<BackendEquipment>(`/api/equipment${buildListQuery(params)}`),

  /** Compact equipment list for dropdowns (capped server-side). */
  listEquipmentOptions: (params?: { customerId?: string }) =>
    requestPaginated<BackendEquipment>(
      `/api/equipment${buildListQuery({ ...params, limit: 100, page: 1 })}`,
    ).then((r) => r.data),

  getEquipment: (id: string) =>
    request<BackendEquipment>(`/api/equipment/${id}`),

  getEquipmentByTag: (assetTag: string) =>
    request<BackendEquipment>(`/api/equipment/by-tag/${encodeURIComponent(assetTag)}`),

  createEquipment: (data: CreateEquipmentInput) =>
    request<BackendEquipment>("/api/equipment", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateEquipment: (id: string, data: CreateEquipmentInput) =>
    request<BackendEquipment>(`/api/equipment/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  listTaxonomy: (params: { type: TaxonomyType; activeOnly?: boolean }) =>
    request<BackendTaxonomyTerm[]>(
      `/api/taxonomy${queryString({
        type: params.type,
        activeOnly: params.activeOnly ? "true" : undefined,
      })}`,
    ),

  createTaxonomy: (data: CreateTaxonomyInput) =>
    request<BackendTaxonomyTerm>("/api/taxonomy", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateTaxonomy: (id: string, data: UpdateTaxonomyInput) =>
    request<BackendTaxonomyTerm>(`/api/taxonomy/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteTaxonomy: (id: string) =>
    request<{ deactivated: boolean; usageCount: number } | void>(`/api/taxonomy/${id}`, {
      method: "DELETE",
    }),

  listServiceRequests: (params?: ServiceRequestListParams) =>
    requestPaginated<BackendServiceRequest>(`/api/service-requests${buildListQuery(params)}`),

  getServiceRequestStatusCounts: (params?: { statuses?: string; overdue?: boolean; search?: string; priority?: string; assignee?: string }) =>
    request<Record<string, number>>(
      `/api/service-requests/status-counts${buildListQuery(params)}`,
    ),

  getServiceRequest: (id: string) =>
    request<BackendServiceRequest>(`/api/service-requests/${id}`),

  getServiceRequestTimeline: (id: string) =>
    request<BackendTimelineEvent[]>(`/api/service-requests/${id}/timeline`),

  createServiceRequest: (data: CreateServiceRequestInput) =>
    request<BackendServiceRequest>("/api/service-requests", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateServiceRequest: (id: string, data: UpdateServiceRequestInput) =>
    request<BackendServiceRequest>(`/api/service-requests/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  assignServiceRequest: (id: string, data: AssignServiceRequestInput) =>
    request<BackendServiceRequest>(`/api/service-requests/${id}/assign`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  advanceWorkflow: (id: string, data: WorkflowServiceRequestInput) =>
    request<BackendServiceRequest>(`/api/service-requests/${id}/workflow`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  approveTicketEstimate: (
    id: string,
    data: { estimateId: string; engineerId: string; scheduledFor?: string; note?: string },
  ) =>
    request<BackendServiceRequest>(`/api/service-requests/${id}/approve-estimate`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  rejectTicketEstimate: (
    id: string,
    data: { estimateId: string; reason: string; target: "estimate" | "inspection" },
  ) =>
    request<BackendServiceRequest>(`/api/service-requests/${id}/reject-estimate`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  submitTicketChangeRequest: (
    id: string,
    data: { description: string; items?: Record<string, unknown>[]; jobId?: string },
  ) =>
    request<{ id: string }>(`/api/service-requests/${id}/change-requests`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  decideTicketChangeRequest: (
    id: string,
    changeRequestId: string,
    data: { approved: boolean; note?: string },
  ) =>
    request<BackendServiceRequest>(`/api/service-requests/${id}/change-requests/${changeRequestId}/decide`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  grantTicketFinalApproval: (
    id: string,
    data?: { note?: string; currency?: string; dueAt?: string },
  ) =>
    request<BackendServiceRequest>(`/api/service-requests/${id}/final-approval`, {
      method: "POST",
      body: JSON.stringify(data ?? {}),
    }),

  rejectTicketFinalApproval: (id: string, data: { reason: string }) =>
    request<BackendServiceRequest>(`/api/service-requests/${id}/reject-final-approval`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  closeServiceTicket: (id: string, data?: { note?: string }) =>
    request<BackendServiceRequest>(`/api/service-requests/${id}/close`, {
      method: "POST",
      body: JSON.stringify(data ?? {}),
    }),

  getInspectionReport: (requestId: string) =>
    request<BackendInspectionReport | null>(`/api/inspections/${requestId}`),

  saveInspectionReport: (requestId: string, data: CreateInspectionInput) =>
    request<BackendInspectionReport & { partResults?: InspectionPartResult[] }>(`/api/inspections/${requestId}`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  addInspectionRecommendation: (
    reportId: string,
    data: {
      title: string;
      description: string;
      priority: "low" | "medium" | "high" | "critical";
      type?: "service" | "part" | "labor" | "testing" | "calibration" | "transport" | "other";
      inventoryItemId?: string | null;
      catalogItemId?: string | null;
      quantity?: number;
      estimatedCost?: number;
    },
  ) =>
    request<{ id: string }>(`/api/domain/inspection-reports/${reportId}/recommendations`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  attachInspectionFile: (
    reportId: string,
    data: { fileId: string; caption?: string; kind: "evidence" | "image" | "video" | "report" | "signature" },
  ) =>
    request<{ id: string }>(`/api/domain/inspection-reports/${reportId}/attachments`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listEstimates: (params?: EstimateListParams) =>
    requestPaginated<BackendEstimate>(`/api/estimates${buildListQuery(params)}`),

  getEstimate: (id: string) => request<BackendEstimate>(`/api/estimates/${id}`),

  createEstimate: (data: CreateEstimateInput) =>
    request<BackendEstimate>("/api/estimates", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateEstimate: (id: string, data: UpdateEstimateInput) =>
    request<BackendEstimate>(`/api/estimates/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  listJobs: (params?: JobListParams) =>
    requestPaginated<BackendServiceJob>(`/api/jobs${buildListQuery(params)}`),

  getJob: (id: string) => request<BackendServiceJob>(`/api/jobs/${id}`),

  createJob: (data: CreateJobInput) =>
    request<BackendServiceJob>("/api/jobs", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateJob: (id: string, data: UpdateJobInput) =>
    request<BackendServiceJob>(`/api/jobs/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  uploadJobPhotos: (id: string, photos: JobPhotoInput[]) =>
    request<{ job: BackendServiceJob }>(`/api/jobs/${id}/photos`, {
      method: "POST",
      body: JSON.stringify({ photos }),
    }),

  requestJobParts: (id: string, notes: string) =>
    request<{ job: BackendServiceJob }>(`/api/jobs/${id}/parts-requests`, {
      method: "POST",
      body: JSON.stringify({ notes }),
    }),

  captureJobSignature: (id: string, data: { customerName: string; signatureData?: string }) =>
    request<{ job: BackendServiceJob }>(`/api/jobs/${id}/signature`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deductJobStock: (id: string, data: { inventoryItemId: string; quantity: number }) =>
    request<{ job: BackendServiceJob }>(`/api/jobs/${id}/deduct-stock`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getJobActivities: (id: string) =>
    request<BackendJobActivity[]>(`/api/jobs/${id}/activities`),

  listInventory: (params?: InventoryListParams) =>
    requestPaginated<BackendInventoryItem>(`/api/inventory${buildListQuery(params)}`),

  getInventoryItem: (id: string) =>
    request<BackendInventoryItem>(`/api/inventory/${id}`),

  updateInventoryItem: (id: string, data: Partial<CreateInventoryInput>) =>
    request<BackendInventoryItem>(`/api/inventory/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  createInventoryItem: (data: CreateInventoryInput) =>
    request<BackendInventoryItem>("/api/inventory", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  adjustInventoryStock: (id: string, quantityDelta: number, reason: string) =>
    request<BackendInventoryItem>(`/api/inventory/${id}/adjust`, {
      method: "POST",
      body: JSON.stringify({ quantityDelta, reason }),
    }),

  listStockPurchaseRequests: (status?: string) =>
    request<BackendStockPurchaseRequest[]>(`/api/domain/stock-purchase-requests${queryString({ status })}`),

  getStockPurchaseRequest: async (id: string) => {
    const rows = await request<BackendStockPurchaseRequest[]>(`/api/domain/stock-purchase-requests`);
    const found = rows.find((row) => row.id === id);
    if (!found) {
      throw new ApiError("Stock purchase request not found", 404);
    }
    return found;
  },

  createStockPurchaseRequest: (data: {
    inventoryItemId: string;
    quantity: number;
    serviceRequestId?: string | null;
    jobId?: string | null;
    note?: string;
    force?: boolean;
  }) =>
    request<BackendStockPurchaseRequest>("/api/domain/stock-purchase-requests", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  convertStockPurchaseRequest: (id: string, data: { expectedDate: string; unitCost?: number }) =>
    request<{ request: BackendStockPurchaseRequest; purchaseOrder: BackendPurchaseOrder }>(
      `/api/domain/stock-purchase-requests/${id}/convert`,
      { method: "POST", body: JSON.stringify(data) },
    ),

  finishServiceTicket: (id: string) =>
    request<BackendServiceRequest>(`/api/domain/service-tickets/${id}/finish`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  generateDocument: (kind: "estimate" | "invoice" | "service-report" | "inspection-report", id: string) =>
    request<{ document: { id: string; fileId: string }; file: { id: string }; downloadUrl: string; reference: string }>(
      `/api/domain/documents/${kind}/${id}`,
      { method: "POST", body: JSON.stringify({}) },
    ),

  listPurchaseOrders: (params?: PurchaseOrderListParams) =>
    requestPaginated<BackendPurchaseOrder>(`/api/purchase-orders${buildListQuery(params)}`),

  getPurchaseOrder: (id: string) =>
    request<BackendPurchaseOrder>(`/api/purchase-orders/${id}`),

  createPurchaseOrder: (data: CreatePurchaseOrderInput) =>
    request<BackendPurchaseOrder>("/api/purchase-orders", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listStockTransfers: () => request<BackendStockTransfer[]>("/api/stock-transfers"),

  createStockTransfer: (data: CreateStockTransferInput) =>
    request<BackendStockTransfer>("/api/stock-transfers", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listDomainStockTransfers: () =>
    request<BackendStockTransfer[]>("/api/domain/stock-transfers"),

  createDomainStockTransfer: (data: CreateDomainStockTransferInput) =>
    request<BackendStockTransfer>("/api/domain/stock-transfers", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  dispatchStockTransfer: (id: string) =>
    request<BackendStockTransfer>(`/api/domain/stock-transfers/${id}/dispatch`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  receiveStockTransfer: (id: string) =>
    request<BackendStockTransfer>(`/api/domain/stock-transfers/${id}/receive`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  getStockTransfer: (id: string) =>
    request<BackendStockTransfer>(`/api/domain/stock-transfers/${id}`),

  listBranches: () => request<BackendBranchOption[]>("/api/domain/branches"),

  listPurchaseReturns: () => request<BackendPurchaseReturn[]>("/api/domain/purchase-returns"),

  getPurchaseReturn: (id: string) =>
    request<BackendPurchaseReturn>(`/api/domain/purchase-returns/${id}`),

  createPurchaseReturn: (data: {
    purchaseOrderId: string;
    reason: "damaged" | "excess" | "wrong_item" | "quality" | "other";
    notes?: string;
    lines: { purchaseOrderLineId: string; quantity: number }[];
  }) =>
    request<BackendPurchaseReturn>("/api/domain/purchase-returns", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listStockMovements: (inventoryItemId?: string) =>
    request<BackendStockMovement[]>(
      `/api/domain/stock/movements${queryString({ inventoryItemId })}`,
    ),

  getSettings: () => request<BackendSettings>("/api/settings"),

  getDashboard: () =>
    request<DashboardData>("/api/dashboard"),

  getSalesDesk: () => request<SalesDeskData>("/api/sales/desk"),
  listSalesOrders: () => request<BackendSalesOrder[]>("/api/sales/orders"),
  getSalesOrder: (id: string) => request<BackendSalesOrder>(`/api/sales/orders/${id}`),
  createSalesOrder: (data: {
    customerId: string;
    notes?: string | null;
    lines: Array<{
      inventoryItemId?: string | null;
      catalogItemId?: string | null;
      type?: string;
      description: string;
      sku?: string | null;
      quantity: number;
      unitPrice: number;
      discount?: number;
      taxRate?: number;
    }>;
  }) =>
    request<BackendSalesOrder>("/api/sales/orders", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateSalesOrder: (
    id: string,
    data: {
      customerId: string;
      notes?: string | null;
      lines: Array<{
        inventoryItemId?: string | null;
        catalogItemId?: string | null;
        type?: string;
        description: string;
        sku?: string | null;
        quantity: number;
        unitPrice: number;
        discount?: number;
        taxRate?: number;
      }>;
    },
  ) =>
    request<BackendSalesOrder>(`/api/sales/orders/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  convertSalesQuote: (estimateId: string, data?: { commissionRate?: number; notes?: string }) =>
    request<BackendSalesOrder>(`/api/sales/quotes/${estimateId}/convert`, {
      method: "POST",
      body: JSON.stringify(data ?? {}),
    }),
  deliverSalesOrder: (id: string) =>
    request<BackendSalesOrder>(`/api/sales/orders/${id}/deliver`, { method: "POST", body: JSON.stringify({}) }),
  invoiceSalesOrder: (id: string, data?: { dueAt?: string; commissionRate?: number }) =>
    request<BackendInvoice>(`/api/sales/orders/${id}/invoice`, {
      method: "POST",
      body: JSON.stringify(data ?? {}),
    }),
  getSalesReports: () => request<SalesReportsData>("/api/sales/reports"),

  listNotifications: () => request<BackendNotification[]>("/api/notifications"),

  getNotificationsUnreadCount: () =>
    request<{ count: number }>("/api/notifications/unread-count"),

  markNotificationRead: (id: string) =>
    request<void>(`/api/notifications/${id}/read`, { method: "PUT" }),

  markAllNotificationsRead: () =>
    request<void>("/api/notifications/read-all", { method: "PUT" }),

  updateSettings: (data: UpdateSettingsInput) =>
    request<BackendSettings>("/api/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  getDemoSeedStatus: () => request<DemoSeedStatus>("/api/settings/demo-seed"),

  seedDemoData: () =>
    request<DemoSeedStatus>("/api/settings/demo-seed", { method: "POST" }),

  removeDemoData: () =>
    request<DemoSeedStatus>("/api/settings/demo-seed", { method: "DELETE" }),

  listSuppliers: (params?: { page?: number; limit?: number; search?: string }) =>
    requestPaginated<BackendSupplier>(`/api/suppliers${buildListQuery(params)}`),

  createSupplier: (data: CreateSupplierInput) =>
    request<BackendSupplier>("/api/suppliers", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateSupplier: (id: string, data: Partial<CreateSupplierInput>) =>
    request<BackendSupplier>(`/api/suppliers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteSupplier: (id: string) =>
    request<void>(`/api/suppliers/${id}`, { method: "DELETE" }),

  listAmcContracts: (status?: string) =>
    request<BackendAmcContract[]>(`/api/amc${queryString({ status })}`),

  createAmcContract: (data: Record<string, unknown>) =>
    request<BackendAmcContract>("/api/amc", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateAmcContract: (id: string, data: Record<string, unknown>) =>
    request<BackendAmcContract>(`/api/amc/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  listInvoices: (status?: string) =>
    request<BackendInvoice[]>(`/api/billing${queryString({ status })}`),

  getBillingQueue: (queue?: BillingQueueKey) =>
    request<{ counts: Record<BillingQueueKey, number>; items: BillingQueueRow[] }>(
      `/api/billing/queue${queryString({ queue })}`,
    ),

  getBillingJobContext: (jobId: string) =>
    request<BillingJobContext>(`/api/billing/jobs/${jobId}/context`),

  verifyBillingJob: (jobId: string) =>
    request<{ id: string }>(`/api/billing/jobs/${jobId}/verify`, { method: "POST" }),

  submitInvoiceApproval: (invoiceId: string) =>
    request<BackendInvoice>(`/api/billing/${invoiceId}/submit-approval`, { method: "POST" }),

  approveBillingInvoice: (invoiceId: string) =>
    request<BackendInvoice>(`/api/billing/${invoiceId}/approve`, { method: "POST" }),

  markBillingInvoiceSent: (invoiceId: string) =>
    request<BackendInvoice>(`/api/billing/${invoiceId}/mark-sent`, { method: "POST" }),

  createInvoice: (data: Record<string, unknown>) =>
    request<BackendInvoice>("/api/billing", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getInvoice: (id: string) => request<BackendInvoice>(`/api/billing/${id}`),

  updateInvoice: (id: string, data: { dueAt?: string; lineItems?: InvoiceLineInput[] }) =>
    request<BackendInvoice>(`/api/billing/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  listServiceCatalog: () =>
    request<BackendCatalogItem[]>("/api/domain/service-catalog"),

  createServiceCatalogItem: (data: CatalogItemInput) =>
    request<BackendCatalogItem>("/api/domain/service-catalog", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateServiceCatalogItem: (id: string, data: CatalogItemInput) =>
    request<BackendCatalogItem>(`/api/domain/service-catalog/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  archiveServiceCatalogItem: (id: string) =>
    request<void>(`/api/domain/service-catalog/${id}`, { method: "DELETE" }),

  createEstimateRevision: (
    id: string,
    data: {
      lines: EstimateLineInput[];
      discount: number;
      terms?: string | null;
      notes?: string | null;
      sendForApproval?: boolean;
      status?: "draft" | "pendingAdminApproval";
    },
  ) =>
    request<BackendEstimate>(`/api/domain/estimates/${id}/revisions`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  decideEstimate: (
    id: string,
    decision: "approved" | "rejected" | "revision",
    note?: string,
    options?: { engineerId?: string; scheduledFor?: string },
  ) =>
    request<BackendEstimate>(`/api/domain/estimates/${id}/decisions`, {
      method: "POST",
      body: JSON.stringify({ decision, note, ...options }),
    }),

  /** Customer-scoped portal aggregate (equipment, tickets, estimates, invoices). */
  getCustomerPortal: () =>
    request<{
      customer: { id: string; name: string };
      equipment: BackendEquipment[];
      requests: BackendServiceRequest[];
      estimates: BackendEstimate[];
      invoices: BackendInvoice[];
      documents: unknown[];
    }>("/api/domain/portal"),

  assignJobStaff: (id: string, data: { userId: string; role: string; isLead: boolean }) =>
    request<BackendJobAssignment>(`/api/domain/jobs/${id}/assignments`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  addJobWorkLog: (
    id: string,
    data: { startedAt: string; endedAt?: string | null; workPerformed: string; testingResult?: string | null; calibrationResult?: string | null },
  ) =>
    request<BackendJobWorkLog>(`/api/domain/jobs/${id}/work-logs`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  addJobExtra: (
    id: string,
    data: {
      inventoryItemId?: string | null;
      description: string;
      type?: "product" | "equipment" | "machine" | "other";
      reason: string;
      quantity: number;
      unitPrice: number;
      taxRate: number;
    },
  ) =>
    request<BackendJobExtra>(`/api/domain/jobs/${id}/extras`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  approveJobExtra: (id: string) =>
    request<BackendJobExtra>(`/api/domain/job-extras/${id}/approve`, { method: "POST" }),

  createItemizedPurchaseOrder: (data: {
    supplierId?: string | null;
    supplier: string;
    branchId?: string | null;
    expectedDate: string;
    lines: { inventoryItemId?: string | null; sku: string; description: string; quantityOrdered: number; unitCost: number; taxRate: number }[];
  }) =>
    request<BackendPurchaseOrder>("/api/domain/purchase-orders", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  receivePurchaseOrder: (
    id: string,
    data: { reference: string; notes?: string; lines: { purchaseOrderLineId: string; quantity: number }[] },
  ) =>
    request<BackendPurchaseReceipt>(`/api/domain/purchase-orders/${id}/receipts`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  createInvoiceFromJob: (
    jobId: string,
    dueAt: string,
    currency = "INR",
    additionalLines?: InvoiceLineInput[],
  ) =>
    request<BackendInvoice>("/api/domain/invoices/from-job", {
      method: "POST",
      body: JSON.stringify({ jobId, dueAt, currency, additionalLines }),
    }),

  recordInvoicePayment: (
    id: string,
    data: { amount: number; method: string; reference?: string; note?: string; paidAt?: string },
  ) =>
    request<BackendInvoice>(`/api/domain/invoices/${id}/payments`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getEquipmentHistory: (assetTag: string) =>
    request<BackendEquipmentHistory>(`/api/domain/equipment-history/${encodeURIComponent(assetTag)}`),

  recordQrScan: (assetTag: string, source: "camera" | "manual" | "label" = "manual") =>
    request<{ equipment: BackendEquipment | null }>("/api/domain/qr-scans", {
      method: "POST",
      body: JSON.stringify({ assetTag, source }),
    }),

  listOfficeAssets: () => request<BackendOfficeAsset[]>("/api/domain/office-assets"),

  createOfficeAsset: (data: OfficeAssetInput) =>
    request<BackendOfficeAsset>("/api/domain/office-assets", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listExpenses: () => request<BackendExpense[]>("/api/domain/finance/expenses"),

  createExpense: (data: {
    branchId?: string | null;
    projectRef?: string | null;
    jobId?: string | null;
    category: string;
    description: string;
    amount: number;
    incurredAt: string;
    vendor?: string | null;
    receiptFileId?: string | null;
  }) =>
    request<BackendExpense>("/api/domain/finance/expenses", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listReferrals: () => request<BackendReferral[]>("/api/domain/finance/referrals"),
  listCommissions: () => request<BackendCommission[]>("/api/domain/finance/commissions"),

  createCommission: (data: { referralId?: string | null; invoiceId?: string | null; payeeName: string; basisAmount: number; rate: number }) =>
    request<BackendCommission>("/api/domain/finance/commissions", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listDomainRoles: () => request<BackendDomainRole[]>("/api/domain/roles"),

  assignDomainRole: (data: { userId: string; roleId: string; branchId?: string | null }) =>
    request<{ id: string }>("/api/domain/role-assignments", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listAuditLogs: (params?: AuditLogListParams) =>
    requestPaginated<BackendAuditLog>(`/api/audit-logs${buildListQuery(params)}`),
};
