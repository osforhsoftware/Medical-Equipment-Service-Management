import { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/db/prisma";
import { AppError } from "@/middleware/errorHandler";

type Actor = { userId: string; role: string };
type JsonObject = Record<string, unknown>;

const money = (value: Prisma.Decimal | number | string) =>
  new Prisma.Decimal(value).toDecimalPlaces(2);

const ref = (prefix: string) =>
  `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

async function assertJobAccess(tenantId: string, jobId: string, actor: Actor) {
  const job = await prisma.serviceJob.findFirst({
    where: {
      id: jobId,
      tenantId,
      ...(actor.role === "admin" || actor.role === "coordinator"
        ? {}
        : { OR: [{ engineerId: actor.userId }, { assignments: { some: { userId: actor.userId, endedAt: null } } }] }),
    },
  });
  if (!job) throw new AppError("Job not found or not assigned to this user", 404);
  return job;
}

export class DomainService {
  listCatalog(tenantId: string) {
    return prisma.serviceCatalogItem.findMany({ where: { tenantId }, orderBy: { name: "asc" } });
  }

  createCatalog(tenantId: string, data: JsonObject) {
    return prisma.serviceCatalogItem.create({ data: { ...data, tenantId } as never });
  }

  async updateCatalog(tenantId: string, id: string, data: JsonObject) {
    const result = await prisma.serviceCatalogItem.updateMany({ where: { id, tenantId }, data: data as never });
    if (!result.count) throw new AppError("Service catalog item not found", 404);
    return prisma.serviceCatalogItem.findUniqueOrThrow({ where: { id } });
  }

  async deleteCatalog(tenantId: string, id: string) {
    const result = await prisma.serviceCatalogItem.updateMany({
      where: { id, tenantId },
      data: { isActive: false },
    });
    if (!result.count) throw new AppError("Service catalog item not found", 404);
  }

  async addInspectionRecommendation(tenantId: string, reportId: string, actor: Actor, input: any) {
    const report = await prisma.inspectionReport.findFirst({
      where: {
        id: reportId,
        serviceRequest: {
          tenantId,
          ...(actor.role === "admin" || actor.role === "coordinator"
            ? {}
            : { OR: [{ assignedTo: actor.userId }, { createdBy: actor.userId }] }),
        },
      },
    });
    if (!report) throw new AppError("Inspection report not found or not assigned", 404);
    if (input.catalogItemId) {
      const catalogItem = await prisma.serviceCatalogItem.findFirst({
        where: { id: input.catalogItemId, tenantId, isActive: true },
      });
      if (!catalogItem) throw new AppError("Recommended service is unavailable", 404);
    }
    if (input.inventoryItemId) {
      const inventoryItem = await prisma.inventoryItem.findFirst({
        where: { id: input.inventoryItemId, tenantId },
      });
      if (!inventoryItem) throw new AppError("Recommended inventory item is unavailable", 404);
    }
    return prisma.inspectionRecommendation.create({ data: { inspectionReportId: reportId, ...input } });
  }

  async attachInspectionFile(tenantId: string, reportId: string, actor: Actor, input: any) {
    const [report, file] = await Promise.all([
      prisma.inspectionReport.findFirst({
        where: {
          id: reportId,
          serviceRequest: {
            tenantId,
            ...(actor.role === "admin" || actor.role === "coordinator"
              ? {}
              : { OR: [{ assignedTo: actor.userId }, { createdBy: actor.userId }] }),
          },
        },
      }),
      prisma.storedFile.findFirst({ where: { id: input.fileId, tenantId } }),
    ]);
    if (!report) throw new AppError("Inspection report not found or not assigned", 404);
    if (!file) throw new AppError("Uploaded file not found", 404);
    return prisma.inspectionAttachment.create({ data: { inspectionReportId: reportId, ...input } });
  }

  async createEstimateRevision(tenantId: string, estimateId: string, actor: Actor, input: any) {
    return prisma.$transaction(async (tx) => {
      const estimate = await tx.estimate.findFirst({ where: { id: estimateId, tenantId } });
      if (!estimate) throw new AppError("Estimate not found", 404);
      if (estimate.status === "approved") throw new AppError("Approved estimates cannot be revised", 409);

      let subtotal = new Prisma.Decimal(0);
      let tax = new Prisma.Decimal(0);
      const lines = input.lines.map((line: any) => {
        const gross = money(line.quantity).mul(money(line.unitPrice));
        const net = Prisma.Decimal.max(0, gross.minus(money(line.discount)));
        const lineTax = net.mul(new Prisma.Decimal(line.taxRate).div(100));
        const lineTotal = money(net.plus(lineTax));
        subtotal = subtotal.plus(net);
        tax = tax.plus(lineTax);
        return { ...line, lineTotal };
      });
      const discount = money(input.discount ?? 0);
      const total = money(Prisma.Decimal.max(0, subtotal.minus(discount)).plus(tax));
      const revisionNumber = estimate.revision + 1;

      await tx.estimateLineItem.deleteMany({ where: { estimateId } });
      const revision = await tx.estimateRevision.create({
        data: {
          tenantId,
          estimateId,
          revision: revisionNumber,
          subtotal: money(subtotal),
          discount,
          tax: money(tax),
          total,
          terms: input.terms,
          notes: input.notes,
          createdBy: actor.userId,
          snapshot: { lines: input.lines, terms: input.terms, notes: input.notes, discount: input.discount },
        },
      });
      await tx.estimateLineItem.createMany({
        data: lines.map((line: any) => ({
          estimateId,
          revisionId: revision.id,
          catalogItemId: line.catalogItemId,
          inventoryItemId: line.inventoryItemId,
          type: line.type,
          description: line.description,
          partNumber: line.partNumber,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          taxRate: line.taxRate,
          discount: line.discount,
          lineTotal: line.lineTotal,
        })),
      });
      await tx.estimate.update({
        where: { id: estimateId },
        data: {
          revision: revisionNumber,
          subtotal: money(subtotal),
          discount,
          tax: money(tax),
          total,
          laborCost: money(lines.filter((x: any) => x.type === "labor").reduce((s: number, x: any) => s + Number(x.lineTotal), 0)),
          partsCost: money(lines.filter((x: any) => x.type === "part").reduce((s: number, x: any) => s + Number(x.lineTotal), 0)),
          terms: input.terms,
          notes: input.notes,
          status: "draft",
        },
      });
      return tx.estimate.findUniqueOrThrow({
        where: { id: estimateId },
        include: { lineItems: true, revisions: { orderBy: { revision: "desc" } } },
      });
    });
  }

  async decideEstimate(tenantId: string, estimateId: string, actor: Actor, input: any) {
    return prisma.$transaction(async (tx) => {
      const estimate = await tx.estimate.findFirst({
        where: { id: estimateId, tenantId },
        include: { lineItems: true, serviceRequest: true },
      });
      if (!estimate) throw new AppError("Estimate not found", 404);
      if (!["sent", "revision"].includes(estimate.status)) {
        throw new AppError("Only sent estimates can receive a decision", 409);
      }
      if (actor.role === "customer") {
        const user = await tx.user.findFirst({ where: { id: actor.userId, tenantId } });
        if (!user?.customerId || user.customerId !== estimate.customerId) {
          throw new AppError("This estimate does not belong to the customer", 403);
        }
      }

      const status = input.decision as "approved" | "rejected" | "revision";
      await tx.estimateDecision.create({
        data: { tenantId, estimateId, decision: status, note: input.note, actorId: actor.userId, actorRole: actor.role },
      });
      await tx.estimate.update({
        where: { id: estimateId },
        data: { status, approvedAt: status === "approved" ? new Date() : null },
      });
      if (estimate.serviceRequestId) {
        await tx.serviceRequest.updateMany({
          where: { id: estimate.serviceRequestId, tenantId },
          data: { status: status === "approved" ? "approval" : "estimate" },
        });
      }

      if (status === "approved") {
        const settings = await tx.tenantSettings.findUnique({ where: { tenantId } });
        if (settings?.autoReserveOnApproval) {
          for (const line of estimate.lineItems) {
            if (!line.inventoryItemId) continue;
            const requestedQuantity = Math.ceil(Number(line.quantity));
            const item = await tx.inventoryItem.findFirst({ where: { id: line.inventoryItemId, tenantId } });
            if (!item) throw new AppError(`Inventory item not found for ${line.description}`, 404);
            const quantity = Math.min(requestedQuantity, Math.max(0, item.inStock - item.reserved));
            const shortageQuantity = requestedQuantity - quantity;
            const reservation = await tx.stockReservation.create({
              data: {
                tenantId,
                inventoryItemId: item.id,
                estimateId,
                requestedQuantity,
                shortageQuantity,
                quantity,
                status: shortageQuantity ? "shortage" : "active",
                reservedBy: actor.userId,
              },
            });
            if (quantity) {
              await tx.inventoryItem.update({ where: { id: item.id }, data: { reserved: { increment: quantity } } });
              await tx.stockMovement.create({
                data: {
                  tenantId,
                  inventoryItemId: item.id,
                  reservationId: reservation.id,
                  type: "reserve",
                  quantity: -quantity,
                  balanceAfter: item.inStock,
                  referenceType: "estimate",
                  referenceId: estimateId,
                  actorId: actor.userId,
                },
              });
            }
            if (shortageQuantity) {
              await tx.notification.create({
                data: {
                  tenantId,
                  type: "stock",
                  title: "Purchase required",
                  body: `${shortageQuantity} × ${item.name} (${item.sku}) required for ${estimate.reference}`,
                  recipientRole: "inventory",
                },
              });
            }
          }
        }
      }
      return tx.estimate.findUniqueOrThrow({
        where: { id: estimateId },
        include: { decisions: true, reservations: true },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async assignJob(tenantId: string, jobId: string, actor: Actor, input: any) {
    const job = await prisma.serviceJob.findFirst({ where: { id: jobId, tenantId } });
    if (!job) throw new AppError("Job not found", 404);
    const user = await prisma.user.findFirst({ where: { id: input.userId, tenantId, isActive: true } });
    if (!user) throw new AppError("Assignee not found", 404);
    return prisma.jobAssignment.upsert({
      where: { jobId_userId_role: { jobId, userId: input.userId, role: input.role } },
      create: { tenantId, jobId, userId: input.userId, role: input.role, isLead: input.isLead, assignedBy: actor.userId },
      update: { isLead: input.isLead, endedAt: null, assignedBy: actor.userId, assignedAt: new Date() },
    });
  }

  async addWorkLog(tenantId: string, jobId: string, actor: Actor, input: any) {
    await assertJobAccess(tenantId, jobId, actor);
    const endedAt = input.endedAt ? new Date(input.endedAt) : null;
    const startedAt = new Date(input.startedAt);
    if (endedAt && endedAt < startedAt) throw new AppError("Work log end must follow start", 422);
    const minutes = endedAt ? Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000)) : 0;
    return prisma.jobWorkLog.create({
      data: { ...input, tenantId, jobId, userId: actor.userId, startedAt, endedAt, minutes },
    });
  }

  async addJobExtra(tenantId: string, jobId: string, actor: Actor, input: any) {
    await assertJobAccess(tenantId, jobId, actor);
    if (input.inventoryItemId) {
      const item = await prisma.inventoryItem.findFirst({ where: { id: input.inventoryItemId, tenantId } });
      if (!item) throw new AppError("Inventory item not found", 404);
    }
    return prisma.jobExtra.create({ data: { ...input, tenantId, jobId, createdBy: actor.userId } });
  }

  async approveJobExtra(tenantId: string, id: string, actor: Actor) {
    const result = await prisma.jobExtra.updateMany({
      where: { id, tenantId, status: "pending" },
      data: { status: "approved", approvedBy: actor.userId, approvedAt: new Date() },
    });
    if (!result.count) throw new AppError("Pending job extra not found", 404);
    return prisma.jobExtra.findUniqueOrThrow({ where: { id } });
  }

  listReservations(tenantId: string, status?: string) {
    return prisma.stockReservation.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      include: { inventoryItem: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async actOnReservation(tenantId: string, id: string, actor: Actor, input: any) {
    return prisma.$transaction(async (tx) => {
      const reservation = await tx.stockReservation.findFirst({
        where: { id, tenantId, status: "active" },
        include: { inventoryItem: true },
      });
      if (!reservation) throw new AppError("Active reservation not found", 404);
      const remaining = reservation.quantity - reservation.consumed - reservation.released;
      if (input.quantity > remaining) throw new AppError("Quantity exceeds reservation remainder", 409);

      const consume = input.action === "consume";
      if (consume && reservation.inventoryItem.inStock < input.quantity) {
        throw new AppError("Insufficient stock to consume reservation", 409);
      }
      const consumed = reservation.consumed + (consume ? input.quantity : 0);
      const released = reservation.released + (consume ? 0 : input.quantity);
      const done = consumed + released === reservation.quantity;
      const item = await tx.inventoryItem.update({
        where: { id: reservation.inventoryItemId },
        data: {
          reserved: { decrement: input.quantity },
          ...(consume ? { inStock: { decrement: input.quantity } } : {}),
        },
      });
      const updated = await tx.stockReservation.update({
        where: { id },
        data: { consumed, released, status: done ? (consume && !released ? "consumed" : "closed") : "active" },
      });
      await tx.stockMovement.create({
        data: {
          tenantId,
          inventoryItemId: item.id,
          reservationId: id,
          jobId: reservation.jobId,
          type: consume ? "consume" : "release",
          quantity: consume ? -input.quantity : input.quantity,
          balanceAfter: item.inStock,
          referenceType: reservation.jobId ? "job" : "estimate",
          referenceId: reservation.jobId ?? reservation.estimateId,
          actorId: actor.userId,
        },
      });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  listStockMovements(tenantId: string, inventoryItemId?: string) {
    return prisma.stockMovement.findMany({
      where: { tenantId, ...(inventoryItemId ? { inventoryItemId } : {}) },
      include: { inventoryItem: { select: { sku: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
  }

  listStockTransfers(tenantId: string) {
    return prisma.stockTransfer.findMany({
      where: { tenantId },
      include: { lineItems: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async createStockTransfer(tenantId: string, input: any) {
    return prisma.$transaction(async (tx) => {
      const branches = await tx.branch.findMany({
        where: { tenantId, id: { in: [input.fromBranchId, input.toBranchId] } },
      });
      if (branches.length !== 2) throw new AppError("Source or destination branch not found", 404);
      const source = branches.find((branch) => branch.id === input.fromBranchId)!;
      const destination = branches.find((branch) => branch.id === input.toBranchId)!;
      const itemIds = input.lines.map((line: any) => line.inventoryItemId);
      const items = await tx.inventoryItem.findMany({
        where: { tenantId, branchId: source.id, id: { in: itemIds } },
      });
      if (items.length !== new Set(itemIds).size) throw new AppError("A transfer item is not in the source branch", 409);
      return tx.stockTransfer.create({
        data: {
          tenantId,
          fromBranchId: source.id,
          toBranchId: destination.id,
          fromBranch: source.name,
          toBranch: destination.name,
          reference: ref("TRF"),
          items: input.lines.length,
          lineItems: {
            create: input.lines.map((line: any) => {
              const item = items.find((candidate) => candidate.id === line.inventoryItemId)!;
              return {
                tenantId,
                sourceInventoryItemId: item.id,
                sku: item.sku,
                description: item.name,
                quantity: line.quantity,
              };
            }),
          },
        },
        include: { lineItems: true },
      });
    });
  }

  async dispatchStockTransfer(tenantId: string, id: string, actor: Actor) {
    return prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findFirst({
        where: { id, tenantId, status: "pending" },
        include: { lineItems: { include: { sourceInventoryItem: true } } },
      });
      if (!transfer) throw new AppError("Pending stock transfer not found", 404);
      for (const line of transfer.lineItems) {
        const available = line.sourceInventoryItem.inStock - line.sourceInventoryItem.reserved;
        if (available < line.quantity) {
          throw new AppError(`Insufficient available stock for ${line.description}. Available: ${available}`, 409);
        }
        const item = await tx.inventoryItem.update({
          where: { id: line.sourceInventoryItemId },
          data: { inStock: { decrement: line.quantity } },
        });
        await tx.stockMovement.create({
          data: {
            tenantId,
            inventoryItemId: item.id,
            type: "transfer_out",
            quantity: -line.quantity,
            balanceAfter: item.inStock,
            referenceType: "stock_transfer",
            referenceId: transfer.id,
            actorId: actor.userId,
          },
        });
      }
      return tx.stockTransfer.update({
        where: { id },
        data: { status: "inTransit", dispatchedAt: new Date() },
        include: { lineItems: true },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async receiveStockTransfer(tenantId: string, id: string, actor: Actor) {
    return prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findFirst({
        where: { id, tenantId, status: "inTransit" },
        include: { lineItems: { include: { sourceInventoryItem: true } } },
      });
      if (!transfer?.toBranchId) throw new AppError("In-transit stock transfer not found", 404);
      for (const line of transfer.lineItems) {
        let destinationItem = await tx.inventoryItem.findUnique({
          where: {
            tenantId_branchId_sku: {
              tenantId,
              branchId: transfer.toBranchId,
              sku: line.sku,
            },
          },
        });
        if (destinationItem) {
          destinationItem = await tx.inventoryItem.update({
            where: { id: destinationItem.id },
            data: { inStock: { increment: line.quantity } },
          });
        } else {
          const source = line.sourceInventoryItem;
          destinationItem = await tx.inventoryItem.create({
            data: {
              tenantId,
              branchId: transfer.toBranchId,
              sku: source.sku,
              name: source.name,
              category: source.category,
              inStock: line.quantity,
              reorderLevel: source.reorderLevel,
              unitCost: source.unitCost,
              supplier: source.supplier,
            },
          });
        }
        await tx.stockTransferLine.update({
          where: { id: line.id },
          data: {
            destinationInventoryItemId: destinationItem.id,
            quantityReceived: line.quantity,
          },
        });
        await tx.stockMovement.create({
          data: {
            tenantId,
            inventoryItemId: destinationItem.id,
            type: "transfer_in",
            quantity: line.quantity,
            balanceAfter: destinationItem.inStock,
            referenceType: "stock_transfer",
            referenceId: transfer.id,
            actorId: actor.userId,
          },
        });
      }
      return tx.stockTransfer.update({
        where: { id },
        data: { status: "received", receivedAt: new Date() },
        include: { lineItems: true },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async createPurchaseOrder(tenantId: string, input: any) {
    return prisma.$transaction(async (tx) => {
      if (input.supplierId) {
        const supplier = await tx.supplier.findFirst({ where: { id: input.supplierId, tenantId } });
        if (!supplier) throw new AppError("Supplier not found", 404);
      }
      for (const line of input.lines) {
        if (!line.inventoryItemId) continue;
        const item = await tx.inventoryItem.findFirst({ where: { id: line.inventoryItemId, tenantId } });
        if (!item) throw new AppError(`Inventory item not found for ${line.sku}`, 404);
      }
      const lines = input.lines.map((line: any) => {
        const net = money(line.quantityOrdered).mul(line.unitCost);
        return { ...line, lineTotal: money(net.plus(net.mul(new Prisma.Decimal(line.taxRate).div(100)))) };
      });
      const total = money(lines.reduce((sum: Prisma.Decimal, line: any) => sum.plus(line.lineTotal), new Prisma.Decimal(0)));
      return tx.purchaseOrder.create({
        data: {
          tenantId,
          supplierId: input.supplierId,
          supplier: input.supplier,
          branchId: input.branchId,
          reference: ref("PO"),
          items: lines.length,
          total,
          expectedDate: input.expectedDate,
          lineItems: { create: lines },
        },
        include: { lineItems: true },
      });
    });
  }

  async receivePurchaseOrder(tenantId: string, purchaseOrderId: string, actor: Actor, input: any) {
    return prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findFirst({
        where: { id: purchaseOrderId, tenantId, status: { notIn: ["cancelled", "received"] } },
        include: { lineItems: true },
      });
      if (!po) throw new AppError("Receivable purchase order not found", 404);
      const receipt = await tx.purchaseReceipt.create({
        data: { tenantId, purchaseOrderId, reference: input.reference, notes: input.notes, receivedBy: actor.userId },
      });
      for (const received of input.lines) {
        const line = po.lineItems.find((candidate) => candidate.id === received.purchaseOrderLineId);
        if (!line?.inventoryItemId) throw new AppError("Purchase order line is not linked to inventory", 409);
        if (received.quantity > line.quantityOrdered - line.quantityReceived) {
          throw new AppError(`Receipt exceeds outstanding quantity for ${line.description}`, 409);
        }
        const item = await tx.inventoryItem.update({
          where: { id: line.inventoryItemId },
          data: { inStock: { increment: received.quantity }, unitCost: line.unitCost },
        });
        await tx.purchaseOrderLine.update({
          where: { id: line.id },
          data: { quantityReceived: { increment: received.quantity } },
        });
        await tx.purchaseReceiptLine.create({
          data: {
            receiptId: receipt.id,
            purchaseOrderLineId: line.id,
            inventoryItemId: item.id,
            quantity: received.quantity,
            unitCost: line.unitCost,
          },
        });
        let allocatable = received.quantity;
        const shortages = await tx.stockReservation.findMany({
          where: {
            tenantId,
            inventoryItemId: item.id,
            status: "shortage",
            shortageQuantity: { gt: 0 },
          },
          orderBy: { createdAt: "asc" },
        });
        for (const shortage of shortages) {
          if (allocatable <= 0) break;
          const allocated = Math.min(allocatable, shortage.shortageQuantity);
          const remainingShortage = shortage.shortageQuantity - allocated;
          await tx.stockReservation.update({
            where: { id: shortage.id },
            data: {
              quantity: { increment: allocated },
              shortageQuantity: remainingShortage,
              status: remainingShortage === 0 ? "active" : "shortage",
            },
          });
          await tx.inventoryItem.update({
            where: { id: item.id },
            data: { reserved: { increment: allocated } },
          });
          await tx.stockMovement.create({
            data: {
              tenantId,
              inventoryItemId: item.id,
              reservationId: shortage.id,
              type: "reserve",
              quantity: -allocated,
              balanceAfter: item.inStock,
              referenceType: "purchase_order",
              referenceId: po.id,
              actorId: actor.userId,
            },
          });
          allocatable -= allocated;
        }
        await tx.stockMovement.create({
          data: {
            tenantId,
            inventoryItemId: item.id,
            type: "purchase_receipt",
            quantity: received.quantity,
            balanceAfter: item.inStock,
            referenceType: "purchase_order",
            referenceId: po.id,
            actorId: actor.userId,
          },
        });
      }
      const lines = await tx.purchaseOrderLine.findMany({ where: { purchaseOrderId } });
      const complete = lines.every((line) => line.quantityReceived >= line.quantityOrdered);
      await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: complete ? "received" : "partial" } });
      return tx.purchaseReceipt.findUniqueOrThrow({ where: { id: receipt.id }, include: { lines: true } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async createInvoiceFromJob(tenantId: string, actor: Actor, input: any) {
    return prisma.$transaction(async (tx) => {
      const job = await tx.serviceJob.findFirst({
        where: { id: input.jobId, tenantId, status: "completed" },
        include: {
          estimate: { include: { lineItems: true } },
          extras: { where: { status: "approved" } },
        },
      });
      if (!job?.estimate || job.estimate.status !== "approved") {
        throw new AppError("Completed job with an approved estimate is required", 409);
      }
      const existing = await tx.invoice.findFirst({ where: { tenantId, jobId: job.id, status: { not: "overdue" } } });
      if (existing) throw new AppError("An invoice already exists for this job", 409);

      const sourceLines = [
        ...job.estimate.lineItems.map((line) => ({
          estimateLineItemId: line.id,
          type: line.type,
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          taxRate: line.taxRate,
          discount: line.discount,
          lineTotal: line.lineTotal,
        })),
        ...job.extras.map((extra) => {
          const net = money(extra.quantity).mul(extra.unitPrice);
          return {
            jobExtraId: extra.id,
            type: "extra",
            description: extra.description,
            quantity: extra.quantity,
            unitPrice: extra.unitPrice,
            taxRate: extra.taxRate,
            discount: new Prisma.Decimal(0),
            lineTotal: money(net.plus(net.mul(extra.taxRate.div(100)))),
          };
        }),
      ];
      const amount = money(sourceLines.reduce((sum, line) =>
        sum.plus(money(line.quantity).mul(line.unitPrice).minus(line.discount)), new Prisma.Decimal(0)));
      const total = money(sourceLines.reduce((sum, line) => sum.plus(line.lineTotal), new Prisma.Decimal(0)));
      const tax = money(total.minus(amount));
      const invoice = await tx.invoice.create({
        data: {
          tenantId,
          customerId: job.customerId ?? job.estimate.customerId,
          serviceRequestId: job.serviceRequestId ?? job.estimate.serviceRequestId,
          estimateId: job.estimate.id,
          jobId: job.id,
          reference: ref("INV"),
          customerName: job.customerName,
          jobRef: job.reference,
          amount,
          tax,
          total,
          balanceDue: total,
          currency: input.currency.toUpperCase(),
          dueAt: input.dueAt,
          lineItems: { create: sourceLines },
        },
        include: { lineItems: true },
      });
      if (job.serviceRequestId) {
        await tx.serviceRequest.updateMany({
          where: { id: job.serviceRequestId, tenantId },
          data: { status: "invoiced" },
        });
      }
      return invoice;
    });
  }

  async recordPayment(tenantId: string, invoiceId: string, actor: Actor, input: any) {
    return prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, tenantId } });
      if (!invoice) throw new AppError("Invoice not found", 404);
      if (invoice.status === "draft") throw new AppError("Draft invoices cannot receive payments", 409);
      if (money(input.amount).greaterThan(invoice.balanceDue)) throw new AppError("Payment exceeds balance due", 409);
      await tx.invoicePayment.create({
        data: { tenantId, invoiceId, ...input, recordedBy: actor.userId },
      });
      const paidTotal = money(invoice.paidTotal.plus(input.amount));
      const balanceDue = money(invoice.total.minus(paidTotal));
      return tx.invoice.update({
        where: { id: invoiceId },
        data: { paidTotal, balanceDue, status: balanceDue.isZero() ? "paid" : "sent" },
        include: { payments: true, lineItems: true },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async equipmentHistory(tenantId: string, assetTag: string) {
    const equipment = await prisma.equipment.findFirst({ where: { tenantId, assetTag } });
    if (!equipment) throw new AppError("Equipment not found", 404);
    const [requests, jobs, invoices, scans] = await Promise.all([
      prisma.serviceRequest.findMany({
        where: { tenantId, OR: [{ equipmentId: equipment.id }, { equipmentItems: { some: { assetTag } } }] },
        include: { inspectionReport: { include: { recommendations: true, attachments: true } }, timelineEvents: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.serviceJob.findMany({
        where: { tenantId, equipmentId: equipment.id },
        include: { workLogs: true, extras: true, stockMovements: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.invoice.findMany({ where: { tenantId, job: { equipmentId: equipment.id } }, include: { lineItems: true } }),
      prisma.qrScan.findMany({ where: { tenantId, equipmentId: equipment.id }, orderBy: { scannedAt: "desc" }, take: 100 }),
    ]);
    return { equipment, requests, jobs, invoices, scans };
  }

  async projectDetails(tenantId: string, requestId: string, actor: Actor) {
    const project = await prisma.serviceRequest.findFirst({
      where: { id: requestId, tenantId },
      include: {
        customer: true,
        equipment: true,
        equipmentItems: true,
        timelineEvents: { orderBy: { at: "desc" } },
        inspectionReport: {
          include: {
            recommendations: { include: { catalogItem: true, inventoryItem: true } },
            attachments: { include: { file: true } },
          },
        },
        estimates: {
          include: {
            lineItems: true,
            revisions: { orderBy: { revision: "desc" } },
            decisions: { orderBy: { createdAt: "desc" } },
            reservations: { include: { inventoryItem: true } },
          },
          orderBy: { revision: "desc" },
        },
        serviceJobs: {
          include: {
            assignments: { where: { endedAt: null }, include: { user: true } },
            workLogs: { include: { user: true }, orderBy: { startedAt: "desc" } },
            extras: { orderBy: { createdAt: "desc" } },
            stockMovements: { include: { inventoryItem: true }, orderBy: { createdAt: "desc" } },
            projectExpenses: true,
          },
          orderBy: { createdAt: "desc" },
        },
        invoices: {
          include: { lineItems: true, payments: { orderBy: { paidAt: "desc" } }, commissions: true },
          orderBy: { issuedAt: "desc" },
        },
      },
    });
    if (!project) throw new AppError("Service project not found", 404);

    const canViewInternalFinance = actor.role === "admin" || actor.role === "billing";
    const revenue = project.invoices.reduce((sum, invoice) => sum.plus(invoice.total), new Prisma.Decimal(0));
    const paid = project.invoices.reduce((sum, invoice) => sum.plus(invoice.paidTotal), new Prisma.Decimal(0));
    const expenses = project.serviceJobs.flatMap((job) => job.projectExpenses);
    const expenseTotal = expenses.reduce((sum, expense) => sum.plus(expense.amount), new Prisma.Decimal(0));
    const productCost = project.serviceJobs
      .flatMap((job) => job.stockMovements)
      .filter((movement) => movement.type === "consume")
      .reduce(
        (sum, movement) => sum.plus(movement.inventoryItem.unitCost.mul(Math.abs(movement.quantity))),
        new Prisma.Decimal(0),
      );
    const commissionTotal = project.invoices
      .flatMap((invoice) => invoice.commissions)
      .reduce((sum, commission) => sum.plus(commission.amount), new Prisma.Decimal(0));

    const safeProject = canViewInternalFinance
      ? project
      : {
          ...project,
          serviceJobs: project.serviceJobs.map(({ projectExpenses: _expenses, stockMovements, ...job }) => ({
            ...job,
            stockMovements: stockMovements.map(({ inventoryItem: _inventoryItem, ...movement }) => movement),
          })),
          invoices: project.invoices.map(({ commissions: _commissions, ...invoice }) => invoice),
        };
    return {
      ...safeProject,
      internalFinance: canViewInternalFinance
        ? {
            revenue,
            paid,
            productCost,
            expenses: expenseTotal,
            commissions: commissionTotal,
            margin: revenue.minus(productCost).minus(expenseTotal).minus(commissionTotal),
          }
        : undefined,
    };
  }

  async customerPortal(tenantId: string, userId: string) {
    const user = await prisma.user.findFirst({ where: { id: userId, tenantId, role: "customer", isActive: true } });
    if (!user?.customerId) throw new AppError("Customer profile is not linked", 403);
    const customerId = user.customerId;
    const [customer, equipment, requests, estimates, invoices] = await Promise.all([
      prisma.customer.findFirst({ where: { id: customerId, tenantId } }),
      prisma.equipment.findMany({ where: { tenantId, customerId }, orderBy: { name: "asc" } }),
      prisma.serviceRequest.findMany({
        where: { tenantId, customerId },
        include: {
          equipmentItems: true,
          timelineEvents: { orderBy: { at: "desc" } },
          inspectionReport: {
            include: {
              recommendations: true,
              attachments: { include: { file: true } },
            },
          },
          serviceJobs: {
            include: {
              workLogs: {
                select: {
                  id: true,
                  startedAt: true,
                  endedAt: true,
                  workPerformed: true,
                  testingResult: true,
                  calibrationResult: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.estimate.findMany({
        where: { tenantId, customerId },
        include: {
          lineItems: true,
          decisions: { orderBy: { createdAt: "desc" } },
          revisions: { orderBy: { revision: "desc" } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.invoice.findMany({
        where: { tenantId, customerId },
        include: {
          lineItems: true,
          payments: { orderBy: { paidAt: "desc" } },
          documents: { where: { isInternal: false }, include: { file: true } },
        },
        orderBy: { issuedAt: "desc" },
      }),
    ]);
    if (!customer) throw new AppError("Customer not found", 404);
    const estimateDocuments = await prisma.document.findMany({
      where: {
        tenantId,
        entityType: "estimate",
        entityId: { in: estimates.map((estimate) => estimate.id) },
        isInternal: false,
      },
      include: { file: true },
      orderBy: { version: "desc" },
    });
    return {
      customer,
      equipment,
      requests,
      estimates,
      invoices,
      documents: estimateDocuments.map((document) => ({
        ...document,
        downloadUrl: `/api/files/${document.fileId}/download`,
      })),
    };
  }

  async recordQrScan(tenantId: string, actor: Actor, input: any, metadata: { ip?: string; userAgent?: string }) {
    const equipment = await prisma.equipment.findFirst({ where: { tenantId, assetTag: input.assetTag } });
    const scan = await prisma.qrScan.create({
      data: {
        tenantId,
        equipmentId: equipment?.id,
        assetTag: input.assetTag,
        scannedById: actor.userId,
        source: input.source,
        ip: metadata.ip,
        userAgent: metadata.userAgent,
      },
    });
    return { scan, equipment };
  }

  async listOfficeAssets(tenantId: string) {
    const assets = await prisma.officeAsset.findMany({
      where: { tenantId },
      include: { maintenance: { orderBy: { performedAt: "desc" } } },
      orderBy: { createdAt: "desc" },
    });
    const now = new Date();
    return assets.map((asset) => {
      const monthsUsed = asset.purchaseDate
        ? Math.max(0, (now.getFullYear() - asset.purchaseDate.getFullYear()) * 12 + now.getMonth() - asset.purchaseDate.getMonth())
        : 0;
      const depreciable = Prisma.Decimal.max(0, asset.purchaseCost.minus(asset.salvageValue));
      const depreciation = asset.depreciationMethod === "none" || !asset.usefulLifeMonths
        ? new Prisma.Decimal(0)
        : Prisma.Decimal.min(
            depreciable,
            depreciable.mul(Math.min(monthsUsed, asset.usefulLifeMonths)).div(asset.usefulLifeMonths),
          );
      return { ...asset, bookValue: money(asset.purchaseCost.minus(depreciation)), accumulatedDepreciation: money(depreciation) };
    });
  }
  createOfficeAsset(tenantId: string, data: JsonObject) {
    return prisma.officeAsset.create({ data: { ...data, tenantId } as never });
  }
  async updateOfficeAsset(tenantId: string, id: string, data: JsonObject) {
    const result = await prisma.officeAsset.updateMany({ where: { id, tenantId }, data: data as never });
    if (!result.count) throw new AppError("Office asset not found", 404);
    return prisma.officeAsset.findUniqueOrThrow({ where: { id }, include: { maintenance: true } });
  }
  async addOfficeAssetMaintenance(tenantId: string, id: string, actor: Actor, data: any) {
    return prisma.$transaction(async (tx) => {
      const asset = await tx.officeAsset.findFirst({ where: { id, tenantId } });
      if (!asset) throw new AppError("Office asset not found", 404);
      const maintenance = await tx.officeAssetMaintenance.create({
        data: {
          ...data,
          tenantId,
          officeAssetId: id,
          createdBy: actor.userId,
        },
      });
      await tx.officeAsset.update({
        where: { id },
        data: {
          lastMaintenanceAt: data.performedAt,
          nextMaintenanceAt: data.nextMaintenanceAt,
        },
      });
      if (Number(data.cost) > 0) {
        await tx.projectExpense.create({
          data: {
            tenantId,
            branchId: asset.branchId,
            category: "office-asset-maintenance",
            description: `${asset.assetTag}: ${data.description}`,
            amount: data.cost,
            incurredAt: data.performedAt,
            vendor: data.provider,
            createdBy: actor.userId,
          },
        });
      }
      return maintenance;
    });
  }
  listExpenses(tenantId: string) {
    return prisma.projectExpense.findMany({ where: { tenantId }, orderBy: { incurredAt: "desc" } });
  }
  createExpense(tenantId: string, actor: Actor, data: JsonObject) {
    return prisma.projectExpense.create({ data: { ...data, tenantId, createdBy: actor.userId } as never });
  }
  listReferrals(tenantId: string) {
    return prisma.referral.findMany({ where: { tenantId }, include: { commissions: true }, orderBy: { createdAt: "desc" } });
  }
  async createReferral(tenantId: string, data: any) {
    if (data.customerId) {
      const customer = await prisma.customer.findFirst({ where: { id: data.customerId, tenantId } });
      if (!customer) throw new AppError("Customer not found", 404);
    }
    if (data.serviceRequestId) {
      const request = await prisma.serviceRequest.findFirst({
        where: { id: data.serviceRequestId, tenantId },
      });
      if (!request) throw new AppError("Service request not found", 404);
      if (data.customerId && request.customerId !== data.customerId) {
        throw new AppError("Referral customer does not match the service request", 409);
      }
    }
    return prisma.referral.create({ data: { ...data, tenantId } });
  }
  listCommissions(tenantId: string) {
    return prisma.commission.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } });
  }
  async createCommission(tenantId: string, data: any) {
    if (data.referralId) {
      const referral = await prisma.referral.findFirst({ where: { id: data.referralId, tenantId } });
      if (!referral) throw new AppError("Referral not found", 404);
    }
    if (data.invoiceId) {
      const invoice = await prisma.invoice.findFirst({ where: { id: data.invoiceId, tenantId } });
      if (!invoice) throw new AppError("Invoice not found", 404);
    }
    return prisma.commission.create({
      data: { ...data, tenantId, amount: money(data.basisAmount).mul(new Prisma.Decimal(data.rate).div(100)) },
    });
  }
  async updateCommission(tenantId: string, id: string, actor: Actor, input: any) {
    return prisma.$transaction(async (tx) => {
      const commission = await tx.commission.findFirst({
        where: { id, tenantId },
        include: { invoice: { include: { serviceRequest: true } } },
      });
      if (!commission) throw new AppError("Commission not found", 404);
      const paidAt = input.status === "paid" ? (input.paidAt ?? new Date()) : null;
      const updated = await tx.commission.update({
        where: { id },
        data: { status: input.status, paidAt },
      });
      if (input.status === "paid" && commission.status !== "paid") {
        await tx.projectExpense.create({
          data: {
            tenantId,
            projectRef: commission.invoice?.serviceRequest?.reference,
            jobId: commission.invoice?.jobId,
            category: "commission",
            description: `Commission paid to ${commission.payeeName}`,
            amount: commission.amount,
            incurredAt: paidAt,
            createdBy: actor.userId,
          },
        });
      }
      return updated;
    });
  }

  listRoles(tenantId: string) {
    return prisma.role.findMany({ where: { tenantId }, include: { assignments: true }, orderBy: { name: "asc" } });
  }
  createRole(tenantId: string, data: any) {
    if ((Object.values(UserRole) as string[]).includes(data.key)) data.isSystem = true;
    return prisma.role.create({ data: { ...data, tenantId } });
  }
  async assignRole(tenantId: string, data: any) {
    const [user, role] = await Promise.all([
      prisma.user.findFirst({ where: { id: data.userId, tenantId } }),
      prisma.role.findFirst({ where: { id: data.roleId, tenantId } }),
    ]);
    if (!user || !role) throw new AppError("User or role not found", 404);
    const existing = await prisma.userRoleAssignment.findFirst({
      where: {
        tenantId,
        userId: data.userId,
        roleId: data.roleId,
        branchId: data.branchId ?? null,
      },
    });
    if (existing) return existing;
    return prisma.userRoleAssignment.create({ data: { ...data, tenantId } });
  }

  async unassignRole(tenantId: string, id: string) {
    const result = await prisma.userRoleAssignment.deleteMany({ where: { id, tenantId } });
    if (!result.count) throw new AppError("Role assignment not found", 404);
  }
}

export const domainService = new DomainService();
