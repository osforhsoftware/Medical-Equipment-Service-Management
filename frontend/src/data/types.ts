// MESMS domain types — database-ready models (MongoDB/Postgres compatible).
// Every record carries a tenantId for multi-tenant SaaS separation.

export type Role =
  | "admin"
  | "coordinator"
  | "inspector"
  | "estimator"
  | "sales"
  | "engineer"
  | "inventory"
  | "billing"
  | "customer";

export interface AppUser {
  id: string;
  tenantId: string;
  name: string;
  username: string;
  email: string;
  role: Role;
  roles?: Role[];
  phone?: string | null;
  isActive: boolean;
  branchId?: string;
  avatarColor: string;
  customerId?: string; // for customer portal users
}

export interface Branch {
  id: string;
  tenantId: string;
  name: string;
  city: string;
  phone: string;
}

export interface Customer {
  id: string;
  tenantId: string;
  name: string;
  type: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  licenseGst?: string | null;
  branchId: string;
  equipmentCount: number;
  activeJobs: number;
  status: "active" | "inactive";
}

export interface Equipment {
  id: string;
  tenantId: string;
  assetTag: string; // QR-tracked
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
  amcStatus: "active" | "expiring" | "expired" | "none";
  condition: string;
  lastServiceDate: string;
}

export type ServiceStatus =
  | "new"
  | "inspection"
  | "estimate"
  | "approval"
  | "in-progress"
  | "completed"
  | "invoiced";

export interface ServiceRequest {
  id: string;
  tenantId: string;
  reference: string;
  customerId: string;
  customerName: string;
  equipmentId: string;
  equipmentName: string;
  branchId: string;
  type: "Repair" | "Maintenance" | "Calibration" | "Inspection" | "Installation" | "Other";
  priority: "low" | "medium" | "high" | "critical";
  status: ServiceStatus;
  description: string;
  createdBy: string;
  createdAt: string;
  assignedTo?: string;
  slaDue: string;
}

export interface TimelineEvent {
  id: string;
  at: string;
  actor: string;
  action: string;
  note?: string;
}

export interface Estimate {
  id: string;
  tenantId: string;
  reference: string;
  requestRef: string;
  customerName: string;
  equipmentName: string;
  laborCost: number;
  partsCost: number;
  total: number;
  status: "draft" | "sent" | "approved" | "rejected" | "revision";
  createdAt: string;
  validUntil: string;
  revision: number;
}

export interface InventoryItem {
  id: string;
  tenantId: string;
  sku: string;
  name: string;
  category: string;
  branchId: string;
  inStock: number;
  reserved: number;
  reorderLevel: number;
  unitCost: number;
  supplier: string;
}

export interface Supplier {
  id: string;
  tenantId: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
  category: string;
  rating: number;
  openOrders: number;
}

export interface PurchaseOrder {
  id: string;
  tenantId: string;
  reference: string;
  supplier: string;
  items: number;
  total: number;
  status: "draft" | "sent" | "received" | "partial" | "cancelled";
  createdAt: string;
  expectedDate: string;
}

export interface StockTransfer {
  id: string;
  tenantId: string;
  reference: string;
  fromBranch: string;
  toBranch: string;
  items: number;
  status: "pending" | "in-transit" | "received";
  createdAt: string;
}

export interface AMCContract {
  id: string;
  tenantId: string;
  reference: string;
  customerName: string;
  equipmentCount: number;
  startDate: string;
  endDate: string;
  value: number;
  visitsPerYear: number;
  visitsDone: number;
  status: "active" | "expiring" | "expired";
}

export interface Invoice {
  id: string;
  tenantId: string;
  reference: string;
  customerName: string;
  jobRef: string;
  amount: number;
  tax: number;
  total: number;
  status: "draft" | "sent" | "paid" | "overdue";
  issuedAt: string;
  dueAt: string;
}

export interface AppNotification {
  id: string;
  type: "amc" | "stock" | "approval" | "job" | "system";
  title: string;
  body: string;
  at: string;
  read: boolean;
}

export interface AuditLog {
  id: string;
  at: string;
  actor: string;
  role: Role;
  action: string;
  entity: string;
  ip: string;
}

export interface ServiceJob {
  id: string;
  tenantId: string;
  reference: string;
  requestRef: string;
  customerName: string;
  equipmentName: string;
  engineer: string;
  type: ServiceRequest["type"];
  status: "scheduled" | "in-progress" | "parts-pending" | "review" | "completed";
  scheduledFor: string;
  progress: number;
}
