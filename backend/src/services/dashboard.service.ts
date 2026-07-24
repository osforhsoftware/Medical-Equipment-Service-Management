import { prisma } from "@/db/prisma";

const CLOSED_REQUEST_STATUSES = ["completed", "invoiced"] as const;

type StaffRole =
  | "admin"
  | "coordinator"
  | "inspector"
  | "estimator"
  | "engineer"
  | "inventory"
  | "billing";

type QueueKind = "request" | "job" | "estimate" | "invoice" | "purchaseOrder" | "transfer" | "parts";

export interface DashboardQueueItem {
  id: string;
  kind: QueueKind;
  reference: string;
  title: string;
  subtitle: string;
  status: string;
  priority?: string;
  dueAt?: string | null;
  progress?: number;
  href: string;
}

function last6MonthBuckets() {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const offset = 5 - i;
    const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0, 23, 59, 59, 999);
    return {
      label: start.toLocaleString("en-US", { month: "short" }),
      start,
      end,
    };
  });
}

function pctChange(current: number, previous: number): { value: string; up: boolean } | undefined {
  if (previous === 0) return current > 0 ? { value: "100%", up: true } : undefined;
  const delta = ((current - previous) / previous) * 100;
  return { value: `${Math.abs(delta).toFixed(1)}%`, up: delta >= 0 };
}

