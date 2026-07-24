import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const prisma = new PrismaClient();
const TENANT_ID = process.env.DEFAULT_TENANT_ID ?? "tenant_medtech_01";

const ADMIN_USERNAME = "medical_equment";
const ADMIN_PASSWORD = "medical@961";
const ADMIN_EMAIL = "admin@mesms.io";

async function main() {
  console.log("Seeding database...");

  await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    update: { name: "MedTech Services Inc." },
    create: { id: TENANT_ID, name: "MedTech Services Inc." },
  });

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const admin = await prisma.user.upsert({
    where: { tenantId_username: { tenantId: TENANT_ID, username: ADMIN_USERNAME } },
    update: {
      name: "System Administrator",
      email: ADMIN_EMAIL,
      passwordHash,
      role: "admin",
    },
    create: {
      tenantId: TENANT_ID,
      name: "System Administrator",
      username: ADMIN_USERNAME,
      email: ADMIN_EMAIL,
      passwordHash,
      role: "admin",
      avatarColor: "205 90% 42%",
    },
  });

  const existingBranch = await prisma.branch.findFirst({
    where: { tenantId: TENANT_ID, name: "Main HQ" },
  });

  if (!existingBranch) {
    await prisma.branch.create({
      data: {
        tenantId: TENANT_ID,
        name: "Main HQ",
        city: "New York",
        phone: "555-0100",
      },
    });
  }

  await prisma.tenantSettings.upsert({
    where: { tenantId: TENANT_ID },
    update: {},
    create: {
      tenantId: TENANT_ID,
      supportEmail: "support@mesms.io",
      defaultTaxRate: 8,
      rbacMatrix: {
        Dashboard: ["admin", "coordinator", "inspector", "estimator", "engineer", "inventory", "billing"],
        Customers: ["admin", "coordinator", "billing"],
        Equipment: ["admin", "coordinator", "inspector", "engineer", "inventory"],
        "Service Requests": ["admin", "coordinator", "inspector", "engineer"],
        Inspections: ["admin", "coordinator", "inspector"],
        Estimates: ["admin", "coordinator", "estimator", "billing"],
        "Service Jobs": ["admin", "coordinator", "engineer"],
        Inventory: ["admin", "inventory", "engineer"],
        Suppliers: ["admin", "inventory"],
        "Purchase Orders": ["admin", "inventory"],
        "Stock Transfers": ["admin", "inventory"],
        "AMC Contracts": ["admin", "coordinator", "billing"],
        Billing: ["admin", "billing"],
        Reports: ["admin", "billing", "coordinator"],
        Notifications: ["admin", "coordinator", "inspector", "estimator", "engineer", "inventory", "billing"],
        "QR Tracking": ["admin", "coordinator", "inspector", "engineer", "inventory"],
        "Audit Logs": ["admin"],
        Branches: ["admin"],
        Users: ["admin"],
        Settings: ["admin"],
      },
    },
  });

  const systemRoles = [
    ["admin", "Administrator"],
    ["coordinator", "Service Coordinator"],
    ["inspector", "Inspector"],
    ["estimator", "Estimator"],
    ["engineer", "Service Engineer"],
    ["inventory", "Inventory Staff"],
    ["billing", "Billing Staff"],
    ["customer", "Customer"],
  ] as const;
  for (const [key, name] of systemRoles) {
    const role = await prisma.role.upsert({
      where: { tenantId_key: { tenantId: TENANT_ID, key } },
      update: { name, isSystem: true },
      create: { tenantId: TENANT_ID, key, name, isSystem: true, permissions: {} },
    });
    if (key === "admin") {
      const assignment = await prisma.userRoleAssignment.findFirst({
        where: { tenantId: TENANT_ID, userId: admin.id, roleId: role.id, branchId: null },
      });
      if (!assignment) {
        await prisma.userRoleAssignment.create({
          data: { tenantId: TENANT_ID, userId: admin.id, roleId: role.id },
        });
      }
    }
  }

  const defaultServices = [
    { code: "INSPECTION", name: "Equipment Inspection", category: "Inspection", unitPrice: 150 },
    { code: "REPAIR-LABOR", name: "Repair Labor", category: "Repair", unit: "hour", unitPrice: 95 },
    { code: "CALIBRATION", name: "Equipment Calibration", category: "Calibration", unitPrice: 250 },
  ];
  for (const service of defaultServices) {
    await prisma.serviceCatalogItem.upsert({
      where: { tenantId_code: { tenantId: TENANT_ID, code: service.code } },
      update: {},
      create: { tenantId: TENANT_ID, taxRate: 0, ...service },
    });
  }

  console.log("Database seeded successfully!");
  console.log(`Admin login — username: ${ADMIN_USERNAME} / password: ${ADMIN_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
