import bcrypt from "bcryptjs";
import { prisma } from "@/db/prisma";
import { env } from "@/config/env";
import { deleteInventoryDependencies } from "@/services/databaseCleanup.service";
import { taxonomyService } from "@/services/taxonomy.service";
import { generateReference } from "@/utils/reference";
import {
  DEMO_AUDIT_LOGS,
  DEMO_BRANCHES,
  DEMO_CUSTOMERS,
  DEMO_EQUIPMENT,
  DEMO_ESTIMATES,
  DEMO_INVENTORY,
  DEMO_INVOICES,
  DEMO_JOBS,
  DEMO_MODULES,
  DEMO_PASSWORD,
  DEMO_PREFIX,
  DEMO_PURCHASE_ORDERS,
  DEMO_SERVICE_REQUESTS,
  DEMO_STOCK_TRANSFERS,
  DEMO_SUPPLIERS,
  DEMO_TIMELINE,
  DEMO_USERS,
  demoAssetTag,
  demoRef,
  demoSku,
  parseDemoDate,
} from "@/seed/demoData";

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
  modules: typeof DEMO_MODULES;
  counts: DemoSeedCounts;
}

const DEMO_CUSTOMER_EMAILS = DEMO_CUSTOMERS.map((c) => c.email);
const DEMO_USERNAMES = DEMO_USERS.map((u) => u.username);
const DEMO_BRANCH_NAMES = DEMO_BRANCHES.map((b) => b.name);

function emptyCounts(): DemoSeedCounts {
  return {
    branches: 0,
    customers: 0,
    equipment: 0,
    serviceRequests: 0,
    estimates: 0,
    serviceJobs: 0,
    inventory: 0,
    suppliers: 0,
    purchaseOrders: 0,
    stockTransfers: 0,
    invoices: 0,
    auditLogs: 0,
    users: 0,
  };
}

function assertDemoSeedAllowed(): void {
  if (env.NODE_ENV === "production") {
    throw new Error("Demo seed is disabled in production");
  }
}

export class SeedService {
  async getStatus(tenantId: string): Promise<DemoSeedStatus> {
    const [
      customers,
      equipment,
      serviceRequests,
      estimates,
      serviceJobs,
      inventory,
      suppliers,
      purchaseOrders,
      stockTransfers,
      invoices,
      auditLogs,
      users,
      branches,
    ] = await Promise.all([
      prisma.customer.count({ where: { tenantId, email: { in: DEMO_CUSTOMER_EMAILS } } }),
      prisma.equipment.count({ where: { tenantId, assetTag: { startsWith: DEMO_PREFIX } } }),
      prisma.serviceRequest.count({ where: { tenantId, reference: { startsWith: DEMO_PREFIX } } }),
      prisma.estimate.count({ where: { tenantId, reference: { startsWith: DEMO_PREFIX } } }),
      prisma.serviceJob.count({ where: { tenantId, reference: { startsWith: DEMO_PREFIX } } }),
      prisma.inventoryItem.count({ where: { tenantId, sku: { startsWith: DEMO_PREFIX } } }),
      prisma.supplier.count({ where: { tenantId, email: { in: DEMO_SUPPLIERS.map((s) => s.email) } } }),
      prisma.purchaseOrder.count({ where: { tenantId, reference: { startsWith: DEMO_PREFIX } } }),
      prisma.stockTransfer.count({ where: { tenantId, reference: { startsWith: DEMO_PREFIX } } }),
      prisma.invoice.count({ where: { tenantId, reference: { startsWith: DEMO_PREFIX } } }),
      prisma.auditLog.count({
        where: {
          tenantId,
          OR: [
            { entity: { startsWith: DEMO_PREFIX } },
            { entity: { in: DEMO_AUDIT_LOGS.map((l) => l.entity) } },
          ],
        },
      }),
      prisma.user.count({ where: { tenantId, username: { in: DEMO_USERNAMES } } }),
      prisma.branch.count({ where: { tenantId, name: { in: DEMO_BRANCH_NAMES } } }),
    ]);

    const counts: DemoSeedCounts = {
      branches,
      customers,
      equipment,
      serviceRequests,
      estimates,
      serviceJobs,
      inventory,
      suppliers,
      purchaseOrders,
      stockTransfers,
      invoices,
      auditLogs,
      users,
    };

    const seeded = customers > 0 || equipment > 0;

    return { seeded, modules: DEMO_MODULES, counts };
  }

