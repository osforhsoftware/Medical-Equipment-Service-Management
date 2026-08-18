import { Prisma } from "@prisma/client";
import { prisma } from "@/db/prisma";
import { AppError } from "@/middleware/errorHandler";
import { serviceRequestsRepository } from "@/repositories/serviceRequests.repository";

export const BILLING_CHECKLIST = [
  { key: "engineerReportSubmitted", label: "Engineer Report Submitted" },
  { key: "inspectionCompleted", label: "Inspection Completed" },
  { key: "customerApprovalAvailable", label: "Customer Approval Available" },
  { key: "partsConsumptionRecorded", label: "Parts Consumption Recorded" },
  { key: "labourRecorded", label: "Labour Recorded" },
  { key: "serviceReportUploaded", label: "Service Report Uploaded" },
  { key: "customerSignatureAvailable", label: "Customer Signature Available" },
  { key: "equipmentReturned", label: "Equipment Returned" },
  { key: "warrantyUpdated", label: "Warranty Updated" },
  { key: "stockAdjusted", label: "Stock Adjusted" },
] as const;

export type BillingQueueKey =
  | "readyForBilling"
  | "waitingVerification"
  | "invoiceDraft"
  | "waitingApproval"
  | "invoiceSent"
  | "pendingPayment"
  | "partialPayment"
  | "paid"
  | "overdue"
  | "closed";

type Actor = { userId: string; role: string; name?: string };

const jobInclude = {
  estimate: { include: { lineItems: true, decisions: { orderBy: { createdAt: "desc" as const }, take: 1 } } },
  serviceRequest: {
    include: {
      inspectionReport: true,
      timelineEvents: { orderBy: { at: "desc" as const } },
      customer: true,
      equipment: true,
    },
  },
  equipment: true,
  customer: true,
  workLogs: true,
  signature: true,
  stockMovements: { where: { type: "consume" } },
  reservations: true,
  invoices: { include: { payments: true } },
} satisfies Prisma.ServiceJobInclude;

function num(v: Prisma.Decimal | number | string | null | undefined) {
  return Number(v ?? 0);
}

const money = (value: Prisma.Decimal | number | string) =>
  new Prisma.Decimal(value).toDecimalPlaces(2);

type InvoiceLineUpdateInput = {
  id?: string;
  type?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  discount?: number;
};

function partsCostFromJob(job: {
  stockMovements?: { quantity: number; inventoryItem?: { unitCost: Prisma.Decimal } | null }[];
  estimate?: { lineItems: { type: string; lineTotal: Prisma.Decimal }[] } | null;
}) {
  const fromMovements = (job.stockMovements ?? []).reduce((sum, m) => {
    const cost = m.inventoryItem ? num(m.inventoryItem.unitCost) : 0;
    return sum + cost * Math.abs(m.quantity);
  }, 0);
  if (fromMovements > 0) return fromMovements;
  return (job.estimate?.lineItems ?? [])
    .filter((l) => l.type === "part" || l.type === "parts")
    .reduce((sum, l) => sum + num(l.lineTotal), 0);
}

function labourFromEstimate(estimate?: { lineItems: { type: string; lineTotal: Prisma.Decimal }[] } | null) {
  return (estimate?.lineItems ?? [])
    .filter((l) => l.type === "labour" || l.type === "labor" || l.type === "service")
    .reduce((sum, l) => sum + num(l.lineTotal), 0);
}

