/** Marker prefix for demo-seeded records (safe to delete on "Remove demo data"). */
export const DEMO_PREFIX = "DEMO-";

export const DEMO_BRANCHES = [
  { key: "b1", name: "Central Hub", city: "Austin", phone: "+1 512-555-0110" },
  { key: "b2", name: "North Depot", city: "Dallas", phone: "+1 214-555-0177" },
  { key: "b3", name: "Gulf Service Center", city: "Houston", phone: "+1 713-555-0199" },
] as const;

export const DEMO_CUSTOMERS = [
  { key: "c1", name: "St. Mary's Hospital", type: "Hospital" as const, contactPerson: "Dr. Ellen Park", email: "facilities@stmarys.org", phone: "+1 512-555-2010", address: "1200 Medical Center Dr", city: "Austin", country: "United States", branchKey: "b1", equipmentCount: 42, activeJobs: 3, status: "active" as const },
  { key: "c2", name: "Brighton Diagnostics", type: "DiagnosticLab" as const, contactPerson: "Omar Reyes", email: "ops@brightondx.com", phone: "+1 214-555-3320", address: "450 Lab Parkway", city: "Dallas", country: "United States", branchKey: "b2", equipmentCount: 18, activeJobs: 1, status: "active" as const },
  { key: "c3", name: "Lakeside Dental Group", type: "Dental" as const, contactPerson: "Tina Holt", email: "admin@lakesidedental.com", phone: "+1 713-555-4412", address: "88 Lakeside Ave", city: "Houston", country: "United States", branchKey: "b3", equipmentCount: 9, activeJobs: 0, status: "active" as const },
  { key: "c4", name: "Vista Research Institute", type: "Research" as const, contactPerson: "Dr. Yuki Sato", email: "lab@vistari.org", phone: "+1 512-555-5510", address: "210 Research Blvd", city: "Austin", country: "United States", branchKey: "b1", equipmentCount: 27, activeJobs: 2, status: "active" as const },
  { key: "c5", name: "Cedar Family Clinic", type: "Clinic" as const, contactPerson: "Rosa Mendez", email: "front@cedarclinic.com", phone: "+1 214-555-6600", address: "15 Cedar St", city: "Dallas", country: "United States", branchKey: "b2", equipmentCount: 6, activeJobs: 0, status: "inactive" as const },
];

export const DEMO_EQUIPMENT = [
  { key: "e1", assetTag: "MED-AX-2207", name: "MRI Scanner", model: "Magnetom Vida", manufacturer: "Siemens", category: "Imaging", serialNumber: "SN-MRI-99201", customerKey: "c1", location: "Radiology Wing 2", installDate: "2021-03-12", warrantyEnd: "2026-03-12", amcStatus: "active" as const, condition: "operational" as const, lastServiceDate: "2026-04-02" },
  { key: "e2", assetTag: "MED-AX-1180", name: "CT Scanner", model: "Revolution CT", manufacturer: "GE Healthcare", category: "Imaging", serialNumber: "SN-CT-44120", customerKey: "c1", location: "Radiology Wing 1", installDate: "2020-07-22", warrantyEnd: "2025-07-22", amcStatus: "expiring" as const, condition: "needsService" as const, lastServiceDate: "2026-02-15" },
  { key: "e3", assetTag: "MED-AX-3304", name: "Ventilator", model: "Servo-u", manufacturer: "Getinge", category: "Life Support", serialNumber: "SN-VEN-77310", customerKey: "c1", location: "ICU Bay 4", installDate: "2022-01-05", warrantyEnd: "2027-01-05", amcStatus: "active" as const, condition: "down" as const, lastServiceDate: "2026-05-20" },
  { key: "e4", assetTag: "MED-AX-5521", name: "Blood Analyzer", model: "cobas 6000", manufacturer: "Roche", category: "Diagnostics", serialNumber: "SN-BA-22018", customerKey: "c2", location: "Lab Room A", installDate: "2019-11-18", warrantyEnd: "2024-11-18", amcStatus: "expired" as const, condition: "operational" as const, lastServiceDate: "2026-01-30" },
  { key: "e5", assetTag: "MED-AX-6650", name: "Ultrasound", model: "LOGIQ E10", manufacturer: "GE Healthcare", category: "Imaging", serialNumber: "SN-US-66201", customerKey: "c4", location: "Diagnostics Lab", installDate: "2023-05-14", warrantyEnd: "2028-05-14", amcStatus: "active" as const, condition: "operational" as const, lastServiceDate: "2026-04-28" },
  { key: "e6", assetTag: "MED-AX-7740", name: "Dental X-Ray", model: "ORTHOPHOS S", manufacturer: "Dentsply Sirona", category: "Imaging", serialNumber: "SN-DX-31109", customerKey: "c3", location: "Suite 3", installDate: "2022-09-09", warrantyEnd: "2027-09-09", amcStatus: "none" as const, condition: "operational" as const, lastServiceDate: "2025-12-11" },
];

