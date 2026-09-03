import type {
  AMCContract,
  AppUser,
  AuditLog,
  Branch,
  Customer,
  Equipment,
  Estimate,
  InventoryItem,
  Invoice,
  PurchaseOrder,
  Role,
  ServiceJob,
  ServiceRequest,
  StockTransfer,
  Supplier,
  TimelineEvent,
} from "./types";

export const TENANT = "tenant_medtech_01";

export const roleLabels: Record<Role, string> = {
  admin: "Administrator",
  coordinator: "Service Coordinator",
  inspector: "Inspection Technician",
  estimator: "Estimate Staff",
  sales: "Sales Staff",
  engineer: "Service Engineer",
  inventory: "Inventory Manager",
  billing: "Billing Staff",
  customer: "Customer Portal",
};

export const demoUsers: AppUser[] = [
  { id: "u1", tenantId: TENANT, name: "Alex Morgan", username: "admin", email: "admin@mesms.io", role: "admin", branchId: "b1", avatarColor: "205 90% 42%" },
  { id: "u2", tenantId: TENANT, name: "Priya Nair", username: "coordinator", email: "coordinator@mesms.io", role: "coordinator", branchId: "b1", avatarColor: "174 62% 47%" },
  { id: "u3", tenantId: TENANT, name: "Daniel Cruz", username: "inspector", email: "inspector@mesms.io", role: "inspector", branchId: "b1", avatarColor: "38 92% 50%" },
  { id: "u4", tenantId: TENANT, name: "Sara Lin", username: "estimator", email: "estimator@mesms.io", role: "estimator", branchId: "b2", avatarColor: "265 70% 55%" },
  { id: "u4b", tenantId: TENANT, name: "Noah Adler", username: "sales", email: "sales@mesms.io", role: "sales", branchId: "b1", avatarColor: "25 85% 45%" },
  { id: "u5", tenantId: TENANT, name: "Marcus Bell", username: "engineer", email: "engineer@mesms.io", role: "engineer", branchId: "b1", avatarColor: "152 62% 40%" },
  { id: "u6", tenantId: TENANT, name: "Hana Kim", username: "inventory", email: "inventory@mesms.io", role: "inventory", branchId: "b2", avatarColor: "200 80% 45%" },
  { id: "u7", tenantId: TENANT, name: "Leo Garcia", username: "billing", email: "billing@mesms.io", role: "billing", branchId: "b1", avatarColor: "20 85% 55%" },
  { id: "u8", tenantId: TENANT, name: "St. Mary's Hospital", username: "portal", email: "portal@stmarys.org", role: "customer", avatarColor: "205 90% 42%", customerId: "c1" },
];

export const branches: Branch[] = [
  { id: "b1", tenantId: TENANT, name: "Central Hub", city: "Austin", phone: "+1 512-555-0110" },
  { id: "b2", tenantId: TENANT, name: "North Depot", city: "Dallas", phone: "+1 214-555-0177" },
  { id: "b3", tenantId: TENANT, name: "Gulf Service Center", city: "Houston", phone: "+1 713-555-0199" },
];

export const customers: Customer[] = [
  { id: "c1", tenantId: TENANT, name: "St. Mary's Hospital", type: "Hospital", contactPerson: "Dr. Ellen Park", email: "facilities@stmarys.org", phone: "+1 512-555-2010", address: "1200 Medical Center Dr", city: "Austin", country: "United States", branchId: "b1", equipmentCount: 42, activeJobs: 3, status: "active" },
  { id: "c2", tenantId: TENANT, name: "Brighton Diagnostics", type: "DiagnosticLab", contactPerson: "Omar Reyes", email: "ops@brightondx.com", phone: "+1 214-555-3320", address: "450 Lab Parkway", city: "Dallas", country: "United States", branchId: "b2", equipmentCount: 18, activeJobs: 1, status: "active" },
  { id: "c3", tenantId: TENANT, name: "Lakeside Dental Group", type: "Dental", contactPerson: "Tina Holt", email: "admin@lakesidedental.com", phone: "+1 713-555-4412", address: "88 Lakeside Ave", city: "Houston", country: "United States", branchId: "b3", equipmentCount: 9, activeJobs: 0, status: "active" },
  { id: "c4", tenantId: TENANT, name: "Vista Research Institute", type: "Research", contactPerson: "Dr. Yuki Sato", email: "lab@vistari.org", phone: "+1 512-555-5510", address: "210 Research Blvd", city: "Austin", country: "United States", branchId: "b1", equipmentCount: 27, activeJobs: 2, status: "active" },
  { id: "c5", tenantId: TENANT, name: "Cedar Family Clinic", type: "Clinic", contactPerson: "Rosa Mendez", email: "front@cedarclinic.com", phone: "+1 214-555-6600", address: "15 Cedar St", city: "Dallas", country: "United States", branchId: "b2", equipmentCount: 6, activeJobs: 0, status: "inactive" },
];

