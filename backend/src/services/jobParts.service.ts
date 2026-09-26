import { prisma } from "@/db/prisma";
import { AppError } from "@/middleware/errorHandler";
import {
  issuableRemaining,
  issuedRemaining,
  rollupPartsRequestStatus,
  trackingValue,
} from "@/lib/jobPartsRequest";
import { upsertOpenStockPurchaseRequest } from "@/lib/stockPurchaseRequest";
import { usersRepository } from "@/repositories/users.repository";
import { Prisma } from "@prisma/client";

const partsRequestInclude = {
  lines: { include: { inventoryItem: true }, orderBy: { createdAt: "asc" as const } },
  job: { select: { id: true, reference: true, customerName: true, engineer: true, status: true } },
};

function requireTracking(item: { trackBatches: boolean; trackSerials: boolean }, input: { batchNumber?: string | null; serialNumbers?: string | null }) {
  if (item.trackBatches && !trackingValue(input.batchNumber)) {
    throw new AppError("Batch number is required for this part", 422);
  }
  if (item.trackSerials && !trackingValue(input.serialNumbers)) {
    throw new AppError("Serial number is required for this part", 422);
  }
}

async function notifyRoles(
  tx: Prisma.TransactionClient,
  tenantId: string,
  title: string,
  body: string,
  roles: string[],
) {
  await tx.notification.createMany({
    data: roles.map((recipientRole) => ({
      tenantId,
      type: "stock",
      title,
      body,
      recipientRole,
    })),
  });
}

