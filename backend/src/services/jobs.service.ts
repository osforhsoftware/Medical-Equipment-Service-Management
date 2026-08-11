import { jobsRepository } from "@/repositories/jobs.repository";
import { jobActionsRepository } from "@/repositories/jobActions.repository";
import { serviceRequestsRepository } from "@/repositories/serviceRequests.repository";
import { usersRepository } from "@/repositories/users.repository";
import { notificationsService } from "@/services/notifications.service";
import { AppError } from "@/middleware/errorHandler";
import { generateReference } from "@/utils/reference";
import { prisma } from "@/db/prisma";
import { Prisma } from "@prisma/client";
import {
  assertJobTransition,
  resolveTicketEventStatus,
} from "@/services/workflow/serviceTicketStateMachine";
import { fileStorageService } from "@/services/fileStorage.service";
import {
  closeAllOpenWorkLogs,
  closeWorkLog,
  resolveWorkLogUserId,
  startWorkLog,
} from "@/services/jobWorkLog.helpers";

const ASSIGNABLE_JOB_ROLES = ["coordinator", "engineer"];

type CreateJobData = {
  serviceRequestId: string;
  engineerId: string;
  scheduledFor: string;
  status?: string;
  progress?: number;
};

export class JobsService {
  private async syncWorkLogForStatusChange(
    tenantId: string,
    jobId: string,
    job: { engineerId: string | null },
    actorId: string | undefined,
    previousStatus: string,
    nextStatus: string,
  ) {
    const userId = resolveWorkLogUserId(job, actorId);
    if (!userId || previousStatus === nextStatus) return;

    if (nextStatus === "inProgress" && (previousStatus === "scheduled" || previousStatus === "partsPending")) {
      await startWorkLog(prisma, tenantId, jobId, userId, "Field work started");
      return;
    }
    if (nextStatus === "partsPending" || nextStatus === "review") {
      const note =
        nextStatus === "partsPending" ? "Work paused — parts pending" : "Work paused — awaiting review";
      await closeWorkLog(prisma, tenantId, jobId, userId, note);
    }
  }

  private async resolveAssignee(engineerId: string, tenantId: string) {
    const assignee = await usersRepository.findById(engineerId, tenantId);
    if (!assignee) throw new AppError("Staff user not found", 404);
    const assignedOperationalRole = await prisma.userRoleAssignment.findFirst({
      where: {
        tenantId,
        userId: engineerId,
        role: { key: { in: ASSIGNABLE_JOB_ROLES } },
      },
    });
    if (!ASSIGNABLE_JOB_ROLES.includes(assignee.role) && !assignedOperationalRole) {
      throw new AppError("Only Service Coordinator or Service Engineer can be assigned", 400);
    }
    return assignee;
  }

  async getAll(tenantId: string, actorId?: string, actorRole?: string, status?: string) {
    let engineerId: string | undefined;
    if (actorRole === "engineer" && actorId) {
      engineerId = actorId;
    }
    return jobsRepository.findAll(tenantId, { status, engineerId });
  }

  private async assertJobAccess(
    job: { id: string; engineerId: string | null; engineer: string },
    tenantId: string,
    actorId?: string,
    actorRole?: string,
  ) {
    if (!actorRole || actorRole === "admin" || actorRole === "coordinator") return;
    if (actorRole === "engineer" && actorId) {
      if (job.engineerId && job.engineerId === actorId) return;
      const assignment = await prisma.jobAssignment.findFirst({
        where: { tenantId, jobId: job.id, userId: actorId, endedAt: null },
      });
      if (assignment) return;
      const actor = await usersRepository.findById(actorId, tenantId);
      if (job.engineer === actor?.name) return;
    }
    throw new AppError("Access denied", 403);
  }

  async getById(id: string, tenantId: string, actorId?: string, actorRole?: string) {
    const job = await jobsRepository.findById(id, tenantId);
    if (!job) throw new AppError("Job not found", 404);
    await this.assertJobAccess(job, tenantId, actorId, actorRole);
    return job;
  }