export const equipment: Equipment[] = [
  { id: "e1", tenantId: TENANT, assetTag: "MED-AX-2207", name: "MRI Scanner", model: "Magnetom Vida", manufacturer: "Siemens", category: "Imaging", serialNumber: "SN-MRI-99201", customerId: "c1", customerName: "St. Mary's Hospital", branchId: "b1", location: "Radiology Wing 2", installDate: "2021-03-12", warrantyEnd: "2026-03-12", amcStatus: "active", condition: "operational", lastServiceDate: "2026-04-02" },
  { id: "e2", tenantId: TENANT, assetTag: "MED-AX-1180", name: "CT Scanner", model: "Revolution CT", manufacturer: "GE Healthcare", category: "Imaging", serialNumber: "SN-CT-44120", customerId: "c1", customerName: "St. Mary's Hospital", branchId: "b1", location: "Radiology Wing 1", installDate: "2020-07-22", warrantyEnd: "2025-07-22", amcStatus: "expiring", condition: "needs-service", lastServiceDate: "2026-02-15" },
  { id: "e3", tenantId: TENANT, assetTag: "MED-AX-3304", name: "Ventilator", model: "Servo-u", manufacturer: "Getinge", category: "Life Support", serialNumber: "SN-VEN-77310", customerId: "c1", customerName: "St. Mary's Hospital", branchId: "b1", location: "ICU Bay 4", installDate: "2022-01-05", warrantyEnd: "2027-01-05", amcStatus: "active", condition: "down", lastServiceDate: "2026-05-20" },
  { id: "e4", tenantId: TENANT, assetTag: "MED-AX-5521", name: "Blood Analyzer", model: "cobas 6000", manufacturer: "Roche", category: "Diagnostics", serialNumber: "SN-BA-22018", customerId: "c2", customerName: "Brighton Diagnostics", branchId: "b2", location: "Lab Room A", installDate: "2019-11-18", warrantyEnd: "2024-11-18", amcStatus: "expired", condition: "operational", lastServiceDate: "2026-01-30" },
  { id: "e5", tenantId: TENANT, assetTag: "MED-AX-6650", name: "Ultrasound", model: "LOGIQ E10", manufacturer: "GE Healthcare", category: "Imaging", serialNumber: "SN-US-66201", customerId: "c4", customerName: "Vista Research Institute", branchId: "b1", location: "Diagnostics Lab", installDate: "2023-05-14", warrantyEnd: "2028-05-14", amcStatus: "active", condition: "operational", lastServiceDate: "2026-04-28" },
  { id: "e6", tenantId: TENANT, assetTag: "MED-AX-7740", name: "Dental X-Ray", model: "ORTHOPHOS S", manufacturer: "Dentsply Sirona", category: "Imaging", serialNumber: "SN-DX-31109", customerId: "c3", customerName: "Lakeside Dental Group", branchId: "b3", location: "Suite 3", installDate: "2022-09-09", warrantyEnd: "2027-09-09", amcStatus: "none", condition: "operational", lastServiceDate: "2025-12-11" },
];

