const API_BASE = import.meta.env.VITE_API_URL ?? "";

const USER_KEY = "mesms.user";

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
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

export interface BackendUser {
  id: string;
  tenantId: string;
  name: string;
  username: string;
  email: string;
  role: string;
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
  phone?: string;
  isActive?: boolean;
  branchId?: string;
}

export interface UpdateUserInput {
  name?: string;
  username?: string;
  email?: string;
  role?: string;
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
  name: string;
  type: string;
  contactPerson: string;
  email: string;
  phone: string;
  city: string;
  branchId: string;
  equipmentCount: number;
  activeJobs: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerInput {
  name: string;
  type: string;
  contactPerson: string;
  email: string;
  phone: string;
  city: string;
  branchId: string;
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
  lastServiceDate?: string;
}

export interface BackendServiceRequestEquipment {
  id: string;
  serviceRequestId: string;
  equipmentId: string;
  equipmentName: string;
  assetTag: string;
}

export interface BackendInspectionReport {
  id: string;
  serviceRequestId: string;
  findings: string;
  recommendation: string;
  severity: string;
  reportedBy: string;
  reportedAt: string;
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
  priority: string;
  status: string;
  description: string;
  createdBy: string;
  assignedTo: string | null;
  assignedName: string | null;
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

export interface BackendInvoicePayment {
  id: string;
  amount: string | number;
  method: string;
  reference?: string | null;
  note?: string | null;
  paidAt: string;
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
  serviceRequestId: string;
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
  status: string;
  scheduledFor: string;
  progress: number;
  assignments?: BackendJobAssignment[];
  workLogs?: BackendJobWorkLog[];
  extras?: BackendJobExtra[];
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
  reason: string;
  quantity: string | number;
  unitPrice: string | number;
  taxRate: string | number;
  status: string;
  createdAt: string;
}

export interface CreateJobInput {
  serviceRequestId: string;
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
  filename: string;
  mimeType: string;
  dataUrl: string;
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
  branchId: string;
  inStock: number;
  reserved: number;
  reorderLevel: number;
  unitCost: string | number;
  supplier: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInventoryInput {
  sku: string;
  name: string;
  category: string;
  branchId: string;
  inStock?: number;
  reserved?: number;
  reorderLevel?: number;
  unitCost?: number;
  supplier: string;
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
  logoUrl?: string | null;
  defaultTaxRate: number;
  amcRenewalReminders: boolean;
  lowStockAlerts: boolean;
  autoReserveOnApproval: boolean;
  autoGenerateReport: boolean;
  rbacMatrix: Record<string, string[]>;
}

export interface UpdateSettingsInput {
  companyName?: string;
  supportEmail?: string;
  logoUrl?: string | null;
  defaultTaxRate?: number;
  amcRenewalReminders?: boolean;
  lowStockAlerts?: boolean;
  autoReserveOnApproval?: boolean;
  autoGenerateReport?: boolean;
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

  listBranches: () => request<BackendBranch[]>("/api/branches"),

  listCustomers: (branchId?: string) =>
    request<BackendCustomer[]>(`/api/customers${queryString({ branchId })}`),

  createCustomer: (data: CreateCustomerInput) =>
    request<BackendCustomer>("/api/customers", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listEquipment: (params?: { branchId?: string; customerId?: string }) =>
    request<BackendEquipment[]>(
      `/api/equipment${queryString({ branchId: params?.branchId, customerId: params?.customerId })}`,
    ),

  getEquipmentByTag: (assetTag: string) =>
    request<BackendEquipment>(`/api/equipment/by-tag/${encodeURIComponent(assetTag)}`),

  createEquipment: (data: CreateEquipmentInput) =>
    request<BackendEquipment>("/api/equipment", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listServiceRequests: (params?: { branchId?: string; status?: string }) =>
    request<BackendServiceRequest[]>(
      `/api/service-requests${queryString({ branchId: params?.branchId, status: params?.status })}`,
    ),

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

  getInspectionReport: (requestId: string) =>
    request<BackendInspectionReport | null>(`/api/inspections/${requestId}`),

  saveInspectionReport: (requestId: string, data: CreateInspectionInput) =>
    request<BackendInspectionReport>(`/api/inspections/${requestId}`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  addInspectionRecommendation: (
    reportId: string,
    data: { title: string; description: string; priority: "low" | "medium" | "high" | "critical" },
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

  listEstimates: () => request<BackendEstimate[]>("/api/estimates"),

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

  listJobs: (status?: string) =>
    request<BackendServiceJob[]>(`/api/jobs${queryString({ status })}`),

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

  listInventory: (branchId?: string) =>
    request<BackendInventoryItem[]>(`/api/inventory${queryString({ branchId })}`),

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

  listPurchaseOrders: (status?: string) =>
    request<BackendPurchaseOrder[]>(`/api/purchase-orders${queryString({ status })}`),

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

  getSettings: () => request<BackendSettings>("/api/settings"),

  getDashboard: (branchId?: string) =>
    request<DashboardData>(`/api/dashboard${queryString({ branchId })}`),

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

  listSuppliers: () => request<BackendSupplier[]>("/api/suppliers"),

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

  createInvoice: (data: Record<string, unknown>) =>
    request<BackendInvoice>("/api/billing", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getInvoice: (id: string) => request<BackendInvoice>(`/api/billing/${id}`),

  updateInvoice: (id: string, data: Record<string, unknown>) =>
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
    data: { lines: EstimateLineInput[]; discount: number; terms?: string | null; notes?: string | null },
  ) =>
    request<BackendEstimate>(`/api/domain/estimates/${id}/revisions`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  decideEstimate: (id: string, decision: "approved" | "rejected" | "revision", note?: string) =>
    request<BackendEstimate>(`/api/domain/estimates/${id}/decisions`, {
      method: "POST",
      body: JSON.stringify({ decision, note }),
    }),

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
    data: { inventoryItemId?: string | null; description: string; reason: string; quantity: number; unitPrice: number; taxRate: number },
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

  createInvoiceFromJob: (jobId: string, dueAt: string, currency = "INR") =>
    request<BackendInvoice>("/api/domain/invoices/from-job", {
      method: "POST",
      body: JSON.stringify({ jobId, dueAt, currency }),
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

  listAuditLogs: (params?: { page?: number; limit?: number }) =>
    request<BackendAuditLog[]>(`/api/audit-logs${queryString({ page: params?.page?.toString(), limit: params?.limit?.toString() })}`),
};