  async create(tenantId: string, data: CreateJobData, actorId: string) {
    const sr = await serviceRequestsRepository.findById(data.serviceRequestId, tenantId);
    if (!sr) throw new AppError("Service request not found", 404);

    const assignee = await this.resolveAssignee(data.engineerId, tenantId);
    const reference = await generateReference(tenantId, "JOB", "serviceJob");
    return prisma.$transaction(async (tx) => {
      const estimate = await tx.estimate.findFirst({
        where: {
          tenantId,
          status: "approved",
          OR: [{ serviceRequestId: sr.id }, { requestRef: sr.reference }],
        },
        orderBy: { revision: "desc" },
      });
      if (!estimate) throw new AppError("An approved estimate is required before scheduling", 409);
      const duplicate = await tx.serviceJob.findFirst({
        where: { tenantId, OR: [{ serviceRequestId: sr.id }, { requestRef: sr.reference }] },
      });
      if (duplicate) throw new AppError("A job already exists for this service request", 409);
      const job = await tx.serviceJob.create({
        data: {
          tenantId,
          serviceRequestId: sr.id,
          estimateId: estimate.id,
          customerId: sr.customerId,
          equipmentId: sr.equipmentId,
          reference,
          requestRef: sr.reference,
          customerName: sr.customerName,
          equipmentName: (sr.equipmentName ?? "Equipment").split(" (")[0],
          engineer: assignee.name,
          engineerId: assignee.id,
          type: sr.type,
          typeOther: sr.typeOther,
          status: (data.status ?? "scheduled") as never,
          scheduledFor: new Date(data.scheduledFor),
          progress: data.progress ?? 0,
          assignments: {
            create: {
              tenantId,
              userId: assignee.id,
              role: "engineer",
              isLead: true,
              assignedBy: actorId,
            },
          },
          activities: {
            create: { actor: assignee.name, action: "Job scheduled", note: `Assigned to ${assignee.name}` },
          },
        },
      });
      await tx.stockReservation.updateMany({
        where: { tenantId, estimateId: estimate.id, jobId: null, status: "active" },
        data: { jobId: job.id },
      });
      await tx.serviceRequest.update({
        where: { id: sr.id },
        data: { status: resolveTicketEventStatus(sr.status, "jobScheduled") as never },
      });
      return job;
    });
  }

  async update(id: string, tenantId: string, data: Record<string, unknown>, actorId?: string, actorRole?: string) {
    const existing = await this.getById(id, tenantId, actorId, actorRole);

    if (
      actorRole === "engineer" &&
      Object.keys(data).some((field) => !["status", "progress"].includes(field))
    ) {
      throw new AppError("Engineers can only update job status and progress", 403);
    }

    if (data.status && data.status !== existing.status) {
      assertJobTransition(existing.status, String(data.status));
    }

    if (data.engineerId) {
      const assignee = await this.resolveAssignee(String(data.engineerId), tenantId);
      data.engineer = assignee.name;
    }

    if (data.scheduledFor) {
      data.scheduledFor = new Date(data.scheduledFor as string);
    }

    if (data.status === "completed" && existing.status !== "completed") {
      const sig = await prisma.jobSignature.findUnique({ where: { jobId: id } });
      if (!sig) throw new AppError("Customer sign-off is required before completing the job", 409);
      const updated = await prisma.$transaction(async (tx) => {
        const job = await tx.serviceJob.findFirst({
          where: { id, tenantId },
          include: { reservations: { where: { status: "active" } } },
        });
        if (!job) throw new AppError("Job not found", 404);
        for (const reservation of job.reservations) {
          const remaining = reservation.quantity - reservation.consumed - reservation.released;
          if (remaining <= 0) continue;
          const item = await tx.inventoryItem.findFirst({ where: { id: reservation.inventoryItemId, tenantId } });
          if (!item || item.inStock < remaining || item.reserved < remaining) {
            throw new AppError("Reserved stock cannot be consumed", 409);
          }
          const stock = await tx.inventoryItem.update({
            where: { id: item.id },
            data: { inStock: { decrement: remaining }, reserved: { decrement: remaining } },
          });
          await tx.stockReservation.update({
            where: { id: reservation.id },
            data: { consumed: { increment: remaining }, status: "consumed" },
          });
          await tx.stockMovement.create({
            data: {
              tenantId,
              inventoryItemId: item.id,
              reservationId: reservation.id,
              jobId: id,
              type: "consume",
              quantity: -remaining,
              balanceAfter: stock.inStock,
              referenceType: "job",
              referenceId: id,
              actorId: actorId ?? "system",
            },
          });
        }
        if (job.serviceRequestId) {
          const sr = await tx.serviceRequest.findFirst({ where: { id: job.serviceRequestId, tenantId } });
          if (sr) {
            await tx.serviceRequest.update({
              where: { id: sr.id },
              data: { status: resolveTicketEventStatus(sr.status, "jobCompleted") as never },
            });
          }
        }
        if (job.equipmentId) {
          await tx.equipment.updateMany({
            where: { id: job.equipmentId, tenantId },
            data: { lastServiceDate: new Date(), condition: "operational" },
          });
        }
        await closeAllOpenWorkLogs(tx, tenantId, id, "Job completed");
        return tx.serviceJob.update({
          where: { id },
          data: { ...data, progress: 100, completedAt: new Date() } as never,
        });
      });
      await notificationsService.notifyJobUpdated(tenantId, existing.reference, "completed");
      return updated;
    }

    const updated = await jobsRepository.update(id, tenantId, data);
    if (data.status && data.status !== existing.status) {
      await this.syncWorkLogForStatusChange(
        tenantId,
        id,
        existing,
        actorId,
        existing.status,
        String(data.status),
      );
      await notificationsService.notifyJobUpdated(tenantId, existing.reference, String(data.status));
    }
    return updated;
  }

