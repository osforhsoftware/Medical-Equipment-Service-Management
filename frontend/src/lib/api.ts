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
    "Content-Type": "application/json",
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
  assignedTo: string;
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
  reference: string;
  customerName: string;
  jobRef: string;
  amount: string | number;
  tax: string | number;
  total: string | number;
  status: string;
  issuedAt: string;
  dueAt: string;
  createdAt: string;
  updatedAt: string;
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
  reference: string;
  requestRef: string;
  customerName: string;
  equipmentName: string;
  laborCost: string | number;
  partsCost: string | number;
  total: string | number;
  status: string;
  validUntil: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
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
  createdAt: string;
  updatedAt: string;
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
  reference: string;
  supplier: string;
  items: number;
  total: string | number;
  status: string;
  expectedDate: string;
  createdAt: string;
  updatedAt: string;
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
  items: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStockTransferInput {
  fromBranch: string;
  toBranch: string;
  items: number;
  status?: string;
}

export interface BackendSettings {
  tenantId: string;
  companyName: string;
  supportEmail: string;
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

export interface DashboardData {
  stats: {
    openRequests: number;
    activeJobs: number;
    lowStockItems: number;
    revenueMtd: number;
    revenueMtdLabel: string;
    expiringAmc: number;
  };
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
  }[];
  recentActivity: { id: string; action: string; actor: string; at: string }[];
  lowStock: { id: string; name: string; inStock: number; reorderLevel: number }[];
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

  listEstimates: () => request<BackendEstimate[]>("/api/estimates"),

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

  listAuditLogs: (params?: { page?: number; limit?: number }) =>
    request<BackendAuditLog[]>(`/api/audit-logs${queryString({ page: params?.page?.toString(), limit: params?.limit?.toString() })}`),
};