export function computeVerificationChecklist(job: {
  status: string;
  workLogs?: unknown[];
  signature: unknown | null;
  stockMovements?: unknown[];
  reservations?: { status: string; quantity: number; consumed: number; released: number }[];
  estimate?: { status: string; lineItems: { type: string }[] } | null;
  serviceRequest?: {
    inspectionReport: unknown | null;
    status: string;
  } | null;
  serviceReportDoc?: boolean;
}) {
  const estimate = job.estimate;
  const workLogs = job.workLogs ?? [];
  const stockMovements = job.stockMovements ?? [];
  const reservations = job.reservations ?? [];
  const hasPartsInEstimate = (estimate?.lineItems ?? []).some(
    (l) => l.type === "part" || l.type === "parts",
  );
  const hasLabourInEstimate = (estimate?.lineItems ?? []).some(
    (l) => l.type === "labour" || l.type === "labor" || l.type === "service",
  );
  const stockOk = reservations.every((r) => {
    const remaining = r.quantity - r.consumed - r.released;
    return remaining <= 0 || r.status === "consumed" || r.status === "released";
  });

  const checks: Record<string, boolean> = {
    engineerReportSubmitted: workLogs.length > 0,
    inspectionCompleted: !!job.serviceRequest?.inspectionReport,
    customerApprovalAvailable: estimate?.status === "approved",
    partsConsumptionRecorded: !hasPartsInEstimate || stockMovements.length > 0,
    labourRecorded: !hasLabourInEstimate || workLogs.length > 0,
    serviceReportUploaded: !!job.serviceReportDoc,
    customerSignatureAvailable: !!job.signature,
    equipmentReturned: job.status === "completed",
    warrantyUpdated: job.status === "completed",
    stockAdjusted: stockOk,
  };

  const allPassed = Object.values(checks).every(Boolean);
  return { checks, allPassed, items: BILLING_CHECKLIST.map((item) => ({ ...item, passed: checks[item.key] })) };
}

function invoicePaymentStatus(invoice: {
  status: string;
  paidTotal: Prisma.Decimal;
  balanceDue: Prisma.Decimal;
}): "none" | "pending" | "partial" | "paid" | "overdue" {
  if (invoice.status === "overdue") return "overdue";
  if (invoice.status === "paid" || invoice.status === "closed") return "paid";
  const paid = num(invoice.paidTotal);
  const balance = num(invoice.balanceDue);
  if (paid <= 0 && balance > 0) return "pending";
  if (paid > 0 && balance > 0) return "partial";
  if (balance <= 0) return "paid";
  return "none";
}

function classifyInvoiceQueue(
  invoice: {
    status: string;
    paidTotal: Prisma.Decimal;
    balanceDue: Prisma.Decimal;
  },
  ticketStatus?: string,
): BillingQueueKey {
  if (invoice.status === "closed" || ticketStatus === "finished") return "closed";
  if (invoice.status === "paid") return "paid";
  if (invoice.status === "overdue") return "overdue";
  if (invoice.status === "pendingApproval") return "waitingApproval";
  if (invoice.status === "draft" || invoice.status === "approved") return "invoiceDraft";
  const pay = invoicePaymentStatus(invoice);
  if (pay === "partial") return "partialPayment";
  if (pay === "pending") return "pendingPayment";
  return "invoiceSent";
}

export class BillingService {
  async syncOverdueInvoices(tenantId: string) {
    const now = new Date();
    await prisma.invoice.updateMany({
      where: {
        tenantId,
        status: { in: ["sent", "approved"] },
        dueAt: { lt: now },
        balanceDue: { gt: 0 },
      },
      data: { status: "overdue" },
    });
  }

  async getQueue(tenantId: string, queue?: BillingQueueKey) {
    await this.syncOverdueInvoices(tenantId);

    const [completedJobs, invoices] = await Promise.all([
      prisma.serviceJob.findMany({
        where: { tenantId, status: "completed" },
        include: {
          ...jobInclude,
          invoices: { where: { status: { not: "closed" } }, take: 1 },
        },
        orderBy: { completedAt: "desc" },
      }),
      prisma.invoice.findMany({
        where: { tenantId },
        include: {
          job: {
            include: {
              estimate: { include: { lineItems: true } },
              serviceRequest: { include: { customer: true, equipment: true } },
              equipment: true,
            },
          },
          payments: true,
          serviceRequest: true,
        },
        orderBy: { issuedAt: "desc" },
      }),
    ]);

    const serviceReportDocs = await prisma.document.findMany({
      where: { tenantId, kind: "service-report", entityType: { in: ["job", "service-request"] } },
      select: { entityType: true, entityId: true },
    });
    const reportSet = new Set(serviceReportDocs.map((d) => `${d.entityType}:${d.entityId}`));

    const rows: Array<Record<string, unknown> & { queue: BillingQueueKey }> = [];

    for (const job of completedJobs) {
      const hasInvoice = job.invoices.length > 0 || invoices.some((inv) => inv.jobId === job.id);
      if (hasInvoice) continue;

      const serviceReportDoc =
        reportSet.has(`job:${job.id}`) ||
        (job.serviceRequestId ? reportSet.has(`service-request:${job.serviceRequestId}`) : false);
      const verification = computeVerificationChecklist({ ...job, serviceReportDoc });
      const q: BillingQueueKey =
        verification.allPassed && job.billingVerifiedAt ? "readyForBilling" : "waitingVerification";

      rows.push(this.toRow(job, null, q, verification));
    }

    for (const invoice of invoices) {
      const job = invoice.job;
      if (!job) continue;
      const q = classifyInvoiceQueue(invoice, invoice.serviceRequest?.status);
      rows.push(this.toRow(job, invoice, q, { allPassed: true }));
    }

    const counts = {} as Record<BillingQueueKey, number>;
    for (const key of [
      "readyForBilling",
      "waitingVerification",
      "invoiceDraft",
      "waitingApproval",
      "invoiceSent",
      "pendingPayment",
      "partialPayment",
      "paid",
      "overdue",
      "closed",
    ] as BillingQueueKey[]) {
      counts[key] = rows.filter((r) => r.queue === key).length;
    }

    return { counts, items: queue ? rows.filter((r) => r.queue === queue) : rows };
  }