  async seedDemo(tenantId: string, actorName: string): Promise<DemoSeedStatus> {
    assertDemoSeedAllowed();

    const existing = await prisma.customer.findFirst({
      where: { tenantId, email: DEMO_CUSTOMERS[0].email },
    });
    if (existing) {
      return this.getStatus(tenantId);
    }

    const branchIds: Record<string, string> = {};
    const customerIds: Record<string, string> = {};
    const equipmentIds: Record<string, string> = {};

    await taxonomyService.ensureDefaults(tenantId);

    await prisma.$transaction(async (tx) => {
      for (const branch of DEMO_BRANCHES) {
        const created = await tx.branch.create({
          data: {
            tenantId,
            name: branch.name,
            city: branch.city,
            phone: branch.phone,
          },
        });
        branchIds[branch.key] = created.id;
      }

      for (const customer of DEMO_CUSTOMERS) {
        const reference = await generateReference(tenantId, "CUST", "customer");
        const created = await tx.customer.create({
          data: {
            tenantId,
            reference,
            name: customer.name,
            type: customer.type,
            contactPerson: customer.contactPerson,
            email: customer.email,
            phone: customer.phone,
            address: customer.address,
            city: customer.city,
            country: customer.country,
            branchId: branchIds[customer.branchKey],
            equipmentCount: customer.equipmentCount,
            activeJobs: customer.activeJobs,
            status: customer.status,
          },
        });
        customerIds[customer.key] = created.id;
      }

      for (const item of DEMO_EQUIPMENT) {
        const customer = DEMO_CUSTOMERS.find((c) => c.key === item.customerKey)!;
        const created = await tx.equipment.create({
          data: {
            tenantId,
            assetTag: demoAssetTag(item.assetTag),
            name: item.name,
            model: item.model,
            manufacturer: item.manufacturer,
            category: item.category,
            serialNumber: item.serialNumber,
            customerId: customerIds[item.customerKey],
            customerName: customer.name,
            branchId: branchIds[customer.branchKey],
            location: item.location,
            installDate: parseDemoDate(item.installDate),
            warrantyEnd: parseDemoDate(item.warrantyEnd),
            amcStatus: item.amcStatus,
            condition: item.condition,
            lastServiceDate: item.lastServiceDate ? parseDemoDate(item.lastServiceDate) : null,
          },
        });
        equipmentIds[item.key] = created.id;
      }

      const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
      for (const user of DEMO_USERS) {
        const branchId =
          "branchKey" in user && user.branchKey ? branchIds[user.branchKey] : null;
        const customerId =
          "customerKey" in user && user.customerKey ? customerIds[user.customerKey] : null;

        await tx.user.create({
          data: {
            tenantId,
            name: user.name,
            username: user.username,
            email: user.email,
            passwordHash,
            role: user.role,
            branchId,
            customerId,
            avatarColor: user.avatarColor,
          },
        });
      }

      let firstRequestId: string | null = null;
      for (const sr of DEMO_SERVICE_REQUESTS) {
        const customer = DEMO_CUSTOMERS.find((c) => c.key === sr.customerKey)!;
        const created = await tx.serviceRequest.create({
          data: {
            tenantId,
            reference: demoRef(sr.reference),
            customerId: customerIds[sr.customerKey],
            customerName: customer.name,
            equipmentId: equipmentIds[sr.equipmentKey],
            equipmentName: sr.equipmentName,
            branchId: branchIds[sr.branchKey],
            type: sr.type ?? "Other",
            priority: sr.priority,
            status: sr.status,
            description: sr.description,
            createdBy: sr.createdBy,
            assignedTo: sr.assignedTo ?? null,
            assignedName: sr.assignedTo ?? null,
            slaDue: parseDemoDate(sr.slaDue),
            createdAt: parseDemoDate(sr.createdAt),
          },
        });
        if (!firstRequestId) firstRequestId = created.id;
      }

      if (firstRequestId) {
        for (const event of DEMO_TIMELINE) {
          await tx.timelineEvent.create({
            data: {
              requestId: firstRequestId,
              at: parseDemoDate(event.at),
              actor: event.actor,
              action: event.action,
              note: event.note,
            },
          });
        }
      }

      for (const est of DEMO_ESTIMATES) {
        await tx.estimate.create({
          data: {
            tenantId,
            reference: demoRef(est.reference),
            requestRef: demoRef(est.requestRef),
            customerName: est.customerName,
            equipmentName: est.equipmentName,
            laborCost: est.laborCost,
            partsCost: est.partsCost,
            total: est.total,
            status: est.status,
            validUntil: parseDemoDate(est.validUntil),
            revision: est.revision,
            createdAt: parseDemoDate(est.createdAt),
          },
        });
      }

      for (const job of DEMO_JOBS) {
        await tx.serviceJob.create({
          data: {
            tenantId,
            reference: demoRef(job.reference),
            requestRef: demoRef(job.requestRef),
            customerName: job.customerName,
            equipmentName: job.equipmentName,
            engineer: job.engineer,
            type: job.type,
            status: job.status,
            scheduledFor: parseDemoDate(job.scheduledFor),
            progress: job.progress,
          },
        });
      }

      for (const item of DEMO_INVENTORY) {
        await tx.inventoryItem.create({
          data: {
            tenantId,
            sku: demoSku(item.sku),
            name: item.name,
            category: item.category,
            branchId: branchIds[item.branchKey],
            inStock: item.inStock,
            reserved: item.reserved,
            reorderLevel: item.reorderLevel,
            unitCost: item.unitCost,
            supplier: item.supplier,
          },
        });
      }

      for (const supplier of DEMO_SUPPLIERS) {
        await tx.supplier.create({
          data: {
            tenantId,
            name: supplier.name,
            contact: supplier.contact,
            email: supplier.email,
            phone: supplier.phone,
            category: supplier.category,
            rating: supplier.rating,
            openOrders: supplier.openOrders,
          },
        });
      }

      for (const po of DEMO_PURCHASE_ORDERS) {
        await tx.purchaseOrder.create({
          data: {
            tenantId,
            reference: demoRef(po.reference),
            supplier: po.supplier,
            items: po.items,
            total: po.total,
            status: po.status,
            expectedDate: parseDemoDate(po.expectedDate),
            createdAt: parseDemoDate(po.createdAt),
          },
        });
      }

      for (const st of DEMO_STOCK_TRANSFERS) {
        await tx.stockTransfer.create({
          data: {
            tenantId,
            reference: demoRef(st.reference),
            fromBranch: st.fromBranch,
            toBranch: st.toBranch,
            items: st.items,
            status: st.status,
            createdAt: parseDemoDate(st.createdAt),
          },
        });
      }

      for (const inv of DEMO_INVOICES) {
        await tx.invoice.create({
          data: {
            tenantId,
            reference: demoRef(inv.reference),
            customerName: inv.customerName,
            jobRef: demoRef(inv.jobRef),
            amount: inv.amount,
            tax: inv.tax,
            total: inv.total,
            status: inv.status,
            issuedAt: parseDemoDate(inv.issuedAt),
            dueAt: parseDemoDate(inv.dueAt),
          },
        });
      }

      for (const log of DEMO_AUDIT_LOGS) {
        await tx.auditLog.create({
          data: {
            tenantId,
            actor: log.actor,
            role: log.role,
            action: log.action,
            entity: log.entity.startsWith(DEMO_PREFIX) ? log.entity : demoRef(log.entity),
            ip: log.ip,
            createdAt: parseDemoDate(log.at),
          },
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId,
          actor: actorName,
          role: "admin",
          action: "Seeded demo data",
          entity: "settings/demo-seed",
          ip: "127.0.0.1",
        },
      });
    });

    return this.getStatus(tenantId);
  }