  async delete(id: string, tenantId: string) {
    await this.getById(id, tenantId);
    return jobsRepository.delete(id, tenantId);
  }

  async uploadPhotos(
    id: string,
    tenantId: string,
    actorId: string,
    actorRole: string,
    photos: { filename?: string; mimeType?: string; dataUrl?: string; fileId?: string }[],
  ) {
    const job = await this.getById(id, tenantId, actorId, actorRole);
    const actor = await usersRepository.findById(actorId, tenantId);
    const actorName = actor?.name ?? actorId;
    assertJobTransition(job.status === "scheduled" ? "scheduled" : job.status, job.status === "scheduled" ? "inProgress" : job.status);

    const saved = [];
    for (const photo of photos) {
      let fileId = photo.fileId ?? null;
      let dataUrl = "";
      let filename = photo.filename ?? "photo.jpg";
      let mimeType = photo.mimeType ?? "image/jpeg";
      if (photo.fileId) {
        const file = await prisma.storedFile.findFirst({ where: { id: photo.fileId, tenantId } });
        if (!file) throw new AppError("Uploaded file not found", 404);
        filename = file.originalName;
        mimeType = file.mimeType;
      } else if (photo.dataUrl) {
        // Legacy path: persist data-URL into StoredFile
        const match = /^data:([^;]+);base64,(.+)$/.exec(photo.dataUrl);
        if (!match) throw new AppError("Invalid photo data URL", 422);
        const buffer = Buffer.from(match[2], "base64");
        const stored = await fileStorageService.saveBuffer(tenantId, actorId, {
          buffer,
          originalName: filename,
          mimeType: match[1] || mimeType,
        });
        fileId = stored.id;
        mimeType = stored.mimeType;
      }
      const row = await prisma.jobPhoto.create({
        data: {
          jobId: id,
          filename,
          mimeType,
          dataUrl,
          fileId,
          uploadedBy: actorName,
        },
      });
      saved.push(row);
    }

    const progress = Math.min(job.progress + 15, 90);
    const status = job.status === "scheduled" ? "inProgress" : job.status;
    if (status !== job.status) assertJobTransition(job.status, status);
    const updated = await jobsRepository.update(id, tenantId, { progress, status });

    if (status === "inProgress" && job.status === "scheduled") {
      await startWorkLog(prisma, tenantId, id, actorId, "Field work started");
    }

    await jobActionsRepository.addActivity(id, {
      actor: actorName,
      action: "Uploaded photos",
      note: `${saved.length} photo(s) attached`,
    });

    return { job: updated, photos: saved };
  }

  async requestParts(id: string, tenantId: string, actorId: string, actorRole: string, notes: string) {
    const job = await this.getById(id, tenantId, actorId, actorRole);
    const actor = await usersRepository.findById(actorId, tenantId);
    const actorName = actor?.name ?? actorId;

    const request = await jobActionsRepository.addPartsRequest(id, {
      notes,
      requestedBy: actorName,
    });

    const updated = await jobsRepository.update(id, tenantId, {
      status: "partsPending",
      progress: Math.max(job.progress, 40),
    });

    await closeWorkLog(prisma, tenantId, id, actorId, "Work paused — parts pending");

    await jobActionsRepository.addActivity(id, {
      actor: actorName,
      action: "Parts requested",
      note: notes.slice(0, 200),
    });

    return { job: updated, partsRequest: request };
  }

  async captureSignature(
    id: string,
    tenantId: string,
    actorId: string,
    actorRole: string,
    data: { customerName: string; signatureData?: string; fileId?: string },
  ) {
    const job = await this.getById(id, tenantId, actorId, actorRole);
    const actor = await usersRepository.findById(actorId, tenantId);
    const actorName = actor?.name ?? actorId;

    let fileId = data.fileId ?? null;
    let signatureData = data.signatureData;
    if (!fileId && data.signatureData?.startsWith("data:")) {
      const match = /^data:([^;]+);base64,(.+)$/.exec(data.signatureData);
      if (match) {
        const stored = await fileStorageService.saveBuffer(tenantId, actorId, {
          buffer: Buffer.from(match[2], "base64"),
          originalName: `signature-${id}.png`,
          mimeType: match[1] || "image/png",
        });
        fileId = stored.id;
        signatureData = undefined;
      }
    } else if (fileId) {
      const file = await prisma.storedFile.findFirst({ where: { id: fileId, tenantId } });
      if (!file) throw new AppError("Signature file not found", 404);
    }

    const signature = await prisma.jobSignature.upsert({
      where: { jobId: id },
      create: {
        jobId: id,
        customerName: data.customerName,
        signatureData: signatureData ?? null,
        fileId,
        capturedBy: actorName,
      },
      update: {
        customerName: data.customerName,
        signatureData: signatureData ?? null,
        fileId,
        capturedBy: actorName,
        capturedAt: new Date(),
      },
    });

    assertJobTransition(job.status, "review");
    const updated = await jobsRepository.update(id, tenantId, {
      status: "review",
      progress: Math.max(job.progress, 85),
    });

    await closeWorkLog(prisma, tenantId, id, actorId, "Customer sign-off captured");

    await jobActionsRepository.addActivity(id, {
      actor: actorName,
      action: "Customer sign-off captured",
      note: `Signed by ${data.customerName}`,
    });

    return { job: updated, signature };
  }