export const DEMO_USERS = [
  { username: "coordinator", name: "Priya Nair", email: "coordinator@mesms.io", role: "coordinator" as const, branchKey: "b1", avatarColor: "174 62% 47%" },
  { username: "inspector", name: "Daniel Cruz", email: "inspector@mesms.io", role: "inspector" as const, branchKey: "b1", avatarColor: "38 92% 50%" },
  { username: "estimator", name: "Sara Lin", email: "estimator@mesms.io", role: "estimator" as const, branchKey: "b2", avatarColor: "265 70% 55%" },
  { username: "engineer", name: "Marcus Bell", email: "engineer@mesms.io", role: "engineer" as const, branchKey: "b1", avatarColor: "152 62% 40%" },
  { username: "inventory", name: "Hana Kim", email: "inventory@mesms.io", role: "inventory" as const, branchKey: "b2", avatarColor: "200 80% 45%" },
  { username: "billing", name: "Leo Garcia", email: "billing@mesms.io", role: "billing" as const, branchKey: "b1", avatarColor: "20 85% 55%" },
  { username: "portal", name: "St. Mary's Hospital", email: "portal@stmarys.org", role: "customer" as const, customerKey: "c1", avatarColor: "205 90% 42%" },
];

export const DEMO_PASSWORD = "demo@123";

export const DEMO_SERVICE_REQUESTS = [
  { reference: "SR-2026-0142", customerKey: "c1", equipmentKey: "e3", equipmentName: "Ventilator (Servo-u)", branchKey: "b1", type: "Repair" as const, priority: "critical" as const, status: "inProgress" as const, description: "Unit fails self-test; alarm on power-up.", createdBy: "Priya Nair", createdAt: "2026-05-28", assignedTo: "Marcus Bell", slaDue: "2026-06-04" },
  { reference: "SR-2026-0141", customerKey: "c1", equipmentKey: "e2", equipmentName: "CT Scanner (Revolution)", branchKey: "b1", type: "Maintenance" as const, priority: "high" as const, status: "estimate" as const, description: "Quarterly PM + image artifact check.", createdBy: "Priya Nair", createdAt: "2026-05-30", assignedTo: "Daniel Cruz", slaDue: "2026-06-08" },
  { reference: "SR-2026-0140", customerKey: "c2", equipmentKey: "e4", equipmentName: "Blood Analyzer (cobas)", branchKey: "b2", type: "Calibration" as const, priority: "medium" as const, status: "approval" as const, description: "Annual calibration certification due.", createdBy: "Priya Nair", createdAt: "2026-05-31", assignedTo: "Daniel Cruz", slaDue: "2026-06-12" },
  { reference: "SR-2026-0139", customerKey: "c4", equipmentKey: "e5", equipmentName: "Ultrasound (LOGIQ)", branchKey: "b1", type: "Inspection" as const, priority: "low" as const, status: "inspection" as const, description: "Probe wear inspection requested.", createdBy: "Priya Nair", createdAt: "2026-06-01", assignedTo: "Daniel Cruz", slaDue: "2026-06-15" },
  { reference: "SR-2026-0138", customerKey: "c1", equipmentKey: "e1", equipmentName: "MRI Scanner (Vida)", branchKey: "b1", type: "Maintenance" as const, priority: "medium" as const, status: "new" as const, description: "Helium level monitoring + cold-head check.", createdBy: "Priya Nair", createdAt: "2026-06-02", slaDue: "2026-06-18" },
  { reference: "SR-2026-0137", customerKey: "c3", equipmentKey: "e6", equipmentName: "Dental X-Ray (S)", branchKey: "b3", type: "Installation" as const, priority: "low" as const, status: "completed" as const, description: "New sensor install + commissioning.", createdBy: "Priya Nair", createdAt: "2026-05-20", assignedTo: "Marcus Bell", slaDue: "2026-05-30" },
  { reference: "SR-2026-0136", customerKey: "c2", equipmentKey: "e4", equipmentName: "Blood Analyzer (cobas)", branchKey: "b2", type: "Repair" as const, priority: "high" as const, status: "invoiced" as const, description: "Pump module replacement.", createdBy: "Priya Nair", createdAt: "2026-05-12", assignedTo: "Marcus Bell", slaDue: "2026-05-22" },
];

