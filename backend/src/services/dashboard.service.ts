import { prisma } from "@/db/prisma";
import { notificationsService } from "@/services/notifications.service";
import { jobsService } from "@/services/jobs.service";
import { qaReviewedWhere } from "@/repositories/jobs.repository";
import type { Prisma } from "@prisma/client";

const CLOSED_REQUEST_STATUSES = ["completed", "invoiced", "closed", "finished"] as const;

type StaffRole =
  | "admin"
  | "coordinator"
  | "inspector"
  | "estimator"
  | "sales"
  | "engineer"
  | "inventory"
  | "billing"
  | "qa";

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

function parseIsoDate(value?: string | null, endOf = false) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const [y, m, d] = trimmed.split("-").map(Number);
  if (!y || !m || !d) return null;
  return endOf ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d);
}

function resolveDateRange(from?: string, to?: string) {
  const now = new Date();
  const defaultTo = endOfDay(now);
  const defaultFrom = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29));
  let rangeFrom = parseIsoDate(from, false) ?? defaultFrom;
  let rangeTo = parseIsoDate(to, true) ?? defaultTo;
  if (rangeFrom > rangeTo) {
    const swap = rangeFrom;
    rangeFrom = startOfDay(rangeTo);
    rangeTo = endOfDay(swap);
  }
  // Cap range to 366 days to keep chart series readable
  const maxMs = 366 * 24 * 60 * 60 * 1000;
  if (rangeTo.getTime() - rangeFrom.getTime() > maxMs) {
    rangeFrom = startOfDay(new Date(rangeTo.getTime() - maxMs));
  }
  return { from: rangeFrom, to: rangeTo };
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDayLabel(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function formatMonthLabel(d: Date) {
  return d.toLocaleString("en-US", { month: "short", year: "2-digit" });
}

function buildRangeBuckets(from: Date, to: Date) {
  const daySpan = Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  const useDaily = daySpan <= 45;
  const buckets: { label: string; key: string; start: Date; end: Date }[] = [];

  if (useDaily) {
    const cursor = startOfDay(from);
    const last = startOfDay(to);
    while (cursor <= last) {
      const start = startOfDay(cursor);
      const end = endOfDay(cursor);
      buckets.push({
        key: dayKey(start),
        label: formatDayLabel(start),
        start,
        end,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return { mode: "daily" as const, buckets };
  }

  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  const lastMonth = new Date(to.getFullYear(), to.getMonth(), 1);
  while (cursor <= lastMonth) {
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
    const clippedStart = start < from ? from : start;
    const clippedEnd = end > to ? to : end;
    buckets.push({
      key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
      label: formatMonthLabel(start),
      start: clippedStart,
      end: clippedEnd,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return { mode: "monthly" as const, buckets };
}

function humanizeStatus(status: string) {
  if (status === "inProgress") return "In Progress";
  if (status === "partsPending") return "Parts Pending";
  if (status === "review") return "QA Review";
  if (status === "delivery") return "Delivery";
  if (status === "scheduled") return "Scheduled";
  if (status === "completed") return "Completed";
  return status.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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

function assignedJobWhere(userId: string): Prisma.ServiceJobWhereInput {
  return {
    OR: [
      { engineerId: userId },
      { assignments: { some: { userId, endedAt: null } } },
    ],
  };
}

const ENGINEER_TICKET_STATUSES = [
  "assigned_engineer",
  "inProgress",
  "change_pending_approval",
  "pending_final_approval",
] as const;

export class DashboardService {
  async getOverview(
    tenantId: string,
    userId: string,
    role: string,
    range?: { from?: string; to?: string },
  ) {
    const staffRole = (role as StaffRole) || "admin";
    if (staffRole === "engineer") {
      await jobsService.syncJobsFromAssignedTickets(tenantId, userId);
    } else if (staffRole === "admin" || staffRole === "coordinator" || staffRole === "qa") {
      await jobsService.syncMissingJobsForTenant(tenantId, userId);
    }

    const requestWhere = { tenantId };
    const inventoryWhere = { tenantId };

    const jobScope = { tenantId };

    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    const { from: rangeFrom, to: rangeTo } = resolveDateRange(range?.from, range?.to);
    const { mode: chartMode, buckets: chartBuckets } = buildRangeBuckets(rangeFrom, rangeTo);

    const seesCompanyActivity = staffRole === "admin" || staffRole === "coordinator" || staffRole === "qa";
    const assignedScope = this.assignedWorkWhere(staffRole, userId);
    const hasAssigneeScope = Object.keys(assignedScope).length > 0;

    const actorUser = await prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { name: true },
    });
    const actorName = actorUser?.name?.trim() || null;

    const timelineWhere: Prisma.TimelineEventWhereInput = seesCompanyActivity
      ? { request: { tenantId } }
      : hasAssigneeScope
        ? { request: { tenantId, ...assignedScope } }
        : {
            request: { tenantId },
            ...(actorName
              ? {
                  OR: [
                    { actor: actorName },
                    { action: { contains: actorName } },
                    { note: { contains: actorName } },
                  ],
                }
              : { actor: "__none__" }),
          };

    const auditWhere: Prisma.AuditLogWhereInput = seesCompanyActivity
      ? { tenantId }
      : actorName
        ? { tenantId, actor: actorName }
        : { tenantId, actor: "__none__" };

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
      rangeRequests,
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
        select: {
          id: true,
          reference: true,
          customerName: true,
          equipmentName: true,
          engineer: true,
          type: true,
          status: true,
          progress: true,
          scheduledFor: true,
          engineerId: true,
          updatedAt: true,
        },
      }),
      prisma.serviceJob.findMany({
        where: jobScope,
        select: { type: true, createdAt: true, status: true, engineerId: true },
      }),
      prisma.invoice.findMany({
        where: { tenantId },
        select: { total: true, issuedAt: true, status: true, salesOrderId: true, jobId: true, serviceRequestId: true },
      }),
      prisma.timelineEvent.findMany({
        where: timelineWhere,
        orderBy: { at: "desc" },
        take: 6,
        select: { id: true, action: true, actor: true, at: true },
      }),
      prisma.auditLog.findMany({
        where: auditWhere,
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, action: true, actor: true, createdAt: true },
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
        where: {
          tenantId,
          status: { in: ["draft", "sent"] },
          ...(staffRole === "sales" ? { salesOrderId: { not: null } } : {}),
        },
      }),
      prisma.invoice.count({
        where: {
          tenantId,
          status: "overdue",
          ...(staffRole === "sales" ? { salesOrderId: { not: null } } : {}),
        },
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
          status: { notIn: [...CLOSED_REQUEST_STATUSES] },
          ...this.assignedWorkWhere(staffRole, userId),
        },
        orderBy: [{ slaDue: "asc" }, { updatedAt: "desc" }],
        take: 12,
        select: {
          id: true,
          reference: true,
          customerName: true,
          equipmentName: true,
          type: true,
          status: true,
          priority: true,
          slaDue: true,
          updatedAt: true,
        },
      }),
      prisma.serviceJob.findMany({
        where:
          staffRole === "qa"
            ? { ...jobScope, status: "review" }
            : {
                ...jobScope,
                ...assignedJobWhere(userId),
                status: { not: "completed" },
              },
        orderBy: [{ scheduledFor: "asc" }, { updatedAt: "desc" }],
        take: 12,
        select: {
          id: true,
          reference: true,
          customerName: true,
          equipmentName: true,
          engineer: true,
          type: true,
          status: true,
          progress: true,
          scheduledFor: true,
          updatedAt: true,
        },
      }),
      prisma.serviceJob.count({
        where:
          staffRole === "qa"
            ? {
                ...jobScope,
                ...qaReviewedWhere(),
                updatedAt: { gte: mtdStart },
              }
            : {
                ...jobScope,
                ...(staffRole === "engineer" ? assignedJobWhere(userId) : {}),
                status: "completed",
                updatedAt: { gte: mtdStart },
              },
      }),
      prisma.serviceRequest.count({
        where: {
          ...requestWhere,
          ...this.assignedWorkWhere(staffRole, userId),
          status: { notIn: [...CLOSED_REQUEST_STATUSES] },
          slaDue: { gte: todayStart, lte: todayEnd },
        },
      }),
      prisma.serviceRequest.count({
        where: {
          ...requestWhere,
          ...this.assignedWorkWhere(staffRole, userId),
          status: { notIn: [...CLOSED_REQUEST_STATUSES] },
          slaDue: { lt: todayStart },
        },
      }),
      prisma.serviceRequest.findMany({
        where: {
          tenantId,
          createdAt: { gte: rangeFrom, lte: rangeTo },
        },
        select: { createdAt: true, status: true },
      }),
    ]);

    const unreadNotifications = await notificationsService.unreadCount(tenantId, userId, role);

    const lowStock = lowStockItems.filter((i) => i.inStock <= i.reorderLevel);

    const isSaleInvoice = (inv: { salesOrderId: string | null }) => Boolean(inv.salesOrderId);
    const isServiceInvoice = (inv: { jobId: string | null; serviceRequestId: string | null; salesOrderId: string | null }) =>
      !inv.salesOrderId && Boolean(inv.jobId || inv.serviceRequestId);

    const paidOnly = paidInvoices.filter((inv) => inv.status === "paid" || inv.status === "closed");
    const salePaid = paidOnly.filter(isSaleInvoice);
    const servicePaid = paidOnly.filter(isServiceInvoice);
    const financePaid = staffRole === "sales" ? salePaid : paidOnly;

    const jobsInRange = allJobs.filter((j) => j.createdAt >= rangeFrom && j.createdAt <= rangeTo);
    const invoicesInRange = financePaid.filter((inv) => inv.issuedAt >= rangeFrom && inv.issuedAt <= rangeTo);
    const saleInRange = salePaid.filter((inv) => inv.issuedAt >= rangeFrom && inv.issuedAt <= rangeTo);
    const serviceInRange = servicePaid.filter((inv) => inv.issuedAt >= rangeFrom && inv.issuedAt <= rangeTo);

    const activityTrend = chartBuckets.map((bucket) => {
      const jobs = jobsInRange.filter((j) => j.createdAt >= bucket.start && j.createdAt <= bucket.end).length;
      const tickets = rangeRequests.filter((r) => r.createdAt >= bucket.start && r.createdAt <= bucket.end).length;
      const saleRevenue = saleInRange
        .filter((inv) => inv.issuedAt >= bucket.start && inv.issuedAt <= bucket.end)
        .reduce((sum, inv) => sum + Number(inv.total), 0);
      const serviceRevenue = serviceInRange
        .filter((inv) => inv.issuedAt >= bucket.start && inv.issuedAt <= bucket.end)
        .reduce((sum, inv) => sum + Number(inv.total), 0);
      const revenue = invoicesInRange
        .filter((inv) => inv.issuedAt >= bucket.start && inv.issuedAt <= bucket.end)
        .reduce((sum, inv) => sum + Number(inv.total), 0);
      return {
        label: bucket.label,
        key: bucket.key,
        jobs,
        tickets,
        revenue,
        saleRevenue,
        serviceRevenue,
      };
    });

    // Range-filtered revenue / activity series for charts.
    const revenueTrend = activityTrend.map((row) => ({
      month: row.label,
      revenue: row.revenue,
      saleRevenue: row.saleRevenue,
      serviceRevenue: row.serviceRevenue,
      jobs: row.jobs,
    }));

    const jobsByTypeMap = new Map<string, number>();
    for (const job of jobsInRange) {
      jobsByTypeMap.set(job.type, (jobsByTypeMap.get(job.type) ?? 0) + 1);
    }
    const jobsByType = [...jobsByTypeMap.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    const jobsByStatusMap = new Map<string, number>();
    for (const job of jobsInRange) {
      const label = humanizeStatus(job.status);
      jobsByStatusMap.set(label, (jobsByStatusMap.get(label) ?? 0) + 1);
    }
    const jobsByStatus = [...jobsByStatusMap.entries()]
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);

    const periodTotals = {
      jobs: jobsInRange.length,
      tickets: rangeRequests.length,
      revenue: invoicesInRange.reduce((sum, inv) => sum + Number(inv.total), 0),
      saleRevenue: saleInRange.reduce((sum, inv) => sum + Number(inv.total), 0),
      serviceRevenue: serviceInRange.reduce((sum, inv) => sum + Number(inv.total), 0),
    };

    const sumPaid = (rows: typeof paidOnly) =>
      rows.filter((inv) => inv.issuedAt >= mtdStart).reduce((sum, inv) => sum + Number(inv.total), 0);
    const saleRevenueMtd = sumPaid(salePaid);
    const serviceRevenueMtd = sumPaid(servicePaid);
    const otherRevenueMtd = sumPaid(paidOnly.filter((inv) => !isSaleInvoice(inv) && !isServiceInvoice(inv)));
    const revenueMtd = staffRole === "sales" ? saleRevenueMtd : sumPaid(paidOnly);

    const revenuePrevMonth = financePaid
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
      ["estimate", "approval", "pending_approval"].includes(r.status),
    );
    const serviceQueue = myAssignedRequests.filter((r) =>
      ["inProgress", "new", ...ENGINEER_TICKET_STATUSES].includes(r.status),
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

    const historyQueue =
      staffRole === "qa"
        ? (
            await prisma.serviceJob.findMany({
              where: { ...jobScope, ...qaReviewedWhere() },
              orderBy: { updatedAt: "desc" },
              take: 10,
              select: {
                id: true,
                reference: true,
                customerName: true,
                equipmentName: true,
                type: true,
                status: true,
                progress: true,
                scheduledFor: true,
                stageDetails: true,
                updatedAt: true,
              },
            })
          ).map((j) => {
            const qa = (j.stageDetails as { qa?: { result?: string; notes?: string | null } } | null)?.qa;
            const resultLabel = qa?.result === "fail" ? "Fail" : qa?.result === "pass" ? "Pass" : "Reviewed";
            return {
              id: j.id,
              kind: "job" as const,
              reference: j.reference,
              title: j.equipmentName,
              subtitle: `${j.customerName} · QA ${resultLabel}${qa?.notes ? ` — ${qa.notes}` : ""}`,
              status: mapJobStatus(j.status),
              dueAt: j.scheduledFor.toISOString(),
              progress: j.progress,
              href: `/app/jobs/${j.id}`,
            };
          })
        : [];

    const roleQueues = {
      newAssigned:
        staffRole === "qa"
          ? 0
          : staffRole === "engineer"
            ? myJobs.filter((j) => j.status === "scheduled").length
                || myAssignedRequests.filter((r) => r.status === "assigned_engineer" || r.status === "new").length
            : myAssignedRequests.filter((r) => r.status === "new").length,
      inspection: staffRole === "qa" ? 0 : inspectionQueue.length,
      estimatePending: staffRole === "qa" ? 0 : myAssignedRequests.filter((r) => r.status === "estimate").length + pendingEstimates,
      waitingApproval:
        staffRole === "qa"
          ? myJobs.length
          : myAssignedRequests.filter((r) => r.status === "approval" || r.status === "pending_approval").length + sentEstimates,
      servicePending:
        staffRole === "qa"
          ? 0
          : staffRole === "engineer"
            ? myJobs.filter((j) => j.status !== "completed").length
                || serviceQueue.length
            : serviceQueue.length + myJobs.filter((j) => j.status !== "completed").length,
      completed: completedJobsMonth,
    };

    const showFinance = staffRole === "admin" || staffRole === "billing" || staffRole === "coordinator" || staffRole === "sales";
    const showCompanyOps = staffRole === "admin" || staffRole === "coordinator";
    const showInventoryAlerts = staffRole === "admin" || staffRole === "inventory" || staffRole === "engineer";
    const showQaWorkspace = staffRole === "qa";

    return {
      role: staffRole,
      stats: {
        openRequests: showCompanyOps || staffRole === "billing" ? openRequests : personal.assignedOpen,
        activeJobs:
          staffRole === "engineer" || staffRole === "qa"
            ? myJobs.length
            : showCompanyOps
              ? activeJobsCount
              : personal.inProgress,
        lowStockItems: lowStock.length,
        revenueMtd,
        revenueMtdLabel: formatMoneyShort(revenueMtd),
        saleRevenueMtd,
        serviceRevenueMtd,
        otherRevenueMtd,
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
      historyQueue,
      todaySchedule: myJobsToday.map((j) => ({
        id: j.id,
        reference: j.reference,
        title: j.equipmentName,
        subtitle: `${j.customerName} · ${j.type}`,
        status: mapJobStatus(j.status),
        scheduledFor: j.scheduledFor.toISOString(),
        progress: j.progress,
        href: `/app/jobs/${j.id}`,
      })),
      upcomingJobs: myJobsUpcoming.map((j) => ({
        id: j.id,
        reference: j.reference,
        title: j.equipmentName,
        subtitle: `${j.customerName} · ${j.type}`,
        status: mapJobStatus(j.status),
        scheduledFor: j.scheduledFor.toISOString(),
        progress: j.progress,
        href: `/app/jobs/${j.id}`,
      })),
      trends: {
        openRequests: undefined,
        activeJobs: pctChange(jobsThisMonth, jobsPrevMonth),
        revenue: showFinance ? pctChange(revenueMtd, revenuePrevMonth) : undefined,
      },
      revenueTrend: showFinance
        ? revenueTrend
        : revenueTrend.map(({ month, jobs }) => ({ month, revenue: 0, saleRevenue: 0, serviceRevenue: 0, jobs })),
      activityTrend: showFinance
        ? activityTrend
        : activityTrend.map(({ label, key, jobs, tickets }) => ({
            label,
            key,
            jobs,
            tickets,
            revenue: 0,
            saleRevenue: 0,
            serviceRevenue: 0,
          })),
      jobsByType: showCompanyOps || staffRole === "engineer" || staffRole === "billing" || showQaWorkspace ? jobsByType : [],
      jobsByStatus: showCompanyOps || staffRole === "engineer" || staffRole === "billing" || showQaWorkspace ? jobsByStatus : [],
      period: {
        from: dayKey(rangeFrom),
        to: dayKey(rangeTo),
        mode: chartMode,
        totals: showFinance
          ? periodTotals
          : { ...periodTotals, revenue: 0, saleRevenue: 0, serviceRevenue: 0 },
      },
      activeJobs: (staffRole === "engineer" || staffRole === "qa" ? myJobs : activeJobsList).slice(0, 6).map((j) => ({
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
        showCharts: showCompanyOps || staffRole === "billing" || staffRole === "engineer" || showQaWorkspace,
        showSchedule: staffRole === "engineer" || staffRole === "coordinator" || staffRole === "admin",
        canUpdateJobStatus: staffRole === "engineer" || staffRole === "admin" || staffRole === "coordinator",
      },
    };
  }

  private assignedWorkWhere(role: StaffRole, userId: string): Prisma.ServiceRequestWhereInput {
    if (role === "admin" || role === "coordinator") return {};
    if (role === "inspector") {
      return { OR: [{ assignedInspectorId: userId }, { assignedTo: userId }] };
    }
    if (role === "estimator") {
      return { OR: [{ assignedEstimatorId: userId }, { assignedTo: userId }] };
    }
    if (role === "engineer") {
      return { OR: [{ assignedEngineerId: userId }, { assignedTo: userId }] };
    }
    if (this.isAssigneeScoped(role)) {
      return { assignedTo: userId };
    }
    return {};
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
      case "sales":
        return {
          ...base,
          assignedOpen: input.pendingInvoices,
          overdue: input.overdueInvoices,
          pendingApprovals: input.pendingInvoices,
          completedThisMonth: input.revenueMtd,
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
            (j) =>
              j.status === "inProgress" ||
              j.status === "partsPending" ||
              j.status === "review" ||
              j.status === "delivery",
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
      case "qa":
        return {
          ...base,
          assignedOpen: input.myJobs.length,
          inProgress: input.myJobs.length,
          pendingApprovals: input.myJobs.length,
          completedThisMonth: input.completedJobsMonth,
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
            return j.scheduledFor < start;
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
      type: string | null;
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
      type: string | null;
      status: string;
      priority: string;
      slaDue: Date;
    }>;
    estimateQueueRequests: Array<{
      id: string;
      reference: string;
      customerName: string;
      equipmentName: string | null;
      type: string | null;
      status: string;
      priority: string;
      slaDue: Date;
    }>;
    serviceQueue: Array<{
      id: string;
      reference: string;
      customerName: string;
      equipmentName: string | null;
      type: string | null;
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
      subtitle: r.type ? `${r.customerName} · ${r.type}` : r.customerName,
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
      href: `/app/jobs/${j.id}`,
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
            serviceRequestId: { not: null },
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

      case "sales": {
        const orders = await prisma.salesOrder.findMany({
          where: {
            tenantId: input.tenantId,
            OR: [{ deliveryStatus: { not: "delivered" } }, { paymentStatus: { not: "paid" } }],
          },
          orderBy: { updatedAt: "desc" },
          take: 10,
        });
        return orders.map((order) => ({
          id: order.id,
          kind: "invoice" as const,
          reference: order.reference,
          title: order.customerName,
          subtitle: `${order.salespersonName} · ${order.deliveryStatus}`,
          status: order.paymentStatus,
          href: "/app/sales",
        }));
      }

      case "engineer": {
        if (input.myJobs.length > 0) return input.myJobs.map(jobItem);
        return input.serviceQueue.map((r) => requestItem(r, "/app/jobs"));
      }

      case "qa":
        return input.myJobs.map(jobItem);

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
            select: {
              id: true,
              reference: true,
              supplier: true,
              items: true,
              status: true,
              expectedDate: true,
            },
          }),
          prisma.stockTransfer.findMany({
            where: { tenantId: input.tenantId, status: { in: ["pending", "inTransit"] } },
            orderBy: { updatedAt: "desc" },
            take: 4,
            select: {
              id: true,
              reference: true,
              fromBranch: true,
              toBranch: true,
              items: true,
              status: true,
              createdAt: true,
            },
          }),
          prisma.jobPartsRequest.findMany({
            where: { status: "pending", job: { tenantId: input.tenantId } },
            orderBy: { createdAt: "desc" },
            take: 4,
            select: {
              id: true,
              notes: true,
              status: true,
              createdAt: true,
              job: { select: { reference: true, customerName: true } },
            },
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
          select: {
            id: true,
            reference: true,
            customerName: true,
            equipmentName: true,
            type: true,
            status: true,
            priority: true,
            slaDue: true,
          },
        });
        return open.map((r) => requestItem(r));
      }
    }
  }
}

export const dashboardService = new DashboardService();
