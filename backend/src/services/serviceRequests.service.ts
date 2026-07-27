import { serviceRequestsRepository } from "@/repositories/serviceRequests.repository";
import { customersRepository } from "@/repositories/customers.repository";
import { equipmentRepository } from "@/repositories/equipment.repository";
import { usersRepository } from "@/repositories/users.repository";
import { notificationsService } from "@/services/notifications.service";
import { AppError } from "@/middleware/errorHandler";
import { generateReference } from "@/utils/reference";
import { prisma } from "@/db/prisma";
import {
  assertTicketAdvance,
  resolveTicketEventStatus,
  type TicketEvent,
} from "@/services/workflow/serviceTicketStateMachine";

const ASSIGNABLE_STAFF_ROLES = ["coordinator", "inspector", "estimator", "engineer", "inventory", "billing"];
const ASSIGNMENT_SCOPED_ROLES = ["inspector", "estimator", "engineer", "inventory", "billing"];

type CreateServiceRequestData = {
  customerId: string;
  equipmentId?: string;
  equipmentIds?: string[];
  type: string;
  priority: string;
  description: string;
  assignedTo?: string;
  assignedName?: string;
  slaDue?: string;
};

type UpdateServiceRequestData = {
  status?: string;
  priority?: string;
  assignedTo?: string | null;
  assignedName?: string | null;
  description?: string;
  timelineNote?: string;
};

export class ServiceRequestsService {
  private assertActorAccess(
    request: { assignedTo: string | null },
    actorId?: string,
    actorRole?: string,
  ) {
    if (
      actorId &&
      actorRole &&
      ASSIGNMENT_SCOPED_ROLES.includes(actorRole) &&
      request.assignedTo !== actorId
    ) {
      throw new AppError("You can only access service tickets assigned to you", 403);
    }
  }

  private async validateAssignee(assignedTo: string, tenantId: string) {
    const assignee = await usersRepository.findById(assignedTo, tenantId);
    if (!assignee) throw new AppError("Staff user not found", 404);
    if (!assignee.isActive) throw new AppError("Assigned staff is not active", 400);
    if (!ASSIGNABLE_STAFF_ROLES.includes(assignee.role)) {
      throw new AppError("This role cannot be assigned work", 400);
    }
    return assignee;
  }

  /** Shared helper for domain side-effects (estimate/job/invoice). */
  async applyTicketEvent(
    id: string,
    tenantId: string,
    event: TicketEvent,
    tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  ) {
    const client = tx ?? prisma;
    const existing = await client.serviceRequest.findFirst({ where: { id, tenantId } });
    if (!existing) throw new AppError("Service ticket not found", 404);
    const status = resolveTicketEventStatus(existing.status, event);
    if (status === existing.status) return existing;
    return client.serviceRequest.update({
      where: { id },
      data: { status: status as never },
    });
  }

  async getAll(tenantId: string, actorId: string, actorRole: string, filters?: { branchId?: string; status?: string }) {
    const restrictedRoles = ["inspector", "estimator", "engineer", "inventory", "billing"];
    const assignedToFilter = restrictedRoles.includes(actorRole) ? actorId : undefined;
    return serviceRequestsRepository.findAll(tenantId, { ...filters, assignedTo: assignedToFilter });
  }

  async getById(id: string, tenantId: string, actorId?: string, actorRole?: string) {
    const sr = await serviceRequestsRepository.findById(id, tenantId);
    if (!sr) throw new AppError("Service ticket not found", 404);
    this.assertActorAccess(sr, actorId, actorRole);
    return sr;
  }

  async getWithTimeline(id: string, tenantId: string) {
    const sr = await serviceRequestsRepository.findWithTimeline(id, tenantId);
    if (!sr) throw new AppError("Service ticket not found", 404);
    return sr;
  }

  async getTimeline(id: string, tenantId: string, actorId?: string, actorRole?: string) {
    await this.getById(id, tenantId, actorId, actorRole);
    return serviceRequestsRepository.getTimeline(id);
  }

  async create(tenantId: string, userId: string, data: CreateServiceRequestData) {
    const customer = await customersRepository.findById(data.customerId, tenantId);
    if (!customer) throw new AppError("Customer not found", 404);

    const user = await usersRepository.findById(userId, tenantId);
    const createdBy = user?.name ?? userId;
    const reference = await generateReference(tenantId, "SR", "serviceRequest");

    const slaDue = data.slaDue
      ? new Date(data.slaDue)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const equipIds = data.equipmentIds?.length
      ? [...new Set(data.equipmentIds)]
      : data.equipmentId
        ? [data.equipmentId]
        : [];

    let primaryEquipId: string | undefined;
    let primaryEquipName: string | undefined;
    let branchId = customer.branchId;
    const equipmentItems: { equipmentId: string; equipmentName: string; assetTag: string }[] = [];

    for (const eqId of equipIds) {
      const equip = await equipmentRepository.findById(eqId, tenantId);
      if (!equip) throw new AppError(`Equipment ${eqId} not found`, 404);
      if (equip.customerId !== customer.id) {
        throw new AppError("All selected equipment must belong to the selected customer", 400);
      }
      const label = `${equip.name} (${equip.model})`;
      equipmentItems.push({ equipmentId: eqId, equipmentName: label, assetTag: equip.assetTag });
      if (!primaryEquipId) {
        primaryEquipId = eqId;
        primaryEquipName = label;
        branchId = equip.branchId;
      }
    }

    if (data.assignedTo) {
      const assignee = await this.validateAssignee(data.assignedTo, tenantId);
      data.assignedName = assignee.name;
    }

    const sr = await serviceRequestsRepository.create(tenantId, {
      reference,
      customerId: data.customerId,
      customerName: customer.name,
      equipmentId: primaryEquipId,
      equipmentName: primaryEquipName,
      branchId,
      type: data.type as never,
      priority: data.priority as never,
      description: data.description,
      createdBy,
      assignedTo: data.assignedTo,
      assignedName: data.assignedName,
      slaDue,
    });

    if (equipmentItems.length > 0) {
      await serviceRequestsRepository.addEquipmentItems(sr.id, equipmentItems);
    }

    await serviceRequestsRepository.addTimelineEvent(
      sr.id,
      createdBy,
      "Service ticket created",
      `Type: ${data.type}, Priority: ${data.priority}`,
    );

    if (data.assignedTo) {
      await notificationsService.notifyAssignment(
        tenantId,
        reference,
        data.assignedTo,
        data.assignedName ?? data.assignedTo,
        primaryEquipName ?? "Equipment",
      );
    }

    await prisma.customer.update({
      where: { id: customer.id },
      data: { activeJobs: { increment: 1 } },
    });

    return serviceRequestsRepository.findById(sr.id, tenantId);
  }