  async deductStock(
    id: string,
    tenantId: string,
    actorId: string,
    actorRole: string,
    inventoryItemId: string,
    quantity: number,
  ) {
    const job = await this.getById(id, tenantId, actorId, actorRole);
    const actor = await usersRepository.findById(actorId, tenantId);
    const actorName = actor?.name ?? actorId;
    return prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findFirst({ where: { id: inventoryItemId, tenantId } });
      if (!item) throw new AppError("Inventory item not found", 404);
      const reservation = await tx.stockReservation.findFirst({
        where: { tenantId, jobId: id, inventoryItemId, status: "active" },
        orderBy: { createdAt: "asc" },
      });
      const reservedRemaining = reservation
        ? reservation.quantity - reservation.consumed - reservation.released
        : 0;
      const reservedToConsume = Math.min(quantity, Math.max(0, reservedRemaining));
      const unreservedNeeded = quantity - reservedToConsume;
      const freelyAvailable = item.inStock - item.reserved;
      if (item.inStock < quantity || freelyAvailable < unreservedNeeded) {
        const shortage = quantity - (freelyAvailable + reservedToConsume);
        await tx.stockPurchaseRequest.create({
          data: {
            tenantId,
            inventoryItemId,
            quantity: Math.max(shortage, quantity),
            requestedBy: actorId,
            jobId: id,
            note: `Shortage while deducting stock for job`,
          },
        });
        await tx.notification.createMany({
          data: [
            {
              tenantId,
              type: "stock",
              title: "Stock purchase request",
              body: `Shortage of ${item.name} (${item.sku}) on job`,
              recipientRole: "inventory",
            },
            {
              tenantId,
              type: "stock",
              title: "Stock purchase request",
              body: `Shortage of ${item.name} (${item.sku}) on job`,
              recipientRole: "admin",
            },
          ],
        });
        throw new AppError(
          `Insufficient available stock. Available: ${freelyAvailable + reservedToConsume}. A stock purchase request was created.`,
          409,
        );
      }

      const stock = await tx.inventoryItem.update({
        where: { id: item.id },
        data: {
          inStock: { decrement: quantity },
          ...(reservedToConsume ? { reserved: { decrement: reservedToConsume } } : {}),
        },
      });
      if (reservation && reservedToConsume) {
        const consumed = reservation.consumed + reservedToConsume;
        await tx.stockReservation.update({
          where: { id: reservation.id },
          data: {
            consumed,
            status: consumed + reservation.released >= reservation.quantity ? "consumed" : "active",
          },
        });
      }
      const movement = await tx.stockMovement.create({
        data: {
          tenantId,
          inventoryItemId,
          reservationId: reservation?.id,
          jobId: id,
          type: "consume",
          quantity: -quantity,
          balanceAfter: stock.inStock,
          referenceType: "job",
          referenceId: id,
          actorId,
        },
      });
      const deduction = await tx.jobStockDeduction.create({
        data: {
          jobId: id,
          inventoryItemId,
          itemName: item.name,
          sku: item.sku,
          quantity,
          deductedBy: actorName,
        },
      });
      await tx.jobActivity.create({
        data: {
          jobId: id,
          actor: actorName,
          action: "Stock consumed",
          note: `${quantity} × ${item.name} (${item.sku})`,
        },
      });
      const updated = await tx.serviceJob.update({
        where: { id },
        data: {
          progress: Math.min(job.progress + 10, 95),
          status: job.status === "scheduled" ? "inProgress" : job.status,
        },
      });
      if (job.status === "scheduled") {
        await startWorkLog(tx, tenantId, id, actorId, "Field work started");
      }
      return { job: updated, deduction, movement };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async getActivities(id: string, tenantId: string, actorId?: string, actorRole?: string) {
    await this.getById(id, tenantId, actorId, actorRole);
    return jobActionsRepository.getActivities(id);
  }
}

export const jobsService = new JobsService();