export const DEMO_ESTIMATES = [
  { reference: "EST-2026-0098", requestRef: "SR-2026-0141", customerName: "St. Mary's Hospital", equipmentName: "CT Scanner", laborCost: 1200, partsCost: 1280, total: 2480, status: "sent" as const, createdAt: "2026-05-30", validUntil: "2026-06-14", revision: 1 },
  { reference: "EST-2026-0097", requestRef: "SR-2026-0140", customerName: "Brighton Diagnostics", equipmentName: "Blood Analyzer", laborCost: 600, partsCost: 340, total: 940, status: "approved" as const, createdAt: "2026-05-29", validUntil: "2026-06-12", revision: 1 },
  { reference: "EST-2026-0096", requestRef: "SR-2026-0142", customerName: "St. Mary's Hospital", equipmentName: "Ventilator", laborCost: 900, partsCost: 1850, total: 2750, status: "revision" as const, createdAt: "2026-05-31", validUntil: "2026-06-15", revision: 2 },
  { reference: "EST-2026-0095", requestRef: "SR-2026-0139", customerName: "Vista Research Institute", equipmentName: "Ultrasound", laborCost: 450, partsCost: 0, total: 450, status: "draft" as const, createdAt: "2026-06-01", validUntil: "2026-06-16", revision: 1 },
];

export const DEMO_JOBS = [
  { reference: "JOB-2026-0301", requestRef: "SR-2026-0142", customerName: "St. Mary's Hospital", equipmentName: "Ventilator", engineer: "Marcus Bell", type: "Repair" as const, status: "inProgress" as const, scheduledFor: "2026-06-03", progress: 55 },
  { reference: "JOB-2026-0300", requestRef: "SR-2026-0140", customerName: "Brighton Diagnostics", equipmentName: "Blood Analyzer", engineer: "Marcus Bell", type: "Calibration" as const, status: "scheduled" as const, scheduledFor: "2026-06-05", progress: 0 },
  { reference: "JOB-2026-0299", requestRef: "SR-2026-0141", customerName: "St. Mary's Hospital", equipmentName: "CT Scanner", engineer: "Marcus Bell", type: "Maintenance" as const, status: "partsPending" as const, scheduledFor: "2026-06-06", progress: 30 },
  { reference: "JOB-2026-0298", requestRef: "SR-2026-0139", customerName: "Vista Research Institute", equipmentName: "Ultrasound", engineer: "Marcus Bell", type: "Inspection" as const, status: "review" as const, scheduledFor: "2026-06-02", progress: 90 },
  { reference: "JOB-2026-0297", requestRef: "SR-2026-0137", customerName: "Lakeside Dental Group", equipmentName: "Dental X-Ray", engineer: "Marcus Bell", type: "Installation" as const, status: "completed" as const, scheduledFor: "2026-05-28", progress: 100 },
];