export const serviceRequests: ServiceRequest[] = [
  { id: "sr1", tenantId: TENANT, reference: "SR-2026-0142", customerId: "c1", customerName: "St. Mary's Hospital", equipmentId: "e3", equipmentName: "Ventilator (Servo-u)", branchId: "b1", type: "Repair", priority: "critical", status: "in-progress", description: "Unit fails self-test; alarm on power-up.", createdBy: "Priya Nair", createdAt: "2026-05-28", assignedTo: "Marcus Bell", slaDue: "2026-06-04" },
  { id: "sr2", tenantId: TENANT, reference: "SR-2026-0141", customerId: "c1", customerName: "St. Mary's Hospital", equipmentId: "e2", equipmentName: "CT Scanner (Revolution)", branchId: "b1", type: "Maintenance", priority: "high", status: "estimate", description: "Quarterly PM + image artifact check.", createdBy: "Priya Nair", createdAt: "2026-05-30", assignedTo: "Daniel Cruz", slaDue: "2026-06-08" },
  { id: "sr3", tenantId: TENANT, reference: "SR-2026-0140", customerId: "c2", customerName: "Brighton Diagnostics", equipmentId: "e4", equipmentName: "Blood Analyzer (cobas)", branchId: "b2", type: "Calibration", priority: "medium", status: "approval", description: "Annual calibration certification due.", createdBy: "Priya Nair", createdAt: "2026-05-31", assignedTo: "Daniel Cruz", slaDue: "2026-06-12" },
  { id: "sr4", tenantId: TENANT, reference: "SR-2026-0139", customerId: "c4", customerName: "Vista Research Institute", equipmentId: "e5", equipmentName: "Ultrasound (LOGIQ)", branchId: "b1", type: "Inspection", priority: "low", status: "inspection", description: "Probe wear inspection requested.", createdBy: "Priya Nair", createdAt: "2026-06-01", assignedTo: "Daniel Cruz", slaDue: "2026-06-15" },
  { id: "sr5", tenantId: TENANT, reference: "SR-2026-0138", customerId: "c1", customerName: "St. Mary's Hospital", equipmentId: "e1", equipmentName: "MRI Scanner (Vida)", branchId: "b1", type: "Maintenance", priority: "medium", status: "new", description: "Helium level monitoring + cold-head check.", createdBy: "Priya Nair", createdAt: "2026-06-02", slaDue: "2026-06-18" },
  { id: "sr6", tenantId: TENANT, reference: "SR-2026-0137", customerId: "c3", customerName: "Lakeside Dental Group", equipmentId: "e6", equipmentName: "Dental X-Ray (S)", branchId: "b3", type: "Installation", priority: "low", status: "completed", description: "New sensor install + commissioning.", createdBy: "Priya Nair", createdAt: "2026-05-20", assignedTo: "Marcus Bell", slaDue: "2026-05-30" },
  { id: "sr7", tenantId: TENANT, reference: "SR-2026-0136", customerId: "c2", customerName: "Brighton Diagnostics", equipmentId: "e4", equipmentName: "Blood Analyzer (cobas)", branchId: "b2", type: "Repair", priority: "high", status: "invoiced", description: "Pump module replacement.", createdBy: "Priya Nair", createdAt: "2026-05-12", assignedTo: "Marcus Bell", slaDue: "2026-05-22" },
];

export const requestTimeline: TimelineEvent[] = [
  { id: "t1", at: "2026-05-28 09:12", actor: "Priya Nair", action: "Service request created", note: "On behalf of St. Mary's Hospital" },
  { id: "t2", at: "2026-05-28 10:40", actor: "Priya Nair", action: "Inspector assigned", note: "Daniel Cruz" },
  { id: "t3", at: "2026-05-29 14:05", actor: "Daniel Cruz", action: "Inspection completed", note: "4 photos, 1 video uploaded" },
  { id: "t4", at: "2026-05-30 11:20", actor: "Sara Lin", action: "Estimate generated", note: "EST-2026-0098 — ₹2,480" },
  { id: "t5", at: "2026-05-31 08:55", actor: "St. Mary's Hospital", action: "Estimate approved", note: "Via customer portal" },
  { id: "t6", at: "2026-05-31 09:30", actor: "Hana Kim", action: "Inventory reserved", note: "Pump module x1, sensor kit x1" },
  { id: "t7", at: "2026-06-01 08:00", actor: "Priya Nair", action: "Engineer assigned", note: "Marcus Bell" },
  { id: "t8", at: "2026-06-02 13:15", actor: "Marcus Bell", action: "Repair in progress", note: "Before photos uploaded" },
];