  private toRow(
    job: {
      id: string;
      reference: string;
      serviceRequestId: string | null;
      requestRef: string;
      customerName: string;
      customerId: string | null;
      equipmentName: string;
      engineer: string;
      completedAt: Date | null;
      billingVerifiedAt: Date | null;
      estimate?: { total: Prisma.Decimal; lineItems: { type: string; lineTotal: Prisma.Decimal }[] } | null;
      serviceRequest?: {
        priority: string;
        customer?: { name: string } | null;
        equipment?: { serialNumber: string } | null;
      } | null;
      equipment?: { serialNumber: string } | null;
      stockMovements?: { quantity: number; inventoryItem?: { unitCost: Prisma.Decimal } | null }[];
    },
    invoice: {
      id: string;
      reference: string;
      status: string;
      total: Prisma.Decimal;
      paidTotal: Prisma.Decimal;
      balanceDue: Prisma.Decimal;
    } | null,
    queue: BillingQueueKey,
    verification: { allPassed: boolean },
  ) {
    const partsCost = partsCostFromJob(job as never);
    const labour = labourFromEstimate(job.estimate);
    const serial = job.equipment?.serialNumber ?? job.serviceRequest?.equipment?.serialNumber ?? null;
    const hospital = job.serviceRequest?.customer?.name ?? job.customerName;

    let verificationStatus: string;
    if (job.billingVerifiedAt) verificationStatus = "verified";
    else if (verification.allPassed) verificationStatus = "passed";
    else verificationStatus = "pending";

    const paymentStatus = invoice ? invoicePaymentStatus(invoice as never) : "none";

    return {
      queue,
      id: invoice?.id ?? job.id,
      jobId: job.id,
      invoiceId: invoice?.id ?? null,
      priority: job.serviceRequest?.priority ?? "medium",
      serviceRequestRef: job.requestRef,
      serviceRequestId: job.serviceRequestId,
      jobNumber: job.reference,
      customer: job.customerName,
      customerId: job.customerId,
      equipment: job.equipmentName,
      serialNumber: serial,
      hospital,
      engineer: job.engineer,
      completionDate: job.completedAt?.toISOString() ?? null,
      verificationStatus,
      estimateAmount: num(job.estimate?.total),
      actualPartsCost: partsCost,
      labourCharges: labour,
      invoiceStatus: invoice?.status ?? null,
      invoiceRef: invoice?.reference ?? null,
      paymentStatus,
      total: invoice ? num(invoice.total) : num(job.estimate?.total),
      balanceDue: invoice ? num(invoice.balanceDue) : num(job.estimate?.total),
      paidTotal: invoice ? num(invoice.paidTotal) : 0,
    };
  }