  async update(id: string, tenantId: string, actorId: string, actorRole: string, data: UpdateServiceRequestData) {
    const existing = await this.getById(id, tenantId, actorId, actorRole);
    const user = await usersRepository.findById(actorId, tenantId);
    const actor = user?.name ?? actorId;

    const { timelineNote, status, ...updateData } = data;
    if (
      !["admin", "coordinator"].includes(actorRole) &&
      Object.keys(updateData).length > 0
    ) {
      throw new AppError("Only administrators and coordinators can edit ticket details", 403);
    }
    if (status && status !== existing.status) {
      await this.advanceWorkflow(
        id,
        tenantId,
        actorId,
        actorRole,
        status,
        timelineNote ?? `Status changed to ${status}`,
      );
    }

    const hasUpdates = Object.keys(updateData).length > 0;
    const updated = hasUpdates
      ? await serviceRequestsRepository.update(id, tenantId, updateData as never)
      : await this.getById(id, tenantId, actorId, actorRole);

    if ((!status || status === existing.status) && timelineNote) {
      await serviceRequestsRepository.addTimelineEvent(id, actor, "Note added", timelineNote);
    }

    return updated;
  }

  async assign(id: string, tenantId: string, actorId: string, assignedTo: string, note?: string) {
    const existing = await this.getById(id, tenantId);
    const actor = await usersRepository.findById(actorId, tenantId);
    const assignee = await this.validateAssignee(assignedTo, tenantId);

    await serviceRequestsRepository.update(id, tenantId, {
      assignedTo,
      assignedName: assignee.name,
    });

    await serviceRequestsRepository.addTimelineEvent(
      id,
      actor?.name ?? actorId,
      `Assigned to ${assignee.name}`,
      note,
    );

    await notificationsService.notifyAssignment(
      tenantId,
      existing.reference,
      assignee.id,
      assignee.name,
      existing.equipmentName ?? "Equipment",
    );

    return serviceRequestsRepository.findById(id, tenantId);
  }

  async advanceWorkflow(
    id: string,
    tenantId: string,
    actorId: string,
    actorRole: string,
    targetStatus: string,
    note: string,
  ) {
    const existing = await this.getById(id, tenantId, actorId, actorRole);
    const actor = await usersRepository.findById(actorId, tenantId);
    const actorName = actor?.name ?? actorId;

    assertTicketAdvance(existing.status, targetStatus, actorRole);

    if (targetStatus === "inProgress") {
      const estimate = await prisma.estimate.findFirst({
        where: {
          tenantId,
          status: "approved",
          OR: [{ serviceRequestId: id }, { requestRef: existing.reference }],
        },
      });
      const job = await prisma.serviceJob.findFirst({
        where: { tenantId, OR: [{ serviceRequestId: id }, { requestRef: existing.reference }] },
      });
      if (!estimate || !job) {
        throw new AppError("An approved estimate and scheduled job are required before in-progress", 409);
      }
    }
    if (targetStatus === "completed") {
      const job = await prisma.serviceJob.findFirst({
        where: {
          tenantId,
          status: "completed",
          OR: [{ serviceRequestId: id }, { requestRef: existing.reference }],
        },
        include: { signature: true },
      });
      if (!job?.signature) {
        throw new AppError("Customer sign-off is required before completing the ticket", 409);
      }
    }
    if (targetStatus === "invoiced") {
      const invoice = await prisma.invoice.findFirst({
        where: { tenantId, serviceRequestId: id },
      });
      if (!invoice) throw new AppError("An invoice is required before marking invoiced", 409);
    }
    if (targetStatus === "finished") {
      if (existing.status !== "invoiced") {
        throw new AppError("Ticket must be invoiced before finishing", 409);
      }
    }

    const updated = await serviceRequestsRepository.update(id, tenantId, {
      status: targetStatus as never,
    });

    const label = targetStatus.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
    await serviceRequestsRepository.addTimelineEvent(id, actorName, `Moved to ${label}`, note);
    await notificationsService.notifyWorkflowAdvanced(tenantId, existing.reference, targetStatus, actorName);

    return updated;
  }

  async delete(id: string, tenantId: string) {
    const sr = await this.getById(id, tenantId);
    await serviceRequestsRepository.delete(id, tenantId);
    await prisma.customer.update({
      where: { id: sr.customerId },
      data: { activeJobs: { decrement: 1 } },
    });
  }
}

export const serviceRequestsService = new ServiceRequestsService();