  async removeDemo(tenantId: string, actorName: string): Promise<DemoSeedStatus> {
    assertDemoSeedAllowed();

    const demoJobIds = (
      await prisma.serviceJob.findMany({
        where: { tenantId, reference: { startsWith: DEMO_PREFIX } },
        select: { id: true },
      })
    ).map((j) => j.id);

    const demoRequestIds = (
      await prisma.serviceRequest.findMany({
        where: { tenantId, reference: { startsWith: DEMO_PREFIX } },
        select: { id: true },
      })
    ).map((r) => r.id);

    const demoCustomerIds = (
      await prisma.customer.findMany({
        where: { tenantId, email: { in: DEMO_CUSTOMER_EMAILS } },
        select: { id: true },
      })
    ).map((c) => c.id);

    const demoInventoryIds = (
      await prisma.inventoryItem.findMany({
        where: { tenantId, sku: { startsWith: DEMO_PREFIX } },
        select: { id: true },
      })
    ).map((item) => item.id);

    await prisma.$transaction(async (tx) => {
      if (demoJobIds.length > 0) {
        await tx.jobActivity.deleteMany({ where: { jobId: { in: demoJobIds } } });
        await tx.jobStockDeduction.deleteMany({ where: { jobId: { in: demoJobIds } } });
        await tx.jobSignature.deleteMany({ where: { jobId: { in: demoJobIds } } });
        await tx.jobPartsRequest.deleteMany({ where: { jobId: { in: demoJobIds } } });
        await tx.jobPhoto.deleteMany({ where: { jobId: { in: demoJobIds } } });
        await tx.serviceJob.deleteMany({ where: { id: { in: demoJobIds } } });
      }

      if (demoRequestIds.length > 0) {
        await tx.timelineEvent.deleteMany({ where: { requestId: { in: demoRequestIds } } });
        await tx.inspectionReport.deleteMany({ where: { serviceRequestId: { in: demoRequestIds } } });
        await tx.serviceRequestEquipment.deleteMany({ where: { serviceRequestId: { in: demoRequestIds } } });
        await tx.serviceRequest.deleteMany({ where: { id: { in: demoRequestIds } } });
      }

      await tx.estimate.deleteMany({ where: { tenantId, reference: { startsWith: DEMO_PREFIX } } });
      await tx.invoice.deleteMany({ where: { tenantId, reference: { startsWith: DEMO_PREFIX } } });

      if (demoInventoryIds.length > 0) {
        await deleteInventoryDependencies(tx, tenantId, {
          inventoryItemIds: demoInventoryIds,
          purchaseOrderWhere: { tenantId, reference: { startsWith: DEMO_PREFIX } },
          stockTransferWhere: { tenantId, reference: { startsWith: DEMO_PREFIX } },
        });
      } else {
        await tx.purchaseOrder.deleteMany({
          where: { tenantId, reference: { startsWith: DEMO_PREFIX } },
        });
        await tx.stockTransfer.deleteMany({
          where: { tenantId, reference: { startsWith: DEMO_PREFIX } },
        });
      }

      await tx.equipment.deleteMany({ where: { tenantId, assetTag: { startsWith: DEMO_PREFIX } } });

      if (demoCustomerIds.length > 0) {
        await tx.customer.deleteMany({ where: { id: { in: demoCustomerIds } } });
      }

      await tx.supplier.deleteMany({
        where: { tenantId, email: { in: DEMO_SUPPLIERS.map((s) => s.email) } },
      });

      await tx.auditLog.deleteMany({
        where: {
          tenantId,
          OR: [
            { entity: { startsWith: DEMO_PREFIX } },
            { entity: "settings/demo-seed" },
            { entity: { in: DEMO_AUDIT_LOGS.map((l) => l.entity) } },
          ],
        },
      });

      await tx.user.deleteMany({
        where: { tenantId, username: { in: DEMO_USERNAMES } },
      });

      await tx.branch.deleteMany({
        where: { tenantId, name: { in: DEMO_BRANCH_NAMES } },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          actor: actorName,
          role: "admin",
          action: "Removed demo data",
          entity: "settings/demo-seed",
          ip: "127.0.0.1",
        },
      });
    });

    return this.getStatus(tenantId);
  }
}

export const seedService = new SeedService();