  async getJobContext(tenantId: string, jobId: string) {
    const job = await prisma.serviceJob.findFirst({
      where: { id: jobId, tenantId },
      include: {
        ...jobInclude,
        photos: { include: { file: true } },
        extras: { where: { status: "approved" } },
        invoices: { include: { lineItems: true, payments: { orderBy: { paidAt: "desc" } }, documents: true } },
        stockMovements: { include: { inventoryItem: true } },
      },
    });
    if (!job) throw new AppError("Job not found", 404);

    const [serviceReportDoc, project] = await Promise.all([
      prisma.document.findFirst({
        where: {
          tenantId,
          kind: "service-report",
          OR: [
            { entityType: "job", entityId: jobId },
            ...(job.serviceRequestId ? [{ entityType: "service-request", entityId: job.serviceRequestId }] : []),
          ],
        },
      }),
      job.serviceRequestId
        ? prisma.serviceRequest.findFirst({
            where: { id: job.serviceRequestId, tenantId },
            include: {
              inspectionReport: { include: { recommendations: true, attachments: { include: { file: true } } } },
              timelineEvents: { orderBy: { at: "asc" } },
              estimates: { include: { lineItems: true, decisions: true }, orderBy: { revision: "desc" }, take: 1 },
            },
          })
        : null,
    ]);

    const verification = computeVerificationChecklist({ ...job, serviceReportDoc: !!serviceReportDoc });
    const invoice = job.invoices[0] ?? null;

    return {
      job,
      verification,
      invoice,
      serviceReportDoc,
      project,
      costs: {
        estimateAmount: num(job.estimate?.total),
        partsCost: partsCostFromJob(job),
        labourCharges: labourFromEstimate(job.estimate),
        discount: num(job.estimate?.discount),
      },
    };
  }

  async verifyJob(tenantId: string, jobId: string, actor: Actor) {
    const ctx = await this.getJobContext(tenantId, jobId);
    if (ctx.job.status !== "completed") throw new AppError("Only completed jobs can be billing-verified", 409);
    if (!ctx.verification.allPassed) {
      throw new AppError("All verification checkpoints must pass before billing verification", 422);
    }
    if (ctx.job.invoices.length) throw new AppError("Invoice already exists for this job", 409);

    const user = await prisma.user.findFirst({ where: { id: actor.userId, tenantId } });
    const actorName = user?.name ?? actor.name ?? actor.userId;

    const updated = await prisma.serviceJob.update({
      where: { id: jobId },
      data: { billingVerifiedAt: new Date(), billingVerifiedBy: actorName },
    });

    if (ctx.job.serviceRequestId) {
      await serviceRequestsRepository.addTimelineEvent(
        ctx.job.serviceRequestId,
        actorName,
        "Billing verified",
        "All completion checkpoints passed; ready for invoice generation.",
      );
    }

    return updated;
  }

