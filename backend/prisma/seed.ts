import { PrismaClient, type UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import path from "path";
import { DEFAULT_RBAC_MATRIX } from "../src/config/defaultRbac";
import { DEFAULT_TAXONOMY_TERMS, TAXONOMY_TYPES } from "../src/config/taxonomyDefaults";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const prisma = new PrismaClient();
const TENANT_ID = process.env.DEFAULT_TENANT_ID ?? "tenant_medtech_01";

const ADMIN_USERNAME = "medical_equment";
const ADMIN_PASSWORD = "medical@961";
const ADMIN_EMAIL = "admin@mesms.io";
const DEMO_PASSWORD = "demo@123";

const daysFromNow = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
};

const daysAgo = (days: number) => daysFromNow(-days);

async function main() {
  console.log("Seeding database with dummy data...");

  // ── Tenant ────────────────────────────────────────────────────────────────
  await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    update: { name: "MedTech Services Inc." },
    create: { id: TENANT_ID, name: "MedTech Services Inc." },
  });

  for (const type of TAXONOMY_TYPES) {
    for (const term of DEFAULT_TAXONOMY_TERMS[type]) {
      const existing = await prisma.taxonomyTerm.findFirst({
        where: { tenantId: TENANT_ID, type, slug: term.slug },
      });
      if (existing) continue;
      let parentId: string | undefined;
      if (term.parentSlug) {
        const parent = await prisma.taxonomyTerm.findFirst({
          where: { tenantId: TENANT_ID, type: "inventory_category", slug: term.parentSlug },
        });
        parentId = parent?.id;
      }
      await prisma.taxonomyTerm.create({
        data: {
          tenantId: TENANT_ID,
          type,
          name: term.name,
          slug: term.slug,
          sortOrder: term.sortOrder,
          parentId,
          isActive: true,
          isSystem: true,
        },
      });
    }
  }

  // ── Branches ──────────────────────────────────────────────────────────────
  const branchDefs = [
    { key: "hq", name: "Main HQ", city: "New York", phone: "555-0100" },
    { key: "west", name: "West Coast Hub", city: "Los Angeles", phone: "555-0200" },
    { key: "midwest", name: "Midwest Depot", city: "Chicago", phone: "555-0300" },
  ] as const;

  const branches: Record<string, { id: string; name: string }> = {};
  for (const b of branchDefs) {
    let branch = await prisma.branch.findFirst({
      where: { tenantId: TENANT_ID, name: b.name },
    });
    if (!branch) {
      branch = await prisma.branch.create({
        data: {
          tenantId: TENANT_ID,
          name: b.name,
          city: b.city,
          phone: b.phone,
        },
      });
    }
    branches[b.key] = { id: branch.id, name: branch.name };
  }

  // ── Roles ─────────────────────────────────────────────────────────────────
  const systemRoles = [
    ["admin", "Administrator"],
    ["coordinator", "Service Coordinator"],
    ["inspector", "Inspector"],
    ["estimator", "Estimate Staff"],
    ["sales", "Sales Staff"],
    ["engineer", "Service Engineer"],
    ["inventory", "Inventory Staff"],
    ["billing", "Billing Staff"],
    ["customer", "Customer"],
  ] as const;

  const roleIds: Record<string, string> = {};
  for (const [key, name] of systemRoles) {
    const role = await prisma.role.upsert({
      where: { tenantId_key: { tenantId: TENANT_ID, key } },
      update: { name, isSystem: true },
      create: { tenantId: TENANT_ID, key, name, isSystem: true, permissions: {} },
    });
    roleIds[key] = role.id;
  }

  // ── Users ─────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const demoHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const admin = await prisma.user.upsert({
    where: { tenantId_username: { tenantId: TENANT_ID, username: ADMIN_USERNAME } },
    update: {
      name: "System Administrator",
      email: ADMIN_EMAIL,
      passwordHash,
      role: "admin",
      branchId: branches.hq.id,
    },
    create: {
      tenantId: TENANT_ID,
      name: "System Administrator",
      username: ADMIN_USERNAME,
      email: ADMIN_EMAIL,
      passwordHash,
      role: "admin",
      branchId: branches.hq.id,
      avatarColor: "205 90% 42%",
    },
  });

  const staffDefs: Array<{
    username: string;
    name: string;
    email: string;
    role: UserRole;
    branchKey: keyof typeof branches;
    color: string;
  }> = [
    {
      username: "coordinator1",
      name: "Sarah Chen",
      email: "sarah.chen@mesms.io",
      role: "coordinator",
      branchKey: "hq",
      color: "160 70% 40%",
    },
    {
      username: "inspector1",
      name: "Mike Torres",
      email: "mike.torres@mesms.io",
      role: "inspector",
      branchKey: "hq",
      color: "30 80% 45%",
    },
    {
      username: "estimator1",
      name: "Priya Patel",
      email: "priya.patel@mesms.io",
      role: "estimator",
      branchKey: "hq",
      color: "280 60% 45%",
    },
    {
      username: "sales1",
      name: "Noah Adler",
      email: "noah.adler@mesms.io",
      role: "sales",
      branchKey: "hq",
      color: "25 85% 45%",
    },
    {
      username: "engineer1",
      name: "James Wilson",
      email: "james.wilson@mesms.io",
      role: "engineer",
      branchKey: "hq",
      color: "200 75% 40%",
    },
    {
      username: "engineer2",
      name: "Aisha Rahman",
      email: "aisha.rahman@mesms.io",
      role: "engineer",
      branchKey: "west",
      color: "340 70% 45%",
    },
    {
      username: "inventory1",
      name: "Chris Nguyen",
      email: "chris.nguyen@mesms.io",
      role: "inventory",
      branchKey: "midwest",
      color: "90 50% 40%",
    },
    {
      username: "billing1",
      name: "Elena Vargas",
      email: "elena.vargas@mesms.io",
      role: "billing",
      branchKey: "hq",
      color: "45 80% 42%",
    },
  ];

  const users: Record<string, { id: string; name: string }> = {
    admin: { id: admin.id, name: admin.name },
  };

  for (const u of staffDefs) {
    const user = await prisma.user.upsert({
      where: { tenantId_username: { tenantId: TENANT_ID, username: u.username } },
      update: {
        name: u.name,
        email: u.email,
        passwordHash: demoHash,
        role: u.role,
        branchId: branches[u.branchKey].id,
      },
      create: {
        tenantId: TENANT_ID,
        name: u.name,
        username: u.username,
        email: u.email,
        passwordHash: demoHash,
        role: u.role,
        branchId: branches[u.branchKey].id,
        avatarColor: u.color,
      },
    });
    users[u.username] = { id: user.id, name: user.name };

    const assignment = await prisma.userRoleAssignment.findFirst({
      where: {
        tenantId: TENANT_ID,
        userId: user.id,
        roleId: roleIds[u.role],
        branchId: null,
      },
    });
    if (!assignment) {
      await prisma.userRoleAssignment.create({
        data: {
          tenantId: TENANT_ID,
          userId: user.id,
          roleId: roleIds[u.role],
        },
      });
    }
  }

  const adminAssignment = await prisma.userRoleAssignment.findFirst({
    where: {
      tenantId: TENANT_ID,
      userId: admin.id,
      roleId: roleIds.admin,
      branchId: null,
    },
  });
  if (!adminAssignment) {
    await prisma.userRoleAssignment.create({
      data: { tenantId: TENANT_ID, userId: admin.id, roleId: roleIds.admin },
    });
  }

  // ── Tenant settings ───────────────────────────────────────────────────────
  await prisma.tenantSettings.upsert({
    where: { tenantId: TENANT_ID },
    update: {},
    create: {
      tenantId: TENANT_ID,
      supportEmail: "support@mesms.io",
      defaultTaxRate: 8,
      rbacMatrix: DEFAULT_RBAC_MATRIX as never,
    },
  });

  // ── Service catalog ───────────────────────────────────────────────────────
  const catalogDefs = [
    { code: "INSPECTION", name: "Equipment Inspection", category: "Inspection", unitPrice: 150, unit: "service" },
    { code: "REPAIR-LABOR", name: "Repair Labor", category: "Repair", unitPrice: 95, unit: "hour" },
    { code: "CALIBRATION", name: "Equipment Calibration", category: "Calibration", unitPrice: 250, unit: "service" },
    { code: "PM-VISIT", name: "Preventive Maintenance Visit", category: "Maintenance", unitPrice: 320, unit: "service" },
    { code: "INSTALL", name: "Equipment Installation", category: "Installation", unitPrice: 450, unit: "service" },
    { code: "TRAVEL", name: "On-site Travel Fee", category: "Other", unitPrice: 75, unit: "trip" },
  ];

  const catalog: Record<string, string> = {};
  for (const service of catalogDefs) {
    const item = await prisma.serviceCatalogItem.upsert({
      where: { tenantId_code: { tenantId: TENANT_ID, code: service.code } },
      update: {
        name: service.name,
        category: service.category,
        unitPrice: service.unitPrice,
        unit: service.unit,
      },
      create: { tenantId: TENANT_ID, taxRate: 8, ...service },
    });
    catalog[service.code] = item.id;
  }

  // ── Customers ─────────────────────────────────────────────────────────────
  const customerDefs = [
    {
      key: "citygen",
      name: "City General Hospital",
      type: "Hospital" as const,
      contactPerson: "Dr. Rachel Adams",
      email: "rachel.adams@citygen.example",
      phone: "555-1001",
      address: "100 Hospital Way",
      city: "New York",
      country: "United States",
      branchKey: "hq" as const,
    },
    {
      key: "sunrise",
      name: "Sunrise Family Clinic",
      type: "Clinic" as const,
      contactPerson: "Tom Bradley",
      email: "tom.bradley@sunrise.example",
      phone: "555-1002",
      address: "42 Sunrise Blvd",
      city: "Brooklyn",
      country: "United States",
      branchKey: "hq" as const,
    },
    {
      key: "pacific",
      name: "Pacific Diagnostics Lab",
      type: "DiagnosticLab" as const,
      contactPerson: "Linda Cho",
      email: "linda.cho@pacificdx.example",
      phone: "555-1003",
      address: "900 Pacific Ave",
      city: "Los Angeles",
      country: "United States",
      branchKey: "west" as const,
    },
    {
      key: "midwest-research",
      name: "Midwest Research Institute",
      type: "Research" as const,
      contactPerson: "Dr. Omar Hassan",
      email: "omar.hassan@mri.example",
      phone: "555-1004",
      address: "55 Research Park Dr",
      city: "Chicago",
      country: "United States",
      branchKey: "midwest" as const,
    },
    {
      key: "brightsmile",
      name: "BrightSmile Dental Center",
      type: "Dental" as const,
      contactPerson: "Dr. Nina Park",
      email: "nina.park@brightsmile.example",
      phone: "555-1005",
      address: "12 Smile Lane",
      city: "Queens",
      country: "United States",
      branchKey: "hq" as const,
    },
  ];

  const customers: Record<string, { id: string; name: string; branchId: string }> = {};
  let customerRefSeq = await prisma.customer.count({ where: { tenantId: TENANT_ID } });
  const customerRefYear = new Date().getFullYear();
  const nextCustomerRef = () => {
    customerRefSeq += 1;
    return `CUST-${customerRefYear}-${String(customerRefSeq).padStart(4, "0")}`;
  };

  for (const c of customerDefs) {
    let customer = await prisma.customer.findFirst({
      where: { tenantId: TENANT_ID, email: c.email },
    });
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          tenantId: TENANT_ID,
          reference: nextCustomerRef(),
          name: c.name,
          type: c.type,
          contactPerson: c.contactPerson,
          email: c.email,
          phone: c.phone,
          address: c.address,
          city: c.city,
          country: c.country,
          branchId: branches[c.branchKey].id,
          status: "active",
        },
      });
    }
    customers[c.key] = {
      id: customer.id,
      name: customer.name,
      branchId: customer.branchId,
    };
  }

  // ── Equipment ─────────────────────────────────────────────────────────────
  const equipmentDefs = [
    {
      assetTag: "EQ-MRI-001",
      name: "MRI Scanner",
      model: "Magnetom Vida",
      manufacturer: "Siemens",
      category: "imaging",
      serialNumber: "SN-MRI-88421",
      customerKey: "citygen",
      location: "Radiology Wing A",
      installDate: daysAgo(900),
      warrantyEnd: daysFromNow(120),
      amcStatus: "active" as const,
      condition: "operational" as const,
      lastServiceDate: daysAgo(45),
    },
    {
      assetTag: "EQ-CT-002",
      name: "CT Scanner",
      model: "Revolution Ascend",
      manufacturer: "GE Healthcare",
      category: "imaging",
      serialNumber: "SN-CT-55210",
      customerKey: "citygen",
      location: "Radiology Wing B",
      installDate: daysAgo(600),
      warrantyEnd: daysAgo(30),
      amcStatus: "expiring" as const,
      condition: "needsService" as const,
      lastServiceDate: daysAgo(120),
    },
    {
      assetTag: "EQ-US-003",
      name: "Ultrasound System",
      model: "LOGIQ E10",
      manufacturer: "GE Healthcare",
      category: "imaging",
      serialNumber: "SN-US-11902",
      customerKey: "sunrise",
      location: "Exam Room 3",
      installDate: daysAgo(400),
      warrantyEnd: daysFromNow(200),
      amcStatus: "active" as const,
      condition: "operational" as const,
      lastServiceDate: daysAgo(20),
    },
    {
      assetTag: "EQ-ANALYZER-004",
      name: "Chemistry Analyzer",
      model: "Cobas 8000",
      manufacturer: "Roche",
      category: "Lab",
      serialNumber: "SN-LAB-33011",
      customerKey: "pacific",
      location: "Main Lab Floor",
      installDate: daysAgo(750),
      warrantyEnd: daysAgo(100),
      amcStatus: "expired" as const,
      condition: "down" as const,
      lastServiceDate: daysAgo(200),
    },
    {
      assetTag: "EQ-VENT-005",
      name: "ICU Ventilator",
      model: "Servo-u",
      manufacturer: "Getinge",
      category: "Critical Care",
      serialNumber: "SN-VENT-77120",
      customerKey: "citygen",
      location: "ICU Bay 4",
      installDate: daysAgo(300),
      warrantyEnd: daysFromNow(400),
      amcStatus: "active" as const,
      condition: "operational" as const,
      lastServiceDate: daysAgo(10),
    },
    {
      assetTag: "EQ-XR-006",
      name: "Digital X-Ray",
      model: "DRX-Evolution",
      manufacturer: "Carestream",
      category: "imaging",
      serialNumber: "SN-XR-44088",
      customerKey: "midwest-research",
      location: "Imaging Suite 1",
      installDate: daysAgo(500),
      warrantyEnd: daysFromNow(60),
      amcStatus: "none" as const,
      condition: "needsService" as const,
      lastServiceDate: daysAgo(90),
    },
    {
      assetTag: "EQ-DENTAL-007",
      name: "Dental Chair Unit",
      model: "A-dec 500",
      manufacturer: "A-dec",
      category: "Dental",
      serialNumber: "SN-DEN-22881",
      customerKey: "brightsmile",
      location: "Operatory 2",
      installDate: daysAgo(250),
      warrantyEnd: daysFromNow(300),
      amcStatus: "active" as const,
      condition: "operational" as const,
      lastServiceDate: daysAgo(35),
    },
  ];

  const equipment: Record<string, { id: string; name: string; assetTag: string; customerKey: string }> = {};
  for (const e of equipmentDefs) {
    const customer = customers[e.customerKey];
    const item = await prisma.equipment.upsert({
      where: { tenantId_assetTag: { tenantId: TENANT_ID, assetTag: e.assetTag } },
      update: {
        name: e.name,
        model: e.model,
        manufacturer: e.manufacturer,
        category: e.category,
        serialNumber: e.serialNumber,
        customerId: customer.id,
        customerName: customer.name,
        branchId: customer.branchId,
        location: e.location,
        installDate: e.installDate,
        warrantyEnd: e.warrantyEnd,
        amcStatus: e.amcStatus,
        condition: e.condition,
        lastServiceDate: e.lastServiceDate,
      },
      create: {
        tenantId: TENANT_ID,
        assetTag: e.assetTag,
        name: e.name,
        model: e.model,
        manufacturer: e.manufacturer,
        category: e.category,
        serialNumber: e.serialNumber,
        customerId: customer.id,
        customerName: customer.name,
        branchId: customer.branchId,
        location: e.location,
        installDate: e.installDate,
        warrantyEnd: e.warrantyEnd,
        amcStatus: e.amcStatus,
        condition: e.condition,
        lastServiceDate: e.lastServiceDate,
      },
    });
    equipment[e.assetTag] = {
      id: item.id,
      name: item.name,
      assetTag: item.assetTag,
      customerKey: e.customerKey,
    };
  }

  // Update customer equipment counts
  for (const c of Object.values(customers)) {
    const count = await prisma.equipment.count({
      where: { tenantId: TENANT_ID, customerId: c.id },
    });
    await prisma.customer.update({
      where: { id: c.id },
      data: { equipmentCount: count },
    });
  }

  // ── Suppliers & inventory ─────────────────────────────────────────────────
  const supplierDefs = [
    {
      key: "medparts",
      name: "MedParts Wholesale",
      contact: "Kevin Brooks",
      email: "sales@medparts.example",
      phone: "555-2001",
      category: "Spare Parts",
      rating: 4.5,
    },
    {
      key: "calibpro",
      name: "CalibPro Instruments",
      contact: "Amy Foster",
      email: "orders@calibpro.example",
      phone: "555-2002",
      category: "Calibration Tools",
      rating: 4.8,
    },
    {
      key: "oem-siemens",
      name: "Siemens Healthineers Parts",
      contact: "OEM Desk",
      email: "parts@siemens-health.example",
      phone: "555-2003",
      category: "OEM Parts",
      rating: 4.2,
    },
  ];

  const suppliers: Record<string, { id: string; name: string }> = {};
  for (const s of supplierDefs) {
    let supplier = await prisma.supplier.findFirst({
      where: { tenantId: TENANT_ID, email: s.email },
    });
    if (!supplier) {
      supplier = await prisma.supplier.create({
        data: {
          tenantId: TENANT_ID,
          name: s.name,
          contact: s.contact,
          email: s.email,
          phone: s.phone,
          category: s.category,
          rating: s.rating,
        },
      });
    }
    suppliers[s.key] = { id: supplier.id, name: supplier.name };
  }

  const inventoryDefs = [
    {
      sku: "PART-XRAY-TUBE",
      name: "X-Ray Tube Assembly",
      category: "Imaging Parts",
      branchKey: "hq" as const,
      inStock: 4,
      reserved: 1,
      reorderLevel: 2,
      unitCost: 4200,
      supplier: "MedParts Wholesale",
    },
    {
      sku: "PART-VENT-SENSOR",
      name: "Ventilator Flow Sensor",
      category: "Critical Care Parts",
      branchKey: "hq" as const,
      inStock: 18,
      reserved: 2,
      reorderLevel: 5,
      unitCost: 185,
      supplier: "MedParts Wholesale",
    },
    {
      sku: "PART-US-PROBE",
      name: "Ultrasound Probe Cover Kit",
      category: "Imaging Parts",
      branchKey: "west" as const,
      inStock: 40,
      reserved: 0,
      reorderLevel: 10,
      unitCost: 28,
      supplier: "MedParts Wholesale",
    },
    {
      sku: "CAL-PHANTOM-MRI",
      name: "MRI Calibration Phantom",
      category: "Calibration",
      branchKey: "midwest" as const,
      inStock: 2,
      reserved: 0,
      reorderLevel: 1,
      unitCost: 1500,
      supplier: "CalibPro Instruments",
    },
    {
      sku: "PART-CT-DETECTOR",
      name: "CT Detector Module",
      category: "Imaging Parts",
      branchKey: "hq" as const,
      inStock: 1,
      reserved: 1,
      reorderLevel: 1,
      unitCost: 6800,
      supplier: "Siemens Healthineers Parts",
    },
    {
      sku: "PART-FILTER-HEPA",
      name: "HEPA Filter Pack",
      category: "Consumables",
      branchKey: "midwest" as const,
      inStock: 55,
      reserved: 0,
      reorderLevel: 20,
      unitCost: 42,
      supplier: "MedParts Wholesale",
    },
  ];

  const inventory: Record<string, { id: string; sku: string; name: string; unitCost: number }> = {};
  for (const item of inventoryDefs) {
    const created = await prisma.inventoryItem.upsert({
      where: {
        tenantId_branchId_sku: {
          tenantId: TENANT_ID,
          branchId: branches[item.branchKey].id,
          sku: item.sku,
        },
      },
      update: {
        name: item.name,
        category: item.category,
        inStock: item.inStock,
        reserved: item.reserved,
        reorderLevel: item.reorderLevel,
        unitCost: item.unitCost,
        supplier: item.supplier,
      },
      create: {
        tenantId: TENANT_ID,
        sku: item.sku,
        name: item.name,
        category: item.category,
        branchId: branches[item.branchKey].id,
        inStock: item.inStock,
        reserved: item.reserved,
        reorderLevel: item.reorderLevel,
        unitCost: item.unitCost,
        supplier: item.supplier,
      },
    });
    inventory[item.sku] = {
      id: created.id,
      sku: created.sku,
      name: created.name,
      unitCost: item.unitCost,
    };
  }

  // ── Service requests ──────────────────────────────────────────────────────
  const requestDefs = [
    {
      reference: "SR-2026-0001",
      customerKey: "citygen",
      equipmentTag: "EQ-CT-002",
      type: "Repair" as const,
      priority: "high" as const,
      status: "inProgress" as const,
      description: "CT scanner intermittent image artifacts on helical scans.",
      assignedTo: "engineer1",
      slaDue: daysFromNow(2),
      createdAt: daysAgo(5),
    },
    {
      reference: "SR-2026-0002",
      customerKey: "pacific",
      equipmentTag: "EQ-ANALYZER-004",
      type: "Repair" as const,
      priority: "critical" as const,
      status: "inspection" as const,
      description: "Chemistry analyzer completely down — reagent arm fault.",
      assignedTo: "inspector1",
      slaDue: daysFromNow(1),
      createdAt: daysAgo(1),
    },
    {
      reference: "SR-2026-0003",
      customerKey: "sunrise",
      equipmentTag: "EQ-US-003",
      type: "Maintenance" as const,
      priority: "medium" as const,
      status: "estimate" as const,
      description: "Quarterly preventive maintenance and probe check.",
      assignedTo: "estimator1",
      slaDue: daysFromNow(7),
      createdAt: daysAgo(3),
    },
    {
      reference: "SR-2026-0004",
      customerKey: "citygen",
      equipmentTag: "EQ-MRI-001",
      type: "Calibration" as const,
      priority: "medium" as const,
      status: "completed" as const,
      description: "Annual MRI calibration and phantom verification.",
      assignedTo: "engineer1",
      slaDue: daysAgo(2),
      createdAt: daysAgo(14),
    },
    {
      reference: "SR-2026-0005",
      customerKey: "midwest-research",
      equipmentTag: "EQ-XR-006",
      type: "Inspection" as const,
      priority: "low" as const,
      status: "new" as const,
      description: "Routine safety inspection before research protocol start.",
      assignedTo: null,
      slaDue: daysFromNow(10),
      createdAt: daysAgo(0),
    },
    {
      reference: "SR-2026-0006",
      customerKey: "brightsmile",
      equipmentTag: "EQ-DENTAL-007",
      type: "Installation" as const,
      priority: "medium" as const,
      status: "invoiced" as const,
      description: "New dental chair installation and staff handover.",
      assignedTo: "engineer2",
      slaDue: daysAgo(5),
      createdAt: daysAgo(20),
    },
  ];

  const requests: Record<
    string,
    {
      id: string;
      reference: string;
      customerKey: string;
      equipmentTag: string;
      type: (typeof requestDefs)[number]["type"];
    }
  > = {};

  for (const r of requestDefs) {
    const customer = customers[r.customerKey];
    const eq = equipment[r.equipmentTag];
    const assignee = r.assignedTo ? users[r.assignedTo] : null;

    const request = await prisma.serviceRequest.upsert({
      where: { tenantId_reference: { tenantId: TENANT_ID, reference: r.reference } },
      update: {
        customerId: customer.id,
        customerName: customer.name,
        equipmentId: eq.id,
        equipmentName: eq.name,
        branchId: customer.branchId,
        type: r.type,
        priority: r.priority,
        status: r.status,
        description: r.description,
        createdBy: admin.name,
        assignedTo: assignee?.id ?? null,
        assignedName: assignee?.name ?? null,
        slaDue: r.slaDue,
      },
      create: {
        tenantId: TENANT_ID,
        reference: r.reference,
        customerId: customer.id,
        customerName: customer.name,
        equipmentId: eq.id,
        equipmentName: eq.name,
        branchId: customer.branchId,
        type: r.type,
        priority: r.priority,
        status: r.status,
        description: r.description,
        createdBy: admin.name,
        assignedTo: assignee?.id ?? null,
        assignedName: assignee?.name ?? null,
        slaDue: r.slaDue,
        createdAt: r.createdAt,
      },
    });

    const link = await prisma.serviceRequestEquipment.findFirst({
      where: { serviceRequestId: request.id, equipmentId: eq.id },
    });
    if (!link) {
      await prisma.serviceRequestEquipment.create({
        data: {
          serviceRequestId: request.id,
          equipmentId: eq.id,
          equipmentName: eq.name,
          assetTag: eq.assetTag,
        },
      });
    }

    requests[r.reference] = {
      id: request.id,
      reference: request.reference,
      customerKey: r.customerKey,
      equipmentTag: r.equipmentTag,
      type: r.type,
    };
  }

  // Inspection on SR-2026-0002
  const inspectSr = requests["SR-2026-0002"];
  let inspection = await prisma.inspectionReport.findUnique({
    where: { serviceRequestId: inspectSr.id },
  });
  if (!inspection) {
    inspection = await prisma.inspectionReport.create({
      data: {
        serviceRequestId: inspectSr.id,
        findings: "Reagent arm encoder fault; residual fluid detected in sample path.",
        recommendation: "Replace reagent arm encoder and flush sample path.",
        severity: "critical",
        machineCondition: "down",
        errorCodes: ["E-RA-204", "E-FLUID-11"],
        technicianRemarks: "Unit unsafe for patient testing until repaired.",
        reportedBy: users.inspector1.id,
        submittedAt: daysAgo(1),
      },
    });
    await prisma.inspectionRecommendation.createMany({
      data: [
        {
          inspectionReportId: inspection.id,
          catalogItemId: catalog["REPAIR-LABOR"],
          type: "labor",
          title: "Repair labor",
          description: "Diagnose and replace encoder assembly",
          priority: "critical",
          quantity: 4,
          estimatedCost: 380,
        },
        {
          inspectionReportId: inspection.id,
          inventoryItemId: inventory["PART-VENT-SENSOR"].id,
          type: "part",
          title: "Flow/path sensor kit",
          description: "Replacement sensor pack for fluid path",
          priority: "high",
          quantity: 1,
          estimatedCost: 185,
        },
      ],
    });
  }

  // ── Estimates ─────────────────────────────────────────────────────────────
  const estimateDefs = [
    {
      reference: "EST-2026-0001",
      requestRef: "SR-2026-0003",
      status: "sent" as const,
      laborCost: 190,
      partsCost: 56,
      discount: 0,
      taxRate: 0.08,
      validUntil: daysFromNow(14),
      lines: [
        {
          type: "labor",
          description: "Preventive maintenance labor",
          catalogCode: "PM-VISIT",
          quantity: 1,
          unitPrice: 320,
        },
        {
          type: "part",
          description: "Ultrasound probe cover kit",
          inventorySku: "PART-US-PROBE",
          quantity: 2,
          unitPrice: 28,
        },
      ],
    },
    {
      reference: "EST-2026-0002",
      requestRef: "SR-2026-0001",
      status: "approved" as const,
      laborCost: 475,
      partsCost: 6800,
      discount: 200,
      taxRate: 0.08,
      validUntil: daysFromNow(7),
      approvedAt: daysAgo(2),
      lines: [
        {
          type: "labor",
          description: "CT repair labor (5 hrs)",
          catalogCode: "REPAIR-LABOR",
          quantity: 5,
          unitPrice: 95,
        },
        {
          type: "part",
          description: "CT detector module",
          inventorySku: "PART-CT-DETECTOR",
          quantity: 1,
          unitPrice: 6800,
        },
      ],
    },
    {
      reference: "EST-2026-0003",
      requestRef: "SR-2026-0004",
      status: "approved" as const,
      laborCost: 250,
      partsCost: 0,
      discount: 0,
      taxRate: 0.08,
      validUntil: daysAgo(1),
      approvedAt: daysAgo(10),
      lines: [
        {
          type: "labor",
          description: "MRI calibration",
          catalogCode: "CALIBRATION",
          quantity: 1,
          unitPrice: 250,
        },
      ],
    },
  ];

  const estimates: Record<string, { id: string; reference: string; requestRef: string; total: number }> = {};

  for (const est of estimateDefs) {
    const sr = requests[est.requestRef];
    const customer = customers[sr.customerKey];
    const eq = equipment[sr.equipmentTag];
    const subtotal = est.laborCost + est.partsCost - est.discount;
    const tax = Number((subtotal * est.taxRate).toFixed(2));
    const total = Number((subtotal + tax).toFixed(2));

    const estimate = await prisma.estimate.upsert({
      where: { tenantId_reference: { tenantId: TENANT_ID, reference: est.reference } },
      update: {
        serviceRequestId: sr.id,
        customerId: customer.id,
        equipmentId: eq.id,
        requestRef: sr.reference,
        customerName: customer.name,
        equipmentName: eq.name,
        laborCost: est.laborCost,
        partsCost: est.partsCost,
        subtotal,
        discount: est.discount,
        tax,
        total,
        status: est.status,
        validUntil: est.validUntil,
        approvedAt: est.approvedAt ?? null,
        sentAt: daysAgo(4),
      },
      create: {
        tenantId: TENANT_ID,
        serviceRequestId: sr.id,
        customerId: customer.id,
        equipmentId: eq.id,
        reference: est.reference,
        requestRef: sr.reference,
        customerName: customer.name,
        equipmentName: eq.name,
        laborCost: est.laborCost,
        partsCost: est.partsCost,
        subtotal,
        discount: est.discount,
        tax,
        total,
        status: est.status,
        validUntil: est.validUntil,
        approvedAt: est.approvedAt ?? null,
        sentAt: daysAgo(4),
        terms: "Payment due within 30 days of invoice.",
        notes: "Dummy seed estimate",
      },
    });

    const existingLines = await prisma.estimateLineItem.count({
      where: { estimateId: estimate.id },
    });
    if (existingLines === 0) {
      for (const line of est.lines) {
        const lineTotal = Number((line.quantity * line.unitPrice).toFixed(2));
        await prisma.estimateLineItem.create({
          data: {
            estimateId: estimate.id,
            catalogItemId: line.catalogCode ? catalog[line.catalogCode] : null,
            inventoryItemId: line.inventorySku ? inventory[line.inventorySku].id : null,
            type: line.type,
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            taxRate: 8,
            lineTotal,
          },
        });
      }
    }

    estimates[est.reference] = {
      id: estimate.id,
      reference: estimate.reference,
      requestRef: est.requestRef,
      total,
    };
  }

  // ── Service jobs ──────────────────────────────────────────────────────────
  const jobDefs = [
    {
      reference: "JOB-2026-0001",
      requestRef: "SR-2026-0001",
      estimateRef: "EST-2026-0002",
      engineerKey: "engineer1",
      status: "inProgress" as const,
      scheduledFor: daysFromNow(0),
      progress: 55,
    },
    {
      reference: "JOB-2026-0002",
      requestRef: "SR-2026-0004",
      estimateRef: "EST-2026-0003",
      engineerKey: "engineer1",
      status: "completed" as const,
      scheduledFor: daysAgo(8),
      progress: 100,
    },
    {
      reference: "JOB-2026-0003",
      requestRef: "SR-2026-0006",
      estimateRef: null,
      engineerKey: "engineer2",
      status: "completed" as const,
      scheduledFor: daysAgo(15),
      progress: 100,
    },
    {
      reference: "JOB-2026-0004",
      requestRef: "SR-2026-0003",
      estimateRef: "EST-2026-0001",
      engineerKey: "engineer2",
      status: "scheduled" as const,
      scheduledFor: daysFromNow(3),
      progress: 0,
    },
  ];

  const jobs: Record<string, { id: string; reference: string; requestRef: string }> = {};

  for (const j of jobDefs) {
    const sr = requests[j.requestRef];
    const customer = customers[sr.customerKey];
    const eq = equipment[sr.equipmentTag];
    const engineer = users[j.engineerKey];
    const estimate = j.estimateRef ? estimates[j.estimateRef] : null;

    const job = await prisma.serviceJob.upsert({
      where: { tenantId_reference: { tenantId: TENANT_ID, reference: j.reference } },
      update: {
        serviceRequestId: sr.id,
        estimateId: estimate?.id ?? null,
        customerId: customer.id,
        equipmentId: eq.id,
        requestRef: sr.reference,
        customerName: customer.name,
        equipmentName: eq.name,
        engineer: engineer.name,
        engineerId: engineer.id,
        type: sr.type,
        status: j.status,
        scheduledFor: j.scheduledFor,
        progress: j.progress,
      },
      create: {
        tenantId: TENANT_ID,
        serviceRequestId: sr.id,
        estimateId: estimate?.id ?? null,
        customerId: customer.id,
        equipmentId: eq.id,
        reference: j.reference,
        requestRef: sr.reference,
        customerName: customer.name,
        equipmentName: eq.name,
        engineer: engineer.name,
        engineerId: engineer.id,
        type: sr.type,
        status: j.status,
        scheduledFor: j.scheduledFor,
        progress: j.progress,
      },
    });

    const assignment = await prisma.jobAssignment.findFirst({
      where: { jobId: job.id, userId: engineer.id, role: "engineer" },
    });
    if (!assignment) {
      await prisma.jobAssignment.create({
        data: {
          tenantId: TENANT_ID,
          jobId: job.id,
          userId: engineer.id,
          role: "engineer",
          isLead: true,
          assignedBy: admin.id,
        },
      });
    }

    if (j.status === "completed" || j.status === "inProgress") {
      const logs = await prisma.jobWorkLog.count({ where: { jobId: job.id } });
      if (logs === 0) {
        await prisma.jobWorkLog.create({
          data: {
            tenantId: TENANT_ID,
            jobId: job.id,
            userId: engineer.id,
            startedAt: daysAgo(j.status === "completed" ? 9 : 1),
            endedAt: j.status === "completed" ? daysAgo(8) : null,
            minutes: j.status === "completed" ? 180 : 90,
            workPerformed:
              j.status === "completed"
                ? "Completed scheduled service and verified equipment performance."
                : "Diagnosed fault and began parts replacement.",
            testingResult: j.status === "completed" ? "Pass" : "Pending",
          },
        });
      }
    }

    jobs[j.reference] = {
      id: job.id,
      reference: job.reference,
      requestRef: j.requestRef,
    };
  }

  // Update active job counts on customers
  for (const c of Object.values(customers)) {
    const activeJobs = await prisma.serviceJob.count({
      where: {
        tenantId: TENANT_ID,
        customerId: c.id,
        status: { in: ["scheduled", "inProgress", "partsPending", "review"] },
      },
    });
    await prisma.customer.update({
      where: { id: c.id },
      data: { activeJobs },
    });
  }

  // ── Purchase orders ───────────────────────────────────────────────────────
  const existingPo = await prisma.purchaseOrder.findUnique({
    where: { tenantId_reference: { tenantId: TENANT_ID, reference: "PO-2026-0001" } },
  });
  if (!existingPo) {
    const po = await prisma.purchaseOrder.create({
      data: {
        tenantId: TENANT_ID,
        supplierId: suppliers.medparts.id,
        branchId: branches.hq.id,
        reference: "PO-2026-0001",
        supplier: suppliers.medparts.name,
        items: 2,
        total: 4570,
        status: "sent",
        expectedDate: daysFromNow(5),
        lineItems: {
          create: [
            {
              inventoryItemId: inventory["PART-XRAY-TUBE"].id,
              sku: "PART-XRAY-TUBE",
              description: "X-Ray Tube Assembly",
              quantityOrdered: 1,
              unitCost: 4200,
              taxRate: 0,
              lineTotal: 4200,
            },
            {
              inventoryItemId: inventory["PART-VENT-SENSOR"].id,
              sku: "PART-VENT-SENSOR",
              description: "Ventilator Flow Sensor",
              quantityOrdered: 2,
              unitCost: 185,
              taxRate: 0,
              lineTotal: 370,
            },
          ],
        },
      },
    });
    await prisma.supplier.update({
      where: { id: suppliers.medparts.id },
      data: { openOrders: 1 },
    });
    void po;
  }

  // Stock transfers skipped: DB migrations are behind schema (from_branch_id etc.).

  // ── AMC contracts ─────────────────────────────────────────────────────────
  const amcDefs = [
    {
      reference: "AMC-2026-0001",
      customerName: customers.citygen.name,
      equipmentCount: 3,
      startDate: daysAgo(180),
      endDate: daysFromNow(185),
      value: 48000,
      visitsPerYear: 4,
      visitsDone: 2,
      status: "active" as const,
    },
    {
      reference: "AMC-2026-0002",
      customerName: customers.sunrise.name,
      equipmentCount: 1,
      startDate: daysAgo(300),
      endDate: daysFromNow(30),
      value: 7200,
      visitsPerYear: 2,
      visitsDone: 1,
      status: "expiring" as const,
    },
    {
      reference: "AMC-2026-0003",
      customerName: customers.pacific.name,
      equipmentCount: 1,
      startDate: daysAgo(400),
      endDate: daysAgo(40),
      value: 9600,
      visitsPerYear: 4,
      visitsDone: 4,
      status: "expired" as const,
    },
  ];

  for (const amc of amcDefs) {
    await prisma.amcContract.upsert({
      where: { tenantId_reference: { tenantId: TENANT_ID, reference: amc.reference } },
      update: { ...amc },
      create: { tenantId: TENANT_ID, ...amc },
    });
  }

  // ── Invoices ──────────────────────────────────────────────────────────────
  const invoiceDefs = [
    {
      reference: "INV-2026-0001",
      jobRef: "JOB-2026-0002",
      estimateRef: "EST-2026-0003",
      requestRef: "SR-2026-0004",
      status: "paid" as const,
      amount: 250,
      tax: 20,
      total: 270,
      paidTotal: 270,
      balanceDue: 0,
      dueAt: daysAgo(1),
      issuedAt: daysAgo(7),
    },
    {
      reference: "INV-2026-0002",
      jobRef: "JOB-2026-0003",
      estimateRef: null,
      requestRef: "SR-2026-0006",
      status: "sent" as const,
      amount: 450,
      tax: 36,
      total: 486,
      paidTotal: 0,
      balanceDue: 486,
      dueAt: daysFromNow(14),
      issuedAt: daysAgo(3),
    },
    {
      reference: "INV-2026-0003",
      jobRef: "JOB-2026-0001",
      estimateRef: "EST-2026-0002",
      requestRef: "SR-2026-0001",
      status: "draft" as const,
      amount: 7075,
      tax: 566,
      total: 7641,
      paidTotal: 0,
      balanceDue: 7641,
      dueAt: daysFromNow(30),
      issuedAt: daysAgo(0),
    },
  ];

  for (const inv of invoiceDefs) {
    const job = jobs[inv.jobRef];
    const sr = requests[inv.requestRef];
    const customer = customers[sr.customerKey];
    const estimate = inv.estimateRef ? estimates[inv.estimateRef] : null;

    const invoice = await prisma.invoice.upsert({
      where: { tenantId_reference: { tenantId: TENANT_ID, reference: inv.reference } },
      update: {
        customerId: customer.id,
        serviceRequestId: sr.id,
        estimateId: estimate?.id ?? null,
        jobId: job.id,
        customerName: customer.name,
        jobRef: job.reference,
        amount: inv.amount,
        tax: inv.tax,
        total: inv.total,
        paidTotal: inv.paidTotal,
        balanceDue: inv.balanceDue,
        status: inv.status,
        dueAt: inv.dueAt,
        issuedAt: inv.issuedAt,
      },
      create: {
        tenantId: TENANT_ID,
        customerId: customer.id,
        serviceRequestId: sr.id,
        estimateId: estimate?.id ?? null,
        jobId: job.id,
        reference: inv.reference,
        customerName: customer.name,
        jobRef: job.reference,
        amount: inv.amount,
        tax: inv.tax,
        total: inv.total,
        paidTotal: inv.paidTotal,
        balanceDue: inv.balanceDue,
        status: inv.status,
        dueAt: inv.dueAt,
        issuedAt: inv.issuedAt,
      },
    });

    const lineCount = await prisma.invoiceLineItem.count({ where: { invoiceId: invoice.id } });
    if (lineCount === 0) {
      await prisma.invoiceLineItem.create({
        data: {
          invoiceId: invoice.id,
          type: "service",
          description: `Service for ${job.reference}`,
          quantity: 1,
          unitPrice: inv.amount,
          taxRate: 8,
          lineTotal: inv.amount,
        },
      });
    } else {
      await prisma.invoiceLineItem.updateMany({
        where: {
          invoiceId: invoice.id,
          description: { startsWith: "Service for JOB-" },
        },
        data: { description: `Service for ${job.reference}` },
      });
    }

    if (inv.status === "paid") {
      const payments = await prisma.invoicePayment.count({ where: { invoiceId: invoice.id } });
      if (payments === 0) {
        await prisma.invoicePayment.create({
          data: {
            tenantId: TENANT_ID,
            invoiceId: invoice.id,
            amount: inv.total,
            method: "bank_transfer",
            reference: "PMT-SEED-001",
            note: "Dummy seed payment",
            paidAt: daysAgo(2),
            recordedBy: users.billing1.id,
          },
        });
      }
    }
  }

  // ── Notifications ─────────────────────────────────────────────────────────
  const notifCount = await prisma.notification.count({ where: { tenantId: TENANT_ID } });
  if (notifCount === 0) {
    await prisma.notification.createMany({
      data: [
        {
          tenantId: TENANT_ID,
          recipientUserId: users.coordinator1.id,
          type: "system",
          title: "New critical service request",
          body: "SR-2026-0002 — Chemistry analyzer down at Pacific Diagnostics Lab.",
        },
        {
          tenantId: TENANT_ID,
          recipientUserId: users.engineer1.id,
          type: "job",
          title: "Job assigned",
          body: "You have been assigned to JOB-2026-0001 (CT repair).",
        },
        {
          tenantId: TENANT_ID,
          recipientRole: "billing",
          type: "approval",
          title: "Invoice ready to send",
          body: "INV-2026-0002 is ready for customer delivery.",
        },
        {
          tenantId: TENANT_ID,
          recipientUserId: users.inventory1.id,
          type: "stock",
          title: "Low stock alert",
          body: "CT Detector Module stock is at reorder level.",
        },
        {
          tenantId: TENANT_ID,
          recipientRole: "coordinator",
          type: "amc",
          title: "AMC expiring soon",
          body: "AMC-2026-0002 for Sunrise Family Clinic expires in 30 days.",
        },
      ],
    });
  }

  // ── Audit log sample ──────────────────────────────────────────────────────
  const auditCount = await prisma.auditLog.count({ where: { tenantId: TENANT_ID } });
  if (auditCount === 0) {
    await prisma.auditLog.createMany({
      data: [
        {
          tenantId: TENANT_ID,
          actor: admin.name,
          role: "admin",
          action: "SEED",
          entity: "system",
          ip: "127.0.0.1",
        },
        {
          tenantId: TENANT_ID,
          actor: users.estimator1.name,
          role: "estimator",
          action: "CREATE",
          entity: "estimate:EST-2026-0001",
          ip: "127.0.0.1",
        },
      ],
    });
  }

  console.log("Database seeded successfully!");
  console.log("");
  console.log("Admin login — username: medical_equment / password: medical@961");
  console.log("Demo staff  — password for all: demo@123");
  console.log("  coordinator1, inspector1, estimator1, sales1, engineer1, engineer2, inventory1, billing1");
  console.log("");
  console.log("Dummy data includes:");
  console.log("  3 branches · 5 customers · 7 equipment · 6 service requests");
  console.log("  3 estimates · 4 jobs · 6 inventory items · 3 suppliers");
  console.log("  1 PO · 3 AMC contracts · 3 invoices · notifications");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