export const DEMO_INVENTORY = [
  { sku: "PRT-PUMP-009", name: "Infusion Pump Module", category: "Modules", branchKey: "b1", inStock: 12, reserved: 3, reorderLevel: 5, unitCost: 480, supplier: "MedParts Global" },
  { sku: "PRT-SNSR-220", name: "Ultrasound Probe Sensor", category: "Sensors", branchKey: "b1", inStock: 4, reserved: 1, reorderLevel: 6, unitCost: 920, supplier: "Acme Medical Supply" },
  { sku: "PRT-FLTR-130", name: "HEPA Filter Cartridge", category: "Consumables", branchKey: "b2", inStock: 38, reserved: 0, reorderLevel: 15, unitCost: 45, supplier: "FilterTech" },
  { sku: "PRT-BRD-512", name: "Control Board (CT)", category: "Boards", branchKey: "b1", inStock: 2, reserved: 2, reorderLevel: 3, unitCost: 1640, supplier: "MedParts Global" },
  { sku: "PRT-CAL-077", name: "Calibration Kit", category: "Tools", branchKey: "b2", inStock: 9, reserved: 1, reorderLevel: 4, unitCost: 210, supplier: "CalibPro" },
  { sku: "PRT-CBL-300", name: "Power Cable Assembly", category: "Consumables", branchKey: "b3", inStock: 1, reserved: 0, reorderLevel: 10, unitCost: 65, supplier: "FilterTech" },
];

export const DEMO_SUPPLIERS = [
  { name: "MedParts Global", contact: "Janet Wu", email: "sales@medpartsglobal.com", phone: "+1 800-555-1200", category: "OEM Parts", rating: 4.8, openOrders: 2 },
  { name: "Acme Medical Supply", contact: "Tom Reed", email: "orders@acmemed.com", phone: "+1 800-555-1330", category: "Sensors & Probes", rating: 4.5, openOrders: 1 },
  { name: "FilterTech", contact: "Lia Bose", email: "hello@filtertech.io", phone: "+1 800-555-1440", category: "Consumables", rating: 4.2, openOrders: 0 },
  { name: "CalibPro", contact: "Raj Patel", email: "support@calibpro.com", phone: "+1 800-555-1550", category: "Calibration", rating: 4.9, openOrders: 1 },
];

export const DEMO_PURCHASE_ORDERS = [
  { reference: "PO-2026-0211", supplier: "MedParts Global", items: 4, total: 6840, status: "sent" as const, createdAt: "2026-05-29", expectedDate: "2026-06-09" },
  { reference: "PO-2026-0210", supplier: "Acme Medical Supply", items: 2, total: 1840, status: "received" as const, createdAt: "2026-05-22", expectedDate: "2026-06-01" },
  { reference: "PO-2026-0209", supplier: "CalibPro", items: 1, total: 210, status: "partial" as const, createdAt: "2026-05-25", expectedDate: "2026-06-05" },
  { reference: "PO-2026-0208", supplier: "FilterTech", items: 6, total: 390, status: "draft" as const, createdAt: "2026-06-01", expectedDate: "2026-06-12" },
];

export const DEMO_STOCK_TRANSFERS = [
  { reference: "TR-2026-0044", fromBranch: "Central Hub", toBranch: "North Depot", items: 3, status: "inTransit" as const, createdAt: "2026-06-01" },
  { reference: "TR-2026-0043", fromBranch: "North Depot", toBranch: "Gulf Service Center", items: 5, status: "received" as const, createdAt: "2026-05-28" },
  { reference: "TR-2026-0042", fromBranch: "Central Hub", toBranch: "Gulf Service Center", items: 2, status: "pending" as const, createdAt: "2026-06-02" },
];

