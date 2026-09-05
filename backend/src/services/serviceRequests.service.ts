import { serviceRequestsRepository } from "@/repositories/serviceRequests.repository";
import { customersRepository } from "@/repositories/customers.repository";
import { equipmentRepository } from "@/repositories/equipment.repository";
import { usersRepository } from "@/repositories/users.repository";
import { notificationsService } from "@/services/notifications.service";
import { ticketAssignmentService } from "@/services/ticketAssignment.service";
import { jobsService } from "@/services/jobs.service";
import { userHasAnyRoleKey } from "@/utils/userRoles";
import { AppError } from "@/middleware/errorHandler";
import { generateReference } from "@/utils/reference";
import { prisma } from "@/db/prisma";
import { Prisma } from "@prisma/client";
import {
  assertTicketAdvance,
  assertTicketReopen,
  normalizeTicketStatus,
  resolveTicketEventStatus,
  type TicketEvent,
} from "@/services/workflow/serviceTicketStateMachine";

const ASSIGNABLE_STAFF_ROLES = ["coordinator", "inspector", "estimator", "engineer", "inventory", "billing"];
const ASSIGNMENT_SCOPED_ROLES = ["inspector", "engineer", "inventory", "billing"];


type CreateServiceRequestData = {
  customerId: string;
  equipmentId?: string;
  equipmentIds?: string[];
  type?: string;
  typeOther?: string | null;
  priority: string;
  description?: string;
  assignedTo?: string;
  assignedName?: string;
  /** Create intake: inspector only (Inspection flow). */
  role?: "inspector";
  slaDue?: string;
};

type UpdateServiceRequestData = {
  status?: string;
  priority?: string;
  type?: string | null;
  typeOther?: string | null;
  assignedTo?: string | null;
  assignedName?: string | null;
  description?: string;
  timelineNote?: string;
};

type ServiceRequestRecord = Awaited<ReturnType<typeof serviceRequestsRepository.findById>>;

export class ServiceRequestsService {
  /**
   * Statuses where field work is done (or ticket is closed). Equipment may accept a new ticket.
   * Matches Kanban "Completed" + post-job workflow (`pending_final_approval`).
   */
  private static readonly INACTIVE_TICKET_STATUSES = [
    "pending_final_approval",
    "completed",
    "pending_invoice",
    "invoiced",
    "closed",
    "finished",
  ] as const;