export const estimates: Estimate[] = [
  { id: "es1", tenantId: TENANT, reference: "EST-2026-0098", requestRef: "SR-2026-0141", customerName: "St. Mary's Hospital", equipmentName: "CT Scanner", laborCost: 1200, partsCost: 1280, total: 2480, status: "sent", createdAt: "2026-05-30", validUntil: "2026-06-14", revision: 1 },
  { id: "es2", tenantId: TENANT, reference: "EST-2026-0097", requestRef: "SR-2026-0140", customerName: "Brighton Diagnostics", equipmentName: "Blood Analyzer", laborCost: 600, partsCost: 340, total: 940, status: "approved", createdAt: "2026-05-29", validUntil: "2026-06-12", revision: 1 },
  { id: "es3", tenantId: TENANT, reference: "EST-2026-0096", requestRef: "SR-2026-0142", customerName: "St. Mary's Hospital", equipmentName: "Ventilator", laborCost: 900, partsCost: 1850, total: 2750, status: "revision", createdAt: "2026-05-31", validUntil: "2026-06-15", revision: 2 },
  { id: "es4", tenantId: TENANT, reference: "EST-2026-0095", customerName: "Vista Research Institute", requestRef: "SR-2026-0139", equipmentName: "Ultrasound", laborCost: 450, partsCost: 0, total: 450, status: "draft", createdAt: "2026-06-01", validUntil: "2026-06-16", revision: 1 },
];

export const inventory: InventoryItem[] = [
  { id: "i1", tenantId: TENANT, sku: "PRT-PUMP-009", name: "Infusion Pump Module", category: "Modules", branchId: "b1", inStock: 12, reserved: 3, reorderLevel: 5, unitCost: 480, supplier: "MedParts Global" },
  { id: "i2", tenantId: TENANT, sku: "PRT-SNSR-220", name: "Ultrasound Probe Sensor", category: "Sensors", branchId: "b1", inStock: 4, reserved: 1, reorderLevel: 6, unitCost: 920, supplier: "Acme Medical Supply" },
  { id: "i3", tenantId: TENANT, sku: "PRT-FLTR-130", name: "HEPA Filter Cartridge", category: "Consumables", branchId: "b2", inStock: 38, reserved: 0, reorderLevel: 15, unitCost: 45, supplier: "FilterTech" },
  { id: "i4", tenantId: TENANT, sku: "PRT-BRD-512", name: "Control Board (CT)", category: "Boards", branchId: "b1", inStock: 2, reserved: 2, reorderLevel: 3, unitCost: 1640, supplier: "MedParts Global" },
  { id: "i5", tenantId: TENANT, sku: "PRT-CAL-077", name: "Calibration Kit", category: "Tools", branchId: "b2", inStock: 9, reserved: 1, reorderLevel: 4, unitCost: 210, supplier: "CalibPro" },
  { id: "i6", tenantId: TENANT, sku: "PRT-CBL-300", name: "Power Cable Assembly", category: "Consumables", branchId: "b3", inStock: 1, reserved: 0, reorderLevel: 10, unitCost: 65, supplier: "FilterTech" },
];