export const DEMO_INVOICES = [
  { reference: "INV-2026-0521", customerName: "Brighton Diagnostics", jobRef: "SR-2026-0136", amount: 1840, tax: 147, total: 1987, status: "paid" as const, issuedAt: "2026-05-23", dueAt: "2026-06-06" },
  { reference: "INV-2026-0520", customerName: "Lakeside Dental Group", jobRef: "SR-2026-0137", amount: 2200, tax: 176, total: 2376, status: "sent" as const, issuedAt: "2026-05-30", dueAt: "2026-06-13" },
  { reference: "INV-2026-0519", customerName: "St. Mary's Hospital", jobRef: "SR-2026-0130", amount: 3400, tax: 272, total: 3672, status: "overdue" as const, issuedAt: "2026-05-02", dueAt: "2026-05-16" },
  { reference: "INV-2026-0518", customerName: "Vista Research Institute", jobRef: "SR-2026-0128", amount: 760, tax: 61, total: 821, status: "draft" as const, issuedAt: "2026-06-01", dueAt: "2026-06-15" },
];

export const DEMO_AUDIT_LOGS = [
  { at: "2026-06-02 13:15", actor: "Marcus Bell", role: "engineer", action: "Uploaded before-photos", entity: "JOB-2026-0301", ip: "10.0.4.21" },
  { at: "2026-06-01 09:30", actor: "Hana Kim", role: "inventory", action: "Reserved 2 items", entity: "SR-2026-0142", ip: "10.0.2.10" },
  { at: "2026-05-31 08:55", actor: "St. Mary's Hospital", role: "customer", action: "Approved estimate", entity: "EST-2026-0098", ip: "203.0.113.44" },
  { at: "2026-05-30 11:20", actor: "Sara Lin", role: "estimator", action: "Created estimate", entity: "EST-2026-0098", ip: "10.0.3.18" },
  { at: "2026-05-28 09:12", actor: "Priya Nair", role: "coordinator", action: "Created service request", entity: "SR-2026-0142", ip: "10.0.1.05" },
  { at: "2026-05-27 16:40", actor: "Alex Morgan", role: "admin", action: "Updated RBAC policy", entity: "settings/roles", ip: "10.0.0.02" },
];

export const DEMO_TIMELINE = [
  { at: "2026-05-28 09:12", actor: "Priya Nair", action: "Service request created", note: "On behalf of St. Mary's Hospital" },
  { at: "2026-05-28 10:40", actor: "Priya Nair", action: "Inspector assigned", note: "Daniel Cruz" },
  { at: "2026-05-29 14:05", actor: "Daniel Cruz", action: "Inspection completed", note: "4 photos, 1 video uploaded" },
  { at: "2026-05-30 11:20", actor: "Sara Lin", action: "Estimate generated", note: "EST-2026-0098 — ₹2,480" },
  { at: "2026-05-31 08:55", actor: "St. Mary's Hospital", action: "Estimate approved", note: "Via customer portal" },
];

export const DEMO_MODULES = [
  "Customers",
  "Equipment & Machines",
  "Service Requests",
  "MRI Scanner (Siemens)",
  "Estimates & Approvals",
  "Service Jobs",
  "Inventory",
  "Suppliers",
  "Purchase Orders",
  "Stock Transfers",
  "Billing & Invoicing",
  "Audit Logs",
  "User Management",
] as const;

export function demoRef(ref: string): string {
  return ref.startsWith(DEMO_PREFIX) ? ref : `${DEMO_PREFIX}${ref}`;
}

export function demoAssetTag(tag: string): string {
  return tag.startsWith(DEMO_PREFIX) ? tag : `${DEMO_PREFIX}${tag}`;
}

export function demoSku(sku: string): string {
  return sku.startsWith(DEMO_PREFIX) ? sku : `${DEMO_PREFIX}${sku}`;
}

export function parseDemoDate(value: string): Date {
  if (value.includes(" ")) {
    const [datePart, timePart] = value.split(" ");
    return new Date(`${datePart}T${timePart}:00`);
  }
  return new Date(`${value}T12:00:00`);
}