function formatMoneyShort(amount: number) {
  if (amount >= 1_000_000) return `₹${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `₹${(amount / 1_000).toFixed(1)}k`;
  return `₹${amount.toFixed(0)}`;
}

function startOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function mapJobStatus(status: string) {
  if (status === "inProgress") return "in-progress";
  if (status === "partsPending") return "parts-pending";
  return status;
}

export class DashboardService {
  async getOverview(tenantId: string, userId: string, role: string, branchId?: string) {
    const scopedBranch = branchId && branchId !== "all" ? branchId : undefined;
    const staffRole = (role as StaffRole) || "admin";

    const requestWhere = {
      tenantId,
      ...(scopedBranch ? { branchId: scopedBranch } : {}),
    };
    const inventoryWhere = {
      tenantId,
      ...(scopedBranch ? { branchId: scopedBranch } : {}),
    };

    const branchRequestRefs = scopedBranch
      ? (
          await prisma.serviceRequest.findMany({
            where: requestWhere,
            select: { reference: true },
          })
        ).map((r) => r.reference)
      : null;

    const jobScope = {
      tenantId,
      ...(branchRequestRefs ? { requestRef: { in: branchRequestRefs } } : {}),
    };

    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const [
      openRequests,
      unassignedRequests,
      activeJobsCount,
      lowStockItems,
      expiringAmc,
      activeJobsList,
      allJobs,
      paidInvoices,
      timelineEvents,
      auditLogs,
      unreadNotifications,
      pendingEstimates,
      approvedEstimates,
      rejectedEstimates,
      sentEstimates,
      pendingInvoices,
      overdueInvoices,
      openPurchaseOrders,
      pendingTransfers,
      pendingPartsRequests,
      myAssignedRequests,
      myJobs,
      completedJobsMonth,
      dueTodayRequests,
      overdueRequests,
    ] = await Promise.all([
      prisma.serviceRequest.count({
        where: { ...requestWhere, status: { notIn: [...CLOSED_REQUEST_STATUSES] } },
      }),
      prisma.serviceRequest.count({
        where: {
          ...requestWhere,
          assignedTo: null,
          status: { notIn: [...CLOSED_REQUEST_STATUSES] },
        },
      }),
      prisma.serviceJob.count({
        where: { ...jobScope, status: { not: "completed" } },
      }),
      prisma.inventoryItem.findMany({
        where: inventoryWhere,
        select: { id: true, name: true, inStock: true, reorderLevel: true },
      }),
      prisma.amcContract.count({
        where: {
          tenantId,
          OR: [
            { status: "expiring" },
            { status: "active", endDate: { lte: new Date(Date.now() + 30 * 86400000) } },
          ],
        },
      }),
      prisma.serviceJob.findMany({
        where: { ...jobScope, status: { not: "completed" } },
        orderBy: { updatedAt: "desc" },
        take: 8,
      }),
      prisma.serviceJob.findMany({
        where: jobScope,
        select: { type: true, createdAt: true, status: true, engineerId: true },
      }),
      prisma.invoice.findMany({
        where: { tenantId },
        select: { total: true, issuedAt: true, status: true },
      }),
      prisma.timelineEvent.findMany({
        where: scopedBranch
          ? { request: { tenantId, branchId: scopedBranch } }
          : { request: { tenantId } },
        orderBy: { at: "desc" },
        take: 6,
        select: { id: true, action: true, actor: true, at: true },
      }),
      prisma.auditLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, action: true, actor: true, createdAt: true },
      }),
      prisma.notification.count({
        where: { tenantId, read: false },
      }),
      prisma.estimate.count({
        where: { tenantId, status: { in: ["draft", "revision"] } },
      }),
      prisma.estimate.count({
        where: { tenantId, status: "approved" },
      }),
      prisma.estimate.count({
        where: { tenantId, status: "rejected" },
      }),
      prisma.estimate.count({
        where: { tenantId, status: "sent" },
      }),
      prisma.invoice.count({
        where: { tenantId, status: { in: ["draft", "sent"] } },
      }),
      prisma.invoice.count({
        where: { tenantId, status: "overdue" },
      }),
      prisma.purchaseOrder.count({
        where: { tenantId, status: { in: ["draft", "sent", "partial"] } },
      }),
      prisma.stockTransfer.count({
        where: { tenantId, status: { in: ["pending", "inTransit"] } },
      }),
      prisma.jobPartsRequest.count({
        where: { status: "pending", job: { tenantId } },
      }),
      prisma.serviceRequest.findMany({
        where: {
          ...requestWhere,
          assignedTo: userId,
          status: { notIn: [...CLOSED_REQUEST_STATUSES] },
        },
        orderBy: [{ slaDue: "asc" }, { updatedAt: "desc" }],
        take: 12,
      }),
      prisma.serviceJob.findMany({
        where: {
          ...jobScope,
          engineerId: userId,
          status: { not: "completed" },
        },
        orderBy: [{ scheduledFor: "asc" }, { updatedAt: "desc" }],
        take: 12,
      }),
      prisma.serviceJob.count({
        where: {
          ...jobScope,
          ...(staffRole === "engineer" ? { engineerId: userId } : {}),
          status: "completed",
          updatedAt: { gte: mtdStart },
        },
      }),
      prisma.serviceRequest.count({
        where: {
          ...requestWhere,
          ...(this.isAssigneeScoped(staffRole) ? { assignedTo: userId } : {}),
          status: { notIn: [...CLOSED_REQUEST_STATUSES] },
          slaDue: { gte: todayStart, lte: todayEnd },
        },
      }),
      prisma.serviceRequest.count({
        where: {
          ...requestWhere,
          ...(this.isAssigneeScoped(staffRole) ? { assignedTo: userId } : {}),
          status: { notIn: [...CLOSED_REQUEST_STATUSES] },
          slaDue: { lt: todayStart },
        },
      }),
    ]);

    const lowStock = lowStockItems.filter((i) => i.inStock <= i.reorderLevel);

    const paidOnly = paidInvoices.filter((inv) => inv.status === "paid");
    const revenueTrend = last6MonthBuckets().map((bucket) => {
      const revenue = paidOnly
        .filter((inv) => inv.issuedAt >= bucket.start && inv.issuedAt <= bucket.end)
        .reduce((sum, inv) => sum + Number(inv.total), 0);
      const jobs = allJobs.filter((j) => j.createdAt >= bucket.start && j.createdAt <= bucket.end).length;
      return { month: bucket.label, revenue, jobs };
    });

    const jobsByTypeMap = new Map<string, number>();
    for (const job of allJobs) {
      jobsByTypeMap.set(job.type, (jobsByTypeMap.get(job.type) ?? 0) + 1);
    }
    const jobsByType = [...jobsByTypeMap.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    const revenueMtd = paidOnly
      .filter((inv) => inv.issuedAt >= mtdStart)
      .reduce((sum, inv) => sum + Number(inv.total), 0);

    const revenuePrevMonth = paidOnly
      .filter((inv) => inv.issuedAt >= prevMonthStart && inv.issuedAt <= prevMonthEnd)
      .reduce((sum, inv) => sum + Number(inv.total), 0);

    const jobsThisMonth = allJobs.filter((j) => j.createdAt >= mtdStart).length;
    const jobsPrevMonth = allJobs.filter(
      (j) => j.createdAt >= prevMonthStart && j.createdAt <= prevMonthEnd,
    ).length;

    const recentActivity =
      timelineEvents.length > 0
        ? timelineEvents.map((e) => ({
            id: e.id,
            action: e.action,
            actor: e.actor,
            at: e.at.toISOString(),
          }))
        : auditLogs.map((e) => ({
            id: e.id,
            action: e.action,
            actor: e.actor,
            at: e.createdAt.toISOString(),
          }));

    const myJobsToday = myJobs.filter(
      (j) => j.scheduledFor >= todayStart && j.scheduledFor <= todayEnd,
    );
    const myJobsUpcoming = myJobs.filter((j) => j.scheduledFor > todayEnd).slice(0, 6);

    const inspectionQueue = myAssignedRequests.filter((r) => r.status === "inspection");
    const estimateQueueRequests = myAssignedRequests.filter((r) =>
      ["estimate", "approval"].includes(r.status),
    );
    const serviceQueue = myAssignedRequests.filter((r) =>
      ["inProgress", "new"].includes(r.status),
    );

    const personal = this.buildPersonalStats({
      role: staffRole,
      myAssignedRequests,
      myJobs,
      dueTodayRequests,
      overdueRequests,
      completedJobsMonth,
      pendingEstimates,
      sentEstimates,
      approvedEstimates,
      rejectedEstimates,
      pendingInvoices,
      overdueInvoices,
      openPurchaseOrders,
      pendingTransfers,
      pendingPartsRequests,
      lowStockCount: lowStock.length,
      openRequests,
      unassignedRequests,
      activeJobsCount,
      expiringAmc,
      revenueMtd,
    });

    const myQueue = await this.buildMyQueue({
      role: staffRole,
      userId,
      tenantId,
      myAssignedRequests,
      myJobs,
      inspectionQueue,
      estimateQueueRequests,
      serviceQueue,
    });

    const roleQueues = {
      newAssigned: myAssignedRequests.filter((r) => r.status === "new").length,
      inspection: inspectionQueue.length,
      estimatePending: myAssignedRequests.filter((r) => r.status === "estimate").length + pendingEstimates,
      waitingApproval: myAssignedRequests.filter((r) => r.status === "approval").length + sentEstimates,
      servicePending: serviceQueue.length + myJobs.filter((j) => j.status !== "completed").length,
      completed: completedJobsMonth,
    };

    const showFinance = staffRole === "admin" || staffRole === "billing" || staffRole === "coordinator";
    const showCompanyOps = staffRole === "admin" || staffRole === "coordinator";
    const showInventoryAlerts = staffRole === "admin" || staffRole === "inventory" || staffRole === "engineer";

    return {
      role: staffRole,
      stats: {
        openRequests: showCompanyOps || staffRole === "billing" ? openRequests : personal.assignedOpen,
        activeJobs:
          staffRole === "engineer"
            ? myJobs.length
            : showCompanyOps
              ? activeJobsCount
              : personal.inProgress,
        lowStockItems: lowStock.length,
        revenueMtd,
        revenueMtdLabel: formatMoneyShort(revenueMtd),
        expiringAmc,
        unassignedRequests,
        pendingEstimates,
        pendingInvoices,
        overdueInvoices,
        openPurchaseOrders,
        pendingTransfers,
        pendingPartsRequests,
        unreadNotifications,
      },
      personal,
      roleQueues,
      myQueue,
      todaySchedule: myJobsToday.map((j) => ({
        id: j.id,
        reference: j.reference,
        title: j.equipmentName,
        subtitle: `${j.customerName} · ${j.type}`,
        status: mapJobStatus(j.status),
        scheduledFor: j.scheduledFor.toISOString(),
        progress: j.progress,
        href: "/app/jobs",
      })),
      upcomingJobs: myJobsUpcoming.map((j) => ({
        id: j.id,
        reference: j.reference,
        title: j.equipmentName,
        subtitle: `${j.customerName} · ${j.type}`,
        status: mapJobStatus(j.status),
        scheduledFor: j.scheduledFor.toISOString(),
        progress: j.progress,
        href: "/app/jobs",
      })),
      trends: {
        openRequests: undefined,
        activeJobs: pctChange(jobsThisMonth, jobsPrevMonth),
        revenue: showFinance ? pctChange(revenueMtd, revenuePrevMonth) : undefined,
      },
      revenueTrend: showFinance ? revenueTrend : revenueTrend.map(({ month, jobs }) => ({ month, revenue: 0, jobs })),
      jobsByType: showCompanyOps || staffRole === "engineer" || staffRole === "billing" ? jobsByType : [],
      activeJobs: (staffRole === "engineer" ? myJobs : activeJobsList).slice(0, 6).map((j) => ({
        id: j.id,
        reference: j.reference,
        equipmentName: j.equipmentName,
        customerName: j.customerName,
        engineer: j.engineer,
        status: mapJobStatus(j.status),
        progress: j.progress,
        scheduledFor: "scheduledFor" in j ? j.scheduledFor.toISOString() : undefined,
      })),
      recentActivity,
      lowStock: showInventoryAlerts
        ? lowStock.slice(0, 8).map((i) => ({
            id: i.id,
            name: i.name,
            inStock: i.inStock,
            reorderLevel: i.reorderLevel,
          }))
        : [],
      visibility: {
        showFinance,
        showCompanyOps,
        showInventoryAlerts,
        showCharts: showCompanyOps || staffRole === "billing" || staffRole === "engineer",
        showSchedule: staffRole === "engineer" || staffRole === "coordinator" || staffRole === "admin",
        canUpdateJobStatus: staffRole === "engineer" || staffRole === "admin" || staffRole === "coordinator",
      },
    };
  }

  private isAssigneeScoped(role: StaffRole) {
    return ["inspector", "estimator", "engineer", "inventory", "billing"].includes(role);
  }

  private buildPersonalStats(input: {
    role: StaffRole;
    myAssignedRequests: { id: string; status: string; slaDue: Date }[];
    myJobs: { id: string; status: string; scheduledFor: Date }[];
    dueTodayRequests: number;
    overdueRequests: number;
    completedJobsMonth: number;
    pendingEstimates: number;
    sentEstimates: number;
    approvedEstimates: number;
    rejectedEstimates: number;
    pendingInvoices: number;
    overdueInvoices: number;
    openPurchaseOrders: number;
    pendingTransfers: number;
    pendingPartsRequests: number;
    lowStockCount: number;
    openRequests: number;
    unassignedRequests: number;
    activeJobsCount: number;
    expiringAmc: number;
    revenueMtd: number;
  }) {
    const assignedOpen = input.myAssignedRequests.length;
    const inProgress =
      input.myJobs.filter((j) => j.status === "inProgress" || j.status === "partsPending").length ||
      input.myAssignedRequests.filter((r) => r.status === "inProgress" || r.status === "inspection").length;

    const base = {
      assignedOpen,
      dueToday: input.dueTodayRequests,
      overdue: input.overdueRequests,
      inProgress,
      completedThisMonth: input.completedJobsMonth,
      pendingApprovals: 0,
    };

    switch (input.role) {
      case "inspector":
        return {
          ...base,
          pendingApprovals: input.myAssignedRequests.filter((r) => r.status === "inspection").length,
        };
      case "estimator":
        return {
          ...base,
          assignedOpen: input.pendingEstimates + input.sentEstimates,
          pendingApprovals: input.sentEstimates,
          completedThisMonth: input.approvedEstimates,
        };
      case "billing":
        return {
          ...base,
          assignedOpen: input.pendingInvoices + input.overdueInvoices,
          overdue: input.overdueInvoices,
          pendingApprovals: input.pendingInvoices,
        };
      case "inventory":
        return {
          ...base,
          assignedOpen: input.lowStockCount + input.pendingPartsRequests,
          pendingApprovals: input.openPurchaseOrders + input.pendingTransfers,
          inProgress: input.pendingPartsRequests,
        };
      case "admin":
      case "coordinator":
        return {
          ...base,
          assignedOpen: input.openRequests,
          inProgress: input.activeJobsCount,
          pendingApprovals: input.unassignedRequests + input.sentEstimates + input.pendingInvoices,
        };
      case "engineer":
        return {
          ...base,
          assignedOpen: input.myJobs.length,
          inProgress: input.myJobs.filter(
            (j) => j.status === "inProgress" || j.status === "partsPending" || j.status === "review",
          ).length,
          dueToday: input.myJobs.filter((j) => {
            const d = j.scheduledFor;
            const start = new Date();
            start.setHours(0, 0, 0, 0);
            const end = new Date();
            end.setHours(23, 59, 59, 999);
            return d >= start && d <= end;
          }).length,
          overdue: input.myJobs.filter((j) => {
            const start = new Date();
            start.setHours(0, 0, 0, 0);
            return j.scheduledFor < start && j.status !== "completed";
          }).length,
        };
      default:
        return base;
    }
  }

  private async buildMyQueue(input: {
    role: StaffRole;
    userId: string;
    tenantId: string;
    myAssignedRequests: Array<{
      id: string;
      reference: string;
      customerName: string;
      equipmentName: string | null;
      type: string;
      status: string;
      priority: string;
      slaDue: Date;
    }>;
    myJobs: Array<{
      id: string;
      reference: string;
      customerName: string;
      equipmentName: string;
      type: string;
      status: string;
      progress: number;
      scheduledFor: Date;
    }>;
    inspectionQueue: Array<{
      id: string;
      reference: string;
      customerName: string;
      equipmentName: string | null;
      type: string;
      status: string;
      priority: string;
      slaDue: Date;
    }>;
    estimateQueueRequests: Array<{
      id: string;
      reference: string;
      customerName: string;
      equipmentName: string | null;
      type: string;
      status: string;
      priority: string;
      slaDue: Date;
    }>;
    serviceQueue: Array<{
      id: string;
      reference: string;
      customerName: string;
      equipmentName: string | null;
      type: string;
      status: string;
      priority: string;
      slaDue: Date;
    }>;
  }): Promise<DashboardQueueItem[]> {
    const requestItem = (
      r: (typeof input.myAssignedRequests)[number],
      href = "/app/service-requests",
    ): DashboardQueueItem => ({
      id: r.id,
      kind: "request",
      reference: r.reference,
      title: r.equipmentName ?? "Equipment",
      subtitle: `${r.customerName} · ${r.type}`,
      status: r.status === "inProgress" ? "in-progress" : r.status,
      priority: r.priority,
      dueAt: r.slaDue.toISOString(),
      href,
    });

    const jobItem = (j: (typeof input.myJobs)[number]): DashboardQueueItem => ({
      id: j.id,
      kind: "job",
      reference: j.reference,
      title: j.equipmentName,
      subtitle: `${j.customerName} · ${j.type}`,
      status: mapJobStatus(j.status),
      dueAt: j.scheduledFor.toISOString(),
      progress: j.progress,
      href: "/app/jobs",
    });

    switch (input.role) {
      case "inspector":
        return input.inspectionQueue.length > 0
          ? input.inspectionQueue.map((r) => requestItem(r, "/app/inspections"))
          : input.myAssignedRequests.map((r) => requestItem(r, "/app/inspections"));

      case "estimator": {
        const estimates = await prisma.estimate.findMany({
          where: {
            tenantId: input.tenantId,
            status: { in: ["draft", "revision", "sent"] },
          },
          orderBy: { updatedAt: "desc" },
          take: 10,
        });
        if (estimates.length > 0) {
          return estimates.map((e) => ({
            id: e.id,
            kind: "estimate" as const,
            reference: e.reference,
            title: e.equipmentName,
            subtitle: `${e.customerName} · ${e.requestRef}`,
            status: e.status,
            dueAt: e.validUntil.toISOString(),
            href: "/app/estimates",
          }));
        }
        return input.estimateQueueRequests.map((r) => requestItem(r, "/app/estimates"));
      }

      case "engineer":
        return input.myJobs.length > 0
          ? input.myJobs.map(jobItem)
          : input.serviceQueue.map((r) => requestItem(r));

      case "billing": {
        const invoices = await prisma.invoice.findMany({
          where: {
            tenantId: input.tenantId,
            status: { in: ["draft", "sent", "overdue"] },
          },
          orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
          take: 10,
        });
        return invoices.map((inv) => ({
          id: inv.id,
          kind: "invoice" as const,
          reference: inv.reference,
          title: inv.customerName,
          subtitle: `Job ${inv.jobRef}`,
          status: inv.status,
          dueAt: inv.dueAt.toISOString(),
          href: "/app/billing",
        }));
      }

      case "inventory": {
        const [pos, transfers, parts] = await Promise.all([
          prisma.purchaseOrder.findMany({
            where: { tenantId: input.tenantId, status: { in: ["draft", "sent", "partial"] } },
            orderBy: { updatedAt: "desc" },
            take: 5,
          }),
          prisma.stockTransfer.findMany({
            where: { tenantId: input.tenantId, status: { in: ["pending", "inTransit"] } },
            orderBy: { updatedAt: "desc" },
            take: 4,
          }),
          prisma.jobPartsRequest.findMany({
            where: { status: "pending", job: { tenantId: input.tenantId } },
            orderBy: { createdAt: "desc" },
            take: 4,
            include: { job: { select: { reference: true, customerName: true } } },
          }),
        ]);

        return [
          ...parts.map((p) => ({
            id: p.id,
            kind: "parts" as const,
            reference: p.job.reference,
            title: "Parts request",
            subtitle: `${p.job.customerName} · ${p.notes.slice(0, 60)}`,
            status: p.status,
            dueAt: p.createdAt.toISOString(),
            href: "/app/jobs",
          })),
          ...pos.map((po) => ({
            id: po.id,
            kind: "purchaseOrder" as const,
            reference: po.reference,
            title: po.supplier,
            subtitle: `${po.items} items`,
            status: po.status,
            dueAt: po.expectedDate.toISOString(),
            href: "/app/purchase-orders",
          })),
          ...transfers.map((t) => ({
            id: t.id,
            kind: "transfer" as const,
            reference: t.reference,
            title: `${t.fromBranch} → ${t.toBranch}`,
            subtitle: `${t.items} items`,
            status: t.status === "inTransit" ? "in-transit" : t.status,
            dueAt: t.createdAt.toISOString(),
            href: "/app/stock-transfers",
          })),
        ].slice(0, 12);
      }

      case "admin":
      case "coordinator":
      default: {
        const open = await prisma.serviceRequest.findMany({
          where: {
            tenantId: input.tenantId,
            status: { notIn: [...CLOSED_REQUEST_STATUSES] },
          },
          orderBy: [{ priority: "desc" }, { slaDue: "asc" }],
          take: 10,
        });
        return open.map((r) => requestItem(r));
      }
    }
  }
}

export const dashboardService = new DashboardService();