export const suppliers: Supplier[] = [
  { id: "s1", tenantId: TENANT, name: "MedParts Global", contact: "Janet Wu", email: "sales@medpartsglobal.com", phone: "+1 800-555-1200", category: "OEM Parts", rating: 4.8, openOrders: 2 },
  { id: "s2", tenantId: TENANT, name: "Acme Medical Supply", contact: "Tom Reed", email: "orders@acmemed.com", phone: "+1 800-555-1330", category: "Sensors & Probes", rating: 4.5, openOrders: 1 },
  { id: "s3", tenantId: TENANT, name: "FilterTech", contact: "Lia Bose", email: "hello@filtertech.io", phone: "+1 800-555-1440", category: "Consumables", rating: 4.2, openOrders: 0 },
  { id: "s4", tenantId: TENANT, name: "CalibPro", contact: "Raj Patel", email: "support@calibpro.com", phone: "+1 800-555-1550", category: "Calibration", rating: 4.9, openOrders: 1 },
];

export const purchaseOrders: PurchaseOrder[] = [
  { id: "po1", tenantId: TENANT, reference: "PO-2026-0211", supplier: "MedParts Global", items: 4, total: 6840, status: "sent", createdAt: "2026-05-29", expectedDate: "2026-06-09" },
  { id: "po2", tenantId: TENANT, reference: "PO-2026-0210", supplier: "Acme Medical Supply", items: 2, total: 1840, status: "received", createdAt: "2026-05-22", expectedDate: "2026-06-01" },
  { id: "po3", tenantId: TENANT, reference: "PO-2026-0209", supplier: "CalibPro", items: 1, total: 210, status: "partial", createdAt: "2026-05-25", expectedDate: "2026-06-05" },
  { id: "po4", tenantId: TENANT, reference: "PO-2026-0208", supplier: "FilterTech", items: 6, total: 390, status: "draft", createdAt: "2026-06-01", expectedDate: "2026-06-12" },
];

export const stockTransfers: StockTransfer[] = [
  { id: "st1", tenantId: TENANT, reference: "TR-2026-0044", fromBranch: "Central Hub", toBranch: "North Depot", items: 3, status: "in-transit", createdAt: "2026-06-01" },
  { id: "st2", tenantId: TENANT, reference: "TR-2026-0043", fromBranch: "North Depot", toBranch: "Gulf Service Center", items: 5, status: "received", createdAt: "2026-05-28" },
  { id: "st3", tenantId: TENANT, reference: "TR-2026-0042", fromBranch: "Central Hub", toBranch: "Gulf Service Center", items: 2, status: "pending", createdAt: "2026-06-02" },
];

export const amcContracts: AMCContract[] = [
  { id: "a1", tenantId: TENANT, reference: "AMC-2025-018", customerName: "St. Mary's Hospital", equipmentCount: 12, startDate: "2025-07-01", endDate: "2026-06-30", value: 48000, visitsPerYear: 4, visitsDone: 3, status: "expiring" },
  { id: "a2", tenantId: TENANT, reference: "AMC-2026-004", customerName: "Vista Research Institute", equipmentCount: 8, startDate: "2026-01-01", endDate: "2026-12-31", value: 26000, visitsPerYear: 4, visitsDone: 1, status: "active" },
  { id: "a3", tenantId: TENANT, reference: "AMC-2024-031", customerName: "Brighton Diagnostics", equipmentCount: 5, startDate: "2024-09-01", endDate: "2025-08-31", value: 15000, visitsPerYear: 2, visitsDone: 2, status: "expired" },
];

export const invoices: Invoice[] = [
  { id: "inv1", tenantId: TENANT, reference: "INV-2026-0521", customerName: "Brighton Diagnostics", jobRef: "SR-2026-0136", amount: 1840, tax: 147, total: 1987, status: "paid", issuedAt: "2026-05-23", dueAt: "2026-06-06" },
  { id: "inv2", tenantId: TENANT, reference: "INV-2026-0520", customerName: "Lakeside Dental Group", jobRef: "SR-2026-0137", amount: 2200, tax: 176, total: 2376, status: "sent", issuedAt: "2026-05-30", dueAt: "2026-06-13" },
  { id: "inv3", tenantId: TENANT, reference: "INV-2026-0519", customerName: "St. Mary's Hospital", jobRef: "SR-2026-0130", amount: 3400, tax: 272, total: 3672, status: "overdue", issuedAt: "2026-05-02", dueAt: "2026-05-16" },
  { id: "inv4", tenantId: TENANT, reference: "INV-2026-0518", customerName: "Vista Research Institute", jobRef: "SR-2026-0128", amount: 760, tax: 61, total: 821, status: "draft", issuedAt: "2026-06-01", dueAt: "2026-06-15" },
];