  async submitInvoiceForApproval(tenantId: string, invoiceId: string, actor: Actor) {
    const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, tenantId } });
    if (!invoice) throw new AppError("Invoice not found", 404);
    if (invoice.status !== "draft") throw new AppError("Only draft invoices can be submitted for approval", 409);

    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "pendingApproval" },
      include: { lineItems: true, payments: true },
    });

    if (invoice.serviceRequestId) {
      const user = await prisma.user.findFirst({ where: { id: actor.userId, tenantId } });
      await serviceRequestsRepository.addTimelineEvent(
        invoice.serviceRequestId,
        user?.name ?? actor.userId,
        "Invoice submitted for approval",
        invoice.reference,
      );
    }
    return updated;
  }

  async approveInvoice(tenantId: string, invoiceId: string, actor: Actor) {
    const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, tenantId } });
    if (!invoice) throw new AppError("Invoice not found", 404);
    if (invoice.status !== "pendingApproval") throw new AppError("Invoice is not pending approval", 409);

    const user = await prisma.user.findFirst({ where: { id: actor.userId, tenantId } });
    const actorName = user?.name ?? actor.userId;

    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "approved", approvedAt: new Date(), approvedBy: actorName },
      include: { lineItems: true, payments: true },
    });

    if (invoice.serviceRequestId) {
      await serviceRequestsRepository.addTimelineEvent(
        invoice.serviceRequestId,
        actorName,
        "Invoice approved",
        invoice.reference,
      );
    }
    return updated;
  }

  async markInvoiceSent(tenantId: string, invoiceId: string, actor: Actor) {
    const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, tenantId } });
    if (!invoice) throw new AppError("Invoice not found", 404);
    if (invoice.status !== "approved") {
      throw new AppError("Invoice must be approved before sending", 409);
    }

    const user = await prisma.user.findFirst({ where: { id: actor.userId, tenantId } });
    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "sent", sentAt: new Date() },
      include: { lineItems: true, payments: true },
    });

    if (invoice.serviceRequestId) {
      await serviceRequestsRepository.addTimelineEvent(
        invoice.serviceRequestId,
        user?.name ?? actor.userId,
        "Invoice sent",
        invoice.reference,
      );
    }
    return updated;
  }

  async updateInvoice(
    tenantId: string,
    invoiceId: string,
    actor: Actor,
    input: { dueAt?: Date; lineItems?: InvoiceLineUpdateInput[] },
  ) {
    if (!input.dueAt && !input.lineItems?.length) {
      throw new AppError("Nothing to update", 422);
    }

    return prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId, tenantId },
        include: { lineItems: true, payments: true },
      });
      if (!invoice) throw new AppError("Invoice not found", 404);
      if (!["draft", "pendingApproval"].includes(invoice.status)) {
        throw new AppError("Only draft or pending-approval invoices can be edited", 409);
      }
      if (invoice.payments.length > 0) {
        throw new AppError("Invoices with payments cannot be edited", 409);
      }

      const updateData: Prisma.InvoiceUpdateInput = {};
      if (input.dueAt) updateData.dueAt = input.dueAt;

      if (input.lineItems?.length) {
        const existingById = new Map(invoice.lineItems.map((line) => [line.id, line]));
        const keptIds = new Set<string>();
        const computedLines = input.lineItems.map((lineInput) => {
          const qty = money(lineInput.quantity);
          const unitPrice = money(lineInput.unitPrice);
          const discount = money(lineInput.discount ?? 0);
          const taxRate = money(lineInput.taxRate ?? 0);
          const net = money(qty.mul(unitPrice).minus(discount));
          const lineTotal = money(net.plus(net.mul(taxRate.div(100))));
          const existing = lineInput.id ? existingById.get(lineInput.id) : undefined;
          if (lineInput.id) keptIds.add(lineInput.id);

          return {
            id: lineInput.id,
            estimateLineItemId: existing?.estimateLineItemId ?? null,
            jobExtraId: existing?.jobExtraId ?? null,
            catalogItemId: existing?.catalogItemId ?? null,
            type: lineInput.type ?? existing?.type ?? "adjustment",
            description: lineInput.description.trim(),
            quantity: qty,
            unitPrice,
            taxRate,
            discount,
            lineTotal,
          };
        });

        const amount = money(
          computedLines.reduce(
            (sum, line) => sum.plus(money(line.quantity).mul(line.unitPrice).minus(line.discount)),
            new Prisma.Decimal(0),
          ),
        );
        const total = money(
          computedLines.reduce((sum, line) => sum.plus(line.lineTotal), new Prisma.Decimal(0)),
        );

        updateData.amount = amount;
        updateData.tax = money(total.minus(amount));
        updateData.total = total;
        updateData.balanceDue = total;

        const removedIds = invoice.lineItems.filter((line) => !keptIds.has(line.id)).map((line) => line.id);
        if (removedIds.length) {
          await tx.invoiceLineItem.deleteMany({ where: { id: { in: removedIds } } });
        }

        for (const line of computedLines) {
          if (line.id && existingById.has(line.id)) {
            await tx.invoiceLineItem.update({
              where: { id: line.id },
              data: {
                type: line.type,
                description: line.description,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                taxRate: line.taxRate,
                discount: line.discount,
                lineTotal: line.lineTotal,
              },
            });
          } else {
            await tx.invoiceLineItem.create({
              data: {
                invoiceId,
                estimateLineItemId: line.estimateLineItemId,
                jobExtraId: line.jobExtraId,
                catalogItemId: line.catalogItemId,
                type: line.type,
                description: line.description,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                taxRate: line.taxRate,
                discount: line.discount,
                lineTotal: line.lineTotal,
              },
            });
          }
        }
      }

      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: updateData,
        include: { lineItems: true, payments: { orderBy: { paidAt: "desc" } } },
      });

      if (invoice.serviceRequestId && input.lineItems?.length) {
        const user = await tx.user.findFirst({ where: { id: actor.userId, tenantId } });
        await serviceRequestsRepository.addTimelineEvent(
          invoice.serviceRequestId,
          user?.name ?? actor.userId,
          "Invoice updated",
          `${invoice.reference} revised before approval`,
        );
      }

      return updated;
    });
  }
}

export const billingService = new BillingService();
