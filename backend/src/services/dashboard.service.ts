import { prisma } from "@/db/prisma";

const CLOSED_REQUEST_STATUSES = ["completed", "invoiced"] as const;

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

export class DashboardService {
  async getOverview(tenantId: string, branchId?: string) {
    const scopedBranch = branchId && branchId !== "all" ? branchId : undefined;
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
    const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const [
      openRequests,
      activeJobsCount,
      lowStockItems,
      expiringAmc,
      activeJobsList,
      allJobs,
      paidInvoices,
      timelineEvents,
      auditLogs,
    ] = await Promise.all([
      prisma.serviceRequest.count({
        where: {
          ...requestWhere,
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
          OR: [{ status: "expiring" }, { status: "active", endDate: { lte: new Date(Date.now() + 30 * 86400000) } }],
        },
      }),
      prisma.serviceJob.findMany({
        where: { ...jobScope, status: { not: "completed" } },
        orderBy: { updatedAt: "desc" },
        take: 4,
      }),
      prisma.serviceJob.findMany({
        where: jobScope,
        select: { type: true, createdAt: true },
      }),
      prisma.invoice.findMany({
        where: { tenantId, status: "paid" },
        select: { total: true, issuedAt: true },
      }),
      prisma.timelineEvent.findMany({
        where: scopedBranch ? { request: { tenantId, branchId: scopedBranch } } : { request: { tenantId } },
        orderBy: { at: "desc" },
        take: 4,
        select: { id: true, action: true, actor: true, at: true },
      }),
      prisma.auditLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 4,
        select: { id: true, action: true, actor: true, createdAt: true },
      }),
    ]);

    const lowStock = lowStockItems.filter((i) => i.inStock <= i.reorderLevel);

    const revenueTrend = last6MonthBuckets().map((bucket) => {
      const revenue = paidInvoices
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

    const revenueMtd = paidInvoices
      .filter((inv) => inv.issuedAt >= mtdStart)
      .reduce((sum, inv) => sum + Number(inv.total), 0);

    const revenuePrevMonth = paidInvoices
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

    return {
      stats: {
        openRequests,
        activeJobs: activeJobsCount,
        lowStockItems: lowStock.length,
        revenueMtd,
        revenueMtdLabel: formatMoneyShort(revenueMtd),
        expiringAmc,
      },
      trends: {
        openRequests: undefined,
        activeJobs: pctChange(jobsThisMonth, jobsPrevMonth),
        revenue: pctChange(revenueMtd, revenuePrevMonth),
      },
      revenueTrend,
      jobsByType,
      activeJobs: activeJobsList.map((j) => ({
        id: j.id,
        reference: j.reference,
        equipmentName: j.equipmentName,
        customerName: j.customerName,
        engineer: j.engineer,
        status: j.status === "inProgress" ? "in-progress" : j.status === "partsPending" ? "parts-pending" : j.status,
        progress: j.progress,
      })),
      recentActivity,
      lowStock: lowStock.map((i) => ({
        id: i.id,
        name: i.name,
        inStock: i.inStock,
        reorderLevel: i.reorderLevel,
      })),
    };
  }
}

export const dashboardService = new DashboardService();