export const serviceJobs: ServiceJob[] = [
  { id: "j1", tenantId: TENANT, reference: "JOB-2026-0301", requestRef: "SR-2026-0142", customerName: "St. Mary's Hospital", equipmentName: "Ventilator", engineer: "Marcus Bell", type: "Repair", status: "in-progress", scheduledFor: "2026-06-03", progress: 55 },
  { id: "j2", tenantId: TENANT, reference: "JOB-2026-0300", requestRef: "SR-2026-0140", customerName: "Brighton Diagnostics", equipmentName: "Blood Analyzer", engineer: "Marcus Bell", type: "Calibration", status: "scheduled", scheduledFor: "2026-06-05", progress: 0 },
  { id: "j3", tenantId: TENANT, reference: "JOB-2026-0299", requestRef: "SR-2026-0141", customerName: "St. Mary's Hospital", equipmentName: "CT Scanner", engineer: "Marcus Bell", type: "Maintenance", status: "parts-pending", scheduledFor: "2026-06-06", progress: 30 },
  { id: "j4", tenantId: TENANT, reference: "JOB-2026-0298", requestRef: "SR-2026-0139", customerName: "Vista Research Institute", equipmentName: "Ultrasound", engineer: "Marcus Bell", type: "Inspection", status: "review", scheduledFor: "2026-06-02", progress: 90 },
  { id: "j5", tenantId: TENANT, reference: "JOB-2026-0297", requestRef: "SR-2026-0137", customerName: "Lakeside Dental Group", equipmentName: "Dental X-Ray", engineer: "Marcus Bell", type: "Installation", status: "completed", scheduledFor: "2026-05-28", progress: 100 },
];

export const auditLogs: AuditLog[] = [
  { id: "l1", at: "2026-06-02 13:15", actor: "Marcus Bell", role: "engineer", action: "Uploaded before-photos", entity: "JOB-2026-0301", ip: "10.0.4.21" },
  { id: "l2", at: "2026-06-01 09:30", actor: "Hana Kim", role: "inventory", action: "Reserved 2 items", entity: "SR-2026-0142", ip: "10.0.2.10" },
  { id: "l3", at: "2026-05-31 08:55", actor: "St. Mary's Hospital", role: "customer", action: "Approved estimate", entity: "EST-2026-0098", ip: "203.0.113.44" },
  { id: "l4", at: "2026-05-30 11:20", actor: "Sara Lin", role: "estimator", action: "Created estimate", entity: "EST-2026-0098", ip: "10.0.3.18" },
  { id: "l5", at: "2026-05-28 09:12", actor: "Priya Nair", role: "coordinator", action: "Created service request", entity: "SR-2026-0142", ip: "10.0.1.05" },
  { id: "l6", at: "2026-05-27 16:40", actor: "Alex Morgan", role: "admin", action: "Updated RBAC policy", entity: "settings/roles", ip: "10.0.0.02" },
];

export const revenueTrend = [
  { month: "Jan", revenue: 42000, jobs: 38 },
  { month: "Feb", revenue: 48500, jobs: 44 },
  { month: "Mar", revenue: 51200, jobs: 49 },
  { month: "Apr", revenue: 47800, jobs: 46 },
  { month: "May", revenue: 56400, jobs: 53 },
  { month: "Jun", revenue: 61200, jobs: 58 },
];

export const jobsByType = [
  { type: "Repair", count: 42 },
  { type: "Maintenance", count: 36 },
  { type: "Calibration", count: 21 },
  { type: "Inspection", count: 18 },
  { type: "Installation", count: 9 },
];