export class JobPartsService {
  async list(tenantId: string, status?: string) {
    return prisma.jobPartsRequest.findMany({
      where: {
        job: { tenantId },
        ...(status ? { status } : { status: { in: ["pending", "approved"] } }),
      },
      include: partsRequestInclude,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async approve(
    requestId: string,
    tenantId: string,
    actorId: string,
    lines?: { lineId: string; qtyApproved: number }[],
  ) {
    const actor = await usersRepository.findById(actorId, tenantId);
    const actorName = actor?.name ?? actorId;
    return prisma.$transaction(async (tx) => {
      const request = await tx.jobPartsRequest.findFirst({
        where: { id: requestId, job: { tenantId } },
        include: { lines: true, job: true },
      });
      if (!request) throw new AppError("Parts request not found", 404);
      if (request.status === "rejected") throw new AppError("Rejected requests cannot be approved", 409);
      if (request.status === "closed") throw new AppError("Closed requests cannot be approved", 409);

      if (request.lines.length === 0) {
        const updated = await tx.jobPartsRequest.update({
          where: { id: request.id },
          data: { status: "approved", approvedBy: actorName, approvedAt: new Date() },
          include: partsRequestInclude,
        });
        await tx.jobActivity.create({
          data: { jobId: request.jobId, actor: actorName, action: "Parts request approved", note: request.notes.slice(0, 200) },
        });
        await notifyRoles(tx, tenantId, "Parts approved", `Parts for ${request.job.reference} were approved.`, ["engineer", "admin"]);
        return updated;
      }

      for (const line of request.lines) {
        const override = lines?.find((row) => row.lineId === line.id);
        const qtyApproved = override ? override.qtyApproved : Math.max(line.qtyApproved, line.qtyRequested);
        if (qtyApproved < line.qtyIssued) {
          throw new AppError(`Approved quantity cannot be below already issued qty for ${line.sku}`, 409);
        }
        if (qtyApproved < 0) throw new AppError("Approved quantity cannot be negative", 400);
        await tx.jobPartsRequestLine.update({
          where: { id: line.id },
          data: { qtyApproved },
        });
      }

      const refreshed = await tx.jobPartsRequestLine.findMany({ where: { requestId: request.id } });
      const updated = await tx.jobPartsRequest.update({
        where: { id: request.id },
        data: {
          status: rollupPartsRequestStatus(refreshed, "approved"),
          approvedBy: actorName,
          approvedAt: new Date(),
        },
        include: partsRequestInclude,
      });
      await tx.jobActivity.create({
        data: {
          jobId: request.jobId,
          actor: actorName,
          action: "Parts request approved",
          note: refreshed.map((line) => `${line.qtyApproved} × ${line.sku}`).join(", ").slice(0, 200),
        },
      });
      await notifyRoles(tx, tenantId, "Parts approved", `Parts for ${request.job.reference} were approved.`, ["engineer", "admin"]);
      return updated;
    });
  }

  async reject(requestId: string, tenantId: string, actorId: string, reason?: string) {
    const actor = await usersRepository.findById(actorId, tenantId);
    const actorName = actor?.name ?? actorId;
    const request = await prisma.jobPartsRequest.findFirst({
      where: { id: requestId, job: { tenantId } },
      include: { lines: true, job: true },
    });
    if (!request) throw new AppError("Parts request not found", 404);
    if (request.lines.some((line) => line.qtyIssued > 0)) {
      throw new AppError("Cannot reject a request after stock has been issued", 409);
    }
    const updated = await prisma.jobPartsRequest.update({
      where: { id: request.id },
      data: { status: "rejected", rejectedReason: reason?.trim() || null, approvedBy: actorName, approvedAt: new Date() },
      include: partsRequestInclude,
    });
    await prisma.jobActivity.create({
      data: {
        jobId: request.jobId,
        actor: actorName,
        action: "Parts request rejected",
        note: (reason || request.notes).slice(0, 200),
      },
    });
    return updated;
  }

  async issue(
    requestId: string,
    tenantId: string,
    actorId: string,
    lines?: { lineId: string; quantity: number; batchNumber?: string; serialNumbers?: string }[],
  ) {
    const actor = await usersRepository.findById(actorId, tenantId);
    const actorName = actor?.name ?? actorId;
    return prisma.$transaction(async (tx) => {
      const request = await tx.jobPartsRequest.findFirst({
        where: { id: requestId, job: { tenantId } },
        include: { lines: { include: { inventoryItem: true } }, job: true },
      });
      if (!request) throw new AppError("Parts request not found", 404);
      if (request.status === "pending") throw new AppError("Approve this request before issuing stock", 409);
      if (request.status === "rejected") throw new AppError("Rejected requests cannot be issued", 409);
      if (request.lines.length === 0) throw new AppError("This request has no part lines to issue", 409);

      const issuedNotes: string[] = [];
      for (const line of request.lines) {
        const override = lines?.find((row) => row.lineId === line.id);
        const quantity = override?.quantity ?? issuableRemaining(line);
        if (quantity <= 0) continue;
        if (quantity > issuableRemaining(line)) {
          throw new AppError(`Cannot issue more than approved remaining qty for ${line.sku}`, 409);
        }
        const item = await tx.inventoryItem.findFirst({ where: { id: line.inventoryItemId, tenantId } });
        if (!item) throw new AppError("Inventory item not found", 404);
        requireTracking(item, {
          batchNumber: override?.batchNumber ?? line.batchNumber,
          serialNumbers: override?.serialNumbers ?? line.serialNumbers,
        });
        const reservation = await tx.stockReservation.findFirst({
          where: { tenantId, jobId: request.jobId, inventoryItemId: item.id, status: "active" },
          orderBy: { createdAt: "asc" },
        });
        const reservedRemaining = reservation
          ? reservation.quantity - reservation.consumed - reservation.released
          : 0;
        const reservedToUse = Math.min(quantity, Math.max(0, reservedRemaining));
        const freelyAvailable = item.inStock - item.reserved;
        if (item.inStock < quantity || freelyAvailable < quantity - reservedToUse) {
          const shortage = quantity - (freelyAvailable + reservedToUse);
          await upsertOpenStockPurchaseRequest(tx, {
            tenantId,
            inventoryItemId: item.id,
            quantity: Math.max(shortage, quantity),
            requestedBy: actorId,
            jobId: request.jobId,
            note: `Shortage while issuing stock for job ${request.job.reference}`,
          });
          throw new AppError(
            `Insufficient available stock for ${item.name}. Available: ${freelyAvailable + reservedToUse}. A stock purchase request was created.`,
            409,
          );
        }

        const stock = await tx.inventoryItem.update({
          where: { id: item.id },
          data: {
            inStock: { decrement: quantity },
            issued: { increment: quantity },
            ...(reservedToUse ? { reserved: { decrement: reservedToUse } } : {}),
          },
        });
        if (reservation && reservedToUse) {
          const consumed = reservation.consumed + reservedToUse;
          await tx.stockReservation.update({
            where: { id: reservation.id },
            data: {
              consumed,
              status: consumed + reservation.released >= reservation.quantity ? "consumed" : "active",
            },
          });
        }
        const batchNumber = trackingValue(override?.batchNumber ?? line.batchNumber);
        const serialNumber = trackingValue(override?.serialNumbers ?? line.serialNumbers);
        await tx.jobPartsRequestLine.update({
          where: { id: line.id },
          data: {
            qtyIssued: { increment: quantity },
            ...(batchNumber ? { batchNumber } : {}),
            ...(serialNumber ? { serialNumbers: serialNumber } : {}),
          },
        });
        await tx.stockMovement.create({
          data: {
            tenantId,
            inventoryItemId: item.id,
            reservationId: reservation?.id,
            jobId: request.jobId,
            type: "issue",
            quantity: -quantity,
            balanceAfter: stock.inStock,
            referenceType: "job_parts_request",
            referenceId: request.id,
            reason: `Issued to ${request.job.reference}`,
            batchNumber,
            serialNumber,
            actorId,
          },
        });
        issuedNotes.push(`${quantity} × ${item.name} (${item.sku})`);
      }

      if (issuedNotes.length === 0) {
        throw new AppError("Nothing left to issue on this request", 409);
      }

      const refreshed = await tx.jobPartsRequestLine.findMany({ where: { requestId: request.id } });
      const updated = await tx.jobPartsRequest.update({
        where: { id: request.id },
        data: { status: rollupPartsRequestStatus(refreshed, request.status) },
        include: partsRequestInclude,
      });
      await tx.jobActivity.create({
        data: {
          jobId: request.jobId,
          actor: actorName,
          action: "Parts issued",
          note: issuedNotes.join(", ").slice(0, 200),
        },
      });
      await notifyRoles(tx, tenantId, "Parts issued", `Stock issued for ${request.job.reference}.`, ["engineer", "admin"]);
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}

export const jobPartsService = new JobPartsService();
