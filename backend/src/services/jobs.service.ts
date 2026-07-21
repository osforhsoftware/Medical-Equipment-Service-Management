import { jobsRepository } from "@/repositories/jobs.repository";
import { jobActionsRepository } from "@/repositories/jobActions.repository";
import { serviceRequestsRepository } from "@/repositories/serviceRequests.repository";
import { usersRepository } from "@/repositories/users.repository";
import { inventoryRepository } from "@/repositories/inventory.repository";
import { notificationsService } from "@/services/notifications.service";
import { AppError } from "@/middleware/errorHandler";
import { generateReference } from "@/utils/reference";
import { prisma } from "@/db/prisma";

const ASSIGNABLE_JOB_ROLES = ["coordinator", "engineer"];

type CreateJobData = {
  serviceRequestId: string;
  engineerId: string;
  scheduledFor: string;
  status?: string;
  progress?: number;
};

export class JobsService {
  private async resolveAssignee(engineerId: string, tenantId: string) {
    const assignee = await usersRepository.findById(engineerId, tenantId);
    if (!assignee) throw new AppError("Staff user not found", 404);
    if (!ASSIGNABLE_JOB_ROLES.includes(assignee.role)) {
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
    job: { engineerId: string | null; engineer: string },
    tenantId: string,
    actorId?: string,
    actorRole?: string,
  ) {
    if (!actorRole || actorRole === "admin" || actorRole === "coordinator") return;
    if (actorRole === "engineer" && actorId) {
      if (job.engineerId && job.engineerId === actorId) return;
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

  async create(tenantId: string, data: CreateJobData) {
    const sr = await serviceRequestsRepository.findById(data.serviceRequestId, tenantId);
    if (!sr) throw new AppError("Service request not found", 404);

    const assignee = await this.resolveAssignee(data.engineerId, tenantId);
    const reference = await generateReference(tenantId, "JOB", "serviceJob");

    const job = await jobsRepository.create(tenantId, {
      reference,
      requestRef: sr.reference,
      customerName: sr.customerName,
      equipmentName: (sr.equipmentName ?? "Equipment").split(" (")[0],
      engineer: assignee.name,
      engineerId: assignee.id,
      type: sr.type,
      status: (data.status ?? "scheduled") as never,
      scheduledFor: new Date(data.scheduledFor),
      progress: data.progress ?? 0,
    });

    await jobActionsRepository.addActivity(job.id, {
      actor: assignee.name,
      action: "Job scheduled",
      note: `Assigned to ${assignee.name}`,
    });

    if (["approval", "estimate"].includes(sr.status)) {
      await serviceRequestsRepository.update(sr.id, tenantId, { status: "inProgress" });
    }

    return job;
  }

  async update(id: string, tenantId: string, data: Record<string, unknown>, actorId?: string, actorRole?: string) {
    const existing = await this.getById(id, tenantId, actorId, actorRole);

    if (data.engineerId) {
      const assignee = await this.resolveAssignee(String(data.engineerId), tenantId);
      data.engineer = assignee.name;
    }

    if (data.scheduledFor) {
      data.scheduledFor = new Date(data.scheduledFor as string);
    }

    const updated = await jobsRepository.update(id, tenantId, data);
    if (data.status && data.status !== existing.status) {
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
    photos: { filename: string; mimeType: string; dataUrl: string }[],
  ) {
    const job = await this.getById(id, tenantId, actorId, actorRole);
    const actor = await usersRepository.findById(actorId, tenantId);
    const actorName = actor?.name ?? actorId;

    const saved = await jobActionsRepository.addPhotos(
      id,
      photos.map((p) => ({ ...p, uploadedBy: actorName })),
    );

    const progress = Math.min(job.progress + 15, 90);
    const status = job.status === "scheduled" ? "inProgress" : job.status;
    const updated = await jobsRepository.update(id, tenantId, { progress, status });

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
    data: { customerName: string; signatureData?: string },
  ) {
    const job = await this.getById(id, tenantId, actorId, actorRole);
    const actor = await usersRepository.findById(actorId, tenantId);
    const actorName = actor?.name ?? actorId;

    const signature = await jobActionsRepository.upsertSignature(id, {
      customerName: data.customerName,
      signatureData: data.signatureData,
      capturedBy: actorName,
    });

    const updated = await jobsRepository.update(id, tenantId, {
      status: "review",
      progress: Math.max(job.progress, 85),
    });

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

    const item = await inventoryRepository.findById(inventoryItemId, tenantId);
    if (!item) throw new AppError("Inventory item not found", 404);
    if (item.inStock < quantity) {
      throw new AppError(`Insufficient stock. Available: ${item.inStock}`, 400);
    }

    const newReserved = Math.max(0, item.reserved - quantity);
    const newInStock = item.inStock - quantity;

    await prisma.inventoryItem.update({
      where: { id: inventoryItemId },
      data: { inStock: newInStock, reserved: newReserved },
    });

    const deduction = await jobActionsRepository.addStockDeduction(id, {
      inventoryItemId,
      itemName: item.name,
      sku: item.sku,
      quantity,
      deductedBy: actorName,
    });

    const progress = Math.min(job.progress + 10, 95);
    const status = job.status === "scheduled" ? "inProgress" : job.status;
    const updated = await jobsRepository.update(id, tenantId, { progress, status });

    await jobActionsRepository.addActivity(id, {
      actor: actorName,
      action: "Stock deducted",
      note: `${quantity} × ${item.name} (${item.sku})`,
    });

    return { job: updated, deduction };
  }

  async getActivities(id: string, tenantId: string) {
    await this.getById(id, tenantId);
    return jobActionsRepository.getActivities(id);
  }
}

export const jobsService = new JobsService();