  private async assertNoActiveTicketForEquipment(
    tenantId: string,
    equipmentIds: string[],
  ) {
    if (equipmentIds.length === 0) return;

    const existing = await prisma.serviceRequest.findFirst({
      where: {
        tenantId,
        status: { notIn: [...ServiceRequestsService.INACTIVE_TICKET_STATUSES] as never[] },
        OR: [
          { equipmentId: { in: equipmentIds } },
          { equipmentItems: { some: { equipmentId: { in: equipmentIds } } } },
        ],
      },
      include: {
        equipmentItems: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!existing) return;

    const conflictingEquipment = existing.equipmentItems.find((item) =>
      equipmentIds.includes(item.equipmentId),
    );
    const equipmentLabel =
      conflictingEquipment?.equipmentName ??
      existing.equipmentName ??
      "Selected equipment";

    throw new AppError(
      `${equipmentLabel} already has an active service ticket (${existing.reference}). Complete or close the existing ticket before creating another one.`,
      409,
    );
  }

  /** Resolve legacy records where createdBy stored a user id instead of a display name. */
  private async enrichCreatedBy<T extends { createdBy: string }>(
    tenantId: string,
    record: T,
  ): Promise<T> {
    const user = await usersRepository.findById(record.createdBy, tenantId);
    if (!user) return record;
    return { ...record, createdBy: user.name };
  }

  private async enrichCreatedByList<T extends { createdBy: string }>(
    tenantId: string,
    records: T[],
  ): Promise<T[]> {
    const ids = [...new Set(records.map((r) => r.createdBy))];
    const users = await prisma.user.findMany({
      where: { tenantId, id: { in: ids } },
      select: { id: true, name: true },
    });
    if (users.length === 0) return records;
    const names = new Map(users.map((u) => [u.id, u.name]));
    return records.map((r) => ({
      ...r,
      createdBy: names.get(r.createdBy) ?? r.createdBy,
    }));
  }

  private async enrichServiceRequest(
    tenantId: string,
    record: ServiceRequestRecord,
  ): Promise<NonNullable<ServiceRequestRecord> & {
    assignedInspectorName: string | null;
    assignedEstimatorName: string | null;
    assignedEngineerName: string | null;
  }> {
    if (!record) throw new AppError("Service ticket not found", 404);
    const withCreator = await this.enrichCreatedBy(tenantId, record);
    const ids = [
      withCreator.assignedInspectorId,
      withCreator.assignedEstimatorId,
      withCreator.assignedEngineerId,
    ].filter((id): id is string => Boolean(id));
    const users = ids.length
      ? await prisma.user.findMany({
          where: { tenantId, id: { in: ids } },
          select: { id: true, name: true },
        })
      : [];
    const names = new Map(users.map((user) => [user.id, user.name]));
    return {
      ...withCreator,
      assignedInspectorName: withCreator.assignedInspectorId
        ? names.get(withCreator.assignedInspectorId) ?? null
        : null,
      assignedEstimatorName: withCreator.assignedEstimatorId
        ? names.get(withCreator.assignedEstimatorId) ?? null
        : null,
      assignedEngineerName: withCreator.assignedEngineerId
        ? names.get(withCreator.assignedEngineerId) ?? null
        : null,
    };
  }

  private async assertActorAccess(
    request: {
      id: string;
      tenantId: string;
      status: string;
      assignedTo: string | null;
      assignedInspectorId?: string | null;
      assignedEstimatorId?: string | null;
      assignedEngineerId?: string | null;
    },
    actorId?: string,
    actorRole?: string,
  ) {
    if (!actorId || !actorRole) return;
    if (actorRole === "estimator") {
      const status = normalizeTicketStatus(request.status);
      const assignedEstimator = request.assignedEstimatorId;
      if (assignedEstimator === actorId) return;
      // Do not treat assignedTo as the estimator — it is usually the inspector/coordinator.
      if (!assignedEstimator && ["inspection", "estimate", "pending_approval"].includes(status)) {
        return;
      }
      const ownedEstimate = await prisma.estimate.findFirst({
        where: {
          tenantId: request.tenantId,
          serviceRequestId: request.id,
          OR: [
            { salespersonId: actorId },
            { revisions: { some: { createdBy: actorId } } },
          ],
        },
        select: { id: true },
      });
      if (!ownedEstimate) {
        throw new AppError("You can only access service tickets assigned to you for estimate work", 403);
      }
      return;
    }
    const assigneeId =
      actorRole === "inspector"
        ? request.assignedInspectorId ?? request.assignedTo
        : actorRole === "engineer"
          ? request.assignedEngineerId ?? request.assignedTo
          : request.assignedTo;
    if (ASSIGNMENT_SCOPED_ROLES.includes(actorRole) && assigneeId && assigneeId !== actorId) {
      throw new AppError("You can only access service tickets assigned to you", 403);
    }
  }

  private async validateAssignee(assignedTo: string, tenantId: string) {
    const assignee = await usersRepository.findById(assignedTo, tenantId);
    if (!assignee) throw new AppError("Staff user not found", 404);
    if (!assignee.isActive) throw new AppError("Assigned staff is not active", 400);
    const hasAssignableRole =
      ASSIGNABLE_STAFF_ROLES.includes(assignee.role) ||
      !!(await prisma.userRoleAssignment.findFirst({
        where: {
          tenantId,
          userId: assignedTo,
          role: { key: { in: ASSIGNABLE_STAFF_ROLES } },
        },
      }));
    if (!hasAssignableRole) {
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

  async getPaginated(
    tenantId: string,
    actorId: string,
    actorRole: string,
    filters: import("@/repositories/serviceRequests.repository").ServiceRequestListFilters,
  ) {
    const assignedToFilter =
      actorRole === "engineer" || actorRole === "inspector"
        ? undefined
        : ASSIGNMENT_SCOPED_ROLES.includes(actorRole)
          ? actorId
          : filters.assignedTo;
    const { data, total } = await serviceRequestsRepository.findPaginated(tenantId, {
      ...filters,
      assignedTo: assignedToFilter,
      inspectorId: actorRole === "inspector" ? actorId : undefined,
      estimatorId: actorRole === "estimator" ? actorId : undefined,
      engineerId: actorRole === "engineer" ? actorId : undefined,
    });
    return { data: await this.enrichCreatedByList(tenantId, data), total };
  }

  async getStatusCounts(
    tenantId: string,
    actorId: string,
    actorRole: string,
    statuses: string[],
    filters?: { overdue?: boolean; priority?: string; assignee?: string; search?: string },
  ) {
    const assignedTo = actorRole === "engineer" || actorRole === "inspector" ? undefined : ASSIGNMENT_SCOPED_ROLES.includes(actorRole) ? actorId : undefined;
    return serviceRequestsRepository.countByStatus(tenantId, {
      assignedTo,
      inspectorId: actorRole === "inspector" ? actorId : undefined,
      estimatorId: actorRole === "estimator" ? actorId : undefined,
      engineerId: actorRole === "engineer" ? actorId : undefined,
      priority: filters?.priority,
      assignee: filters?.assignee,
      overdue: filters?.overdue,
      search: filters?.search,
    }, statuses);
  }

  async getAll(tenantId: string, actorId: string, actorRole: string, filters?: { status?: string }) {
    const assignedToFilter =
      actorRole === "engineer" || actorRole === "inspector"
        ? undefined
        : ASSIGNMENT_SCOPED_ROLES.includes(actorRole)
          ? actorId
          : undefined;
    const rows = await serviceRequestsRepository.findAll(tenantId, {
      ...filters,
      assignedTo: assignedToFilter,
      inspectorId: actorRole === "inspector" ? actorId : undefined,
      estimatorId: actorRole === "estimator" ? actorId : undefined,
      engineerId: actorRole === "engineer" ? actorId : undefined,
    });
    return this.enrichCreatedByList(tenantId, rows);
  }

  async getById(id: string, tenantId: string, actorId?: string, actorRole?: string) {
    const sr = await serviceRequestsRepository.findById(id, tenantId);
    if (!sr) throw new AppError("Service ticket not found", 404);
    await this.assertActorAccess(sr, actorId, actorRole);
    return this.enrichCreatedBy(tenantId, sr);
  }

  async getWithTimeline(id: string, tenantId: string) {
    const sr = await serviceRequestsRepository.findWithTimeline(id, tenantId);
    if (!sr) throw new AppError("Service ticket not found", 404);
    return this.enrichCreatedBy(tenantId, sr);
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

    const slaDue = data.slaDue
      ? new Date(data.slaDue)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const equipIds = data.equipmentIds?.length
      ? [...new Set(data.equipmentIds)]
      : data.equipmentId
        ? [data.equipmentId]
        : [];

    await this.assertNoActiveTicketForEquipment(tenantId, equipIds);

    let primaryEquipId: string | undefined;
    let primaryEquipName: string | undefined;
    let branchId = customer.branchId;
    const equipmentItems: { equipmentId: string; equipmentName: string; assetTag: string }[] = [];

    for (const eqId of equipIds) {
      const equip = await equipmentRepository.findById(eqId, tenantId);
      if (!equip) throw new AppError(`Equipment ${eqId} not found`, 404);
      if (equip.customerId && equip.customerId !== customer.id) {
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

    let assignedInspectorId: string | undefined;
    if (!data.assignedTo) {
      const defaultInspector = await ticketAssignmentService.defaultInspectorOnCreate(tenantId);
      if (defaultInspector) {
        data.assignedTo = defaultInspector.id;
        data.assignedName = defaultInspector.name;
        assignedInspectorId = defaultInspector.id;
      }
    } else {
      // Create Request is Stage 1 intake only — assign Inspection Technician, then Inspection flow.
      // Do not allow direct assign to estimator/engineer/etc. (those happen in later steps).
      if (data.role && data.role !== "inspector") {
        throw new AppError("On create, only an Inspection Technician can be assigned", 400);
      }
      const assignee = await this.validateAssignee(data.assignedTo, tenantId);
      data.assignedName = assignee.name;
      const isInspector = await userHasAnyRoleKey(assignee.id, tenantId, assignee.role, ["inspector"]);
      if (!isInspector) {
        throw new AppError(
          "Create Request can only assign an Inspection Technician. Use Assign / Reassign after inspection for estimate or engineer staff.",
          400,
        );
      }
      assignedInspectorId = assignee.id;
    }

    const type = data.type?.trim() ? data.type : null;
    const typeOther = type === "Other" ? data.typeOther?.trim() || null : null;
    const typeLabel = typeOther ? `Other (${typeOther})` : type;

    let sr: Awaited<ReturnType<typeof serviceRequestsRepository.create>> | null = null;
    let reference = "";
    for (let attempt = 0; attempt < 5; attempt += 1) {
      reference = await generateReference(tenantId, "SR", "serviceRequest");
      try {
        sr = await serviceRequestsRepository.create(tenantId, {
          reference,
          customerId: data.customerId,
          customerName: customer.name,
          equipmentId: primaryEquipId,
          equipmentName: primaryEquipName,
          branchId,
          type: type as never,
          typeOther,
          priority: data.priority as never,
          description: data.description?.trim() ?? "",
          createdBy,
          assignedTo: data.assignedTo,
          assignedName: data.assignedName,
          assignedInspectorId,
          slaDue,
        });
        break;
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" && attempt < 4) {
          continue;
        }
        throw err;
      }
    }
    if (!sr) throw new AppError("Unable to create service ticket. Please try again.", 409);

    if (equipmentItems.length > 0) {
      await serviceRequestsRepository.addEquipmentItems(sr.id, equipmentItems);
    }

    await serviceRequestsRepository.addTimelineEvent(
      sr.id,
      createdBy,
      "Service ticket created",
      assignedInspectorId
        ? `Type: ${typeLabel ?? "unspecified"}, Priority: ${data.priority}. Assigned to inspection — ticket ready for Inspection flow.`
        : `Type: ${typeLabel ?? "unspecified"}, Priority: ${data.priority}. Awaiting inspection assignment.`,
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

    return this.enrichServiceRequest(tenantId, await serviceRequestsRepository.findById(sr.id, tenantId));
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
      ? await this.enrichServiceRequest(
          tenantId,
          await serviceRequestsRepository.update(id, tenantId, updateData as never),
        )
      : await this.getById(id, tenantId, actorId, actorRole);

    if ((!status || status === existing.status) && timelineNote) {
      await serviceRequestsRepository.addTimelineEvent(id, actor, "Note added", timelineNote);
    }

    return updated;
  }

  async assign(id: string, tenantId: string, actorId: string, assignedTo: string, note?: string, role?: string) {
    const existing = await this.getById(id, tenantId);
    const actor = await usersRepository.findById(actorId, tenantId);
    const assignee = await this.validateAssignee(assignedTo, tenantId);
    const assignmentRole = role && ASSIGNABLE_STAFF_ROLES.includes(role) ? role : assignee.role;
    if (role && !(await userHasAnyRoleKey(assignee.id, tenantId, assignee.role, [assignmentRole]))) {
      throw new AppError("Selected staff does not have that role", 400);
    }

    const updateData: {
      assignedTo: string;
      assignedName: string;
      assignedInspectorId?: string;
      assignedEstimatorId?: string;
      assignedEngineerId?: string;
      status?: string;
    } = {
      assignedTo,
      assignedName: assignee.name,
    };
    if (assignmentRole === "inspector") {
      updateData.assignedInspectorId = assignee.id;
    }
    if (assignmentRole === "estimator") {
      updateData.assignedEstimatorId = assignee.id;
      const status = normalizeTicketStatus(existing.status);
      // Only move into Estimate after inspection is done (report submitted → estimate),
      // or when the ticket is already past inspection. Never skip inspection from create/intake.
      if (status === "inspection") {
        const report = await prisma.inspectionReport.findUnique({
          where: { serviceRequestId: id },
          select: { submittedAt: true },
        });
        if (report?.submittedAt) {
          updateData.status = "estimate";
        }
      }
    }
    const ticketStatus = normalizeTicketStatus(existing.status);
    const engineerStage = [
      "pending_approval",
      "assigned_engineer",
      "change_pending_approval",
      "pending_final_approval",
    ].includes(ticketStatus);
    const assigneeIsEngineer = await userHasAnyRoleKey(assignee.id, tenantId, assignee.role, ["engineer"]);
    if (assignmentRole === "engineer" || (engineerStage && assigneeIsEngineer)) {
      updateData.assignedEngineerId = assignee.id;
    }

    await serviceRequestsRepository.update(id, tenantId, updateData as never);

    if (updateData.assignedEngineerId) {
      await jobsService.ensureJobForAssignedEngineer(tenantId, id, assignee.id, actorId).catch(() => undefined);
    }

    await serviceRequestsRepository.addTimelineEvent(
      id,
      actor?.name ?? actorId,
      `Assigned to ${assignee.name}`,
      note ?? (updateData.status === "estimate" ? "Estimate staff assigned; ticket moved to Estimate." : undefined),
    );

    await notificationsService.notifyAssignment(
      tenantId,
      existing.reference,
      assignee.id,
      assignee.name,
      existing.equipmentName ?? "Equipment",
    );

    return this.enrichServiceRequest(tenantId, await serviceRequestsRepository.findById(id, tenantId));
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

    if (targetStatus === "inspection") {
      const assignedInspector = existing.assignedInspectorId ?? existing.assignedTo;
      if (actorRole !== "admin") {
        if (!assignedInspector) {
          throw new AppError("An inspector must be assigned before moving to inspection", 403);
        }
        if (assignedInspector !== actorId) {
          throw new AppError("Only the assigned inspector may start inspection on this ticket", 403);
        }
      }
    }

    if (targetStatus === "assigned_engineer") {
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
    if (targetStatus === "pending_final_approval") {
      const job = await prisma.serviceJob.findFirst({
        where: {
          tenantId,
          status: "completed",
          OR: [{ serviceRequestId: id }, { requestRef: existing.reference }],
        },
      });
      if (!job) {
        throw new AppError("A completed job is required before pending final approval", 409);
      }
    }
    if (targetStatus === "invoiced") {
      const invoice = await prisma.invoice.findFirst({
        where: { tenantId, serviceRequestId: id },
      });
      if (!invoice) throw new AppError("An invoice is required before marking invoiced", 409);
    }
    if (targetStatus === "closed") {
      if (normalizeTicketStatus(existing.status) !== "invoiced") {
        throw new AppError("Ticket must be invoiced before closing", 409);
      }
    }

    const updated = await this.enrichServiceRequest(
      tenantId,
      await serviceRequestsRepository.update(id, tenantId, {
        status: targetStatus as never,
      }),
    );

    const label = targetStatus.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
    await serviceRequestsRepository.addTimelineEvent(id, actorName, `Moved to ${label}`, note);
    await notificationsService.notifyWorkflowAdvanced(tenantId, existing.reference, targetStatus, actorName);

    return updated;
  }

  /**
   * Explicit audited reopen — the only allowed way to move backward in the lifecycle.
   */
  async reopen(
    id: string,
    tenantId: string,
    actorId: string,
    actorRole: string,
    targetStatus: string,
    note: string,
  ) {
    const existing = await this.getById(id, tenantId, actorId, actorRole);
    assertTicketReopen(existing.status, targetStatus, actorRole);

    const actor = await usersRepository.findById(actorId, tenantId);
    const actorName = actor?.name ?? actorId;

    const updated = await this.enrichServiceRequest(
      tenantId,
      await serviceRequestsRepository.update(id, tenantId, {
        status: targetStatus as never,
      }),
    );

    await serviceRequestsRepository.addTimelineEvent(
      id,
      actorName,
      `Reopened to ${targetStatus}`,
      note,
    );
    await notificationsService.notifyWorkflowAdvanced(
      tenantId,
      existing.reference,
      targetStatus,
      actorName,
    );

    await prisma.auditLog.create({
      data: {
        tenantId,
        actor: actorName,
        role: actorRole,
        action: "Reopened service ticket",
        entity: existing.reference,
        ip: "workflow",
      },
    }).catch(() => undefined);

    return updated;
  }

  async delete(id: string, tenantId: string) {
    const sr = await this.getById(id, tenantId);
    try {
      await serviceRequestsRepository.delete(id, tenantId);
    } catch {
      throw new AppError(
        "This ticket cannot be deleted because related records are still linked. Close or remove related work first.",
        409,
      );
    }
    await prisma.customer.update({
      where: { id: sr.customerId },
      data: { activeJobs: { decrement: 1 } },
    });
  }
}

export const serviceRequestsService = new ServiceRequestsService();
