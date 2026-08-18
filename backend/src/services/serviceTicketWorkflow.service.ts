import { prisma } from "@/db/prisma";
import { serviceRequestsRepository } from "@/repositories/serviceRequests.repository";
import { usersRepository } from "@/repositories/users.repository";
import { notificationsService } from "@/services/notifications.service";
import { domainService } from "@/services/domain.service";
import { AppError } from "@/middleware/errorHandler";
import {
  ESTIMATE_REJECT_TARGETS,
  normalizeTicketStatus,
  resolveTicketEventStatus,
  type EstimateRejectTarget,
} from "@/services/workflow/serviceTicketStateMachine";
import { ESTIMATE_STAFF_APPROVER_ROLES } from "@/config/apiAccess";
import { userHasAnyRoleKey } from "@/utils/userRoles";

const ADMIN_ROLES = ["admin", "coordinator"] as const;

export class ServiceTicketWorkflowService {
  private assertAdmin(actorRole: string) {
    if (!(ADMIN_ROLES as readonly string[]).includes(actorRole)) {
      throw new AppError("Only administrators and coordinators can perform this action", 403);
    }
  }

  private async assertEstimateApprover(actorId: string, tenantId: string, actorRole: string) {
    const allowed = await userHasAnyRoleKey(actorId, tenantId, actorRole, ESTIMATE_STAFF_APPROVER_ROLES);
    if (!allowed) {
      throw new AppError("Only administrators, coordinators, inspection staff, or service staff can approve estimates", 403);
    }
  }

  async approveEstimate(
    id: string,
    tenantId: string,
    actorId: string,
    actorRole: string,
    input: { estimateId: string; engineerId: string; scheduledFor?: string; note?: string },
  ) {
    await this.assertEstimateApprover(actorId, tenantId, actorRole);
    const sr = await serviceRequestsRepository.findById(id, tenantId);
    if (!sr) throw new AppError("Service ticket not found", 404);
    if (normalizeTicketStatus(sr.status) !== "pending_approval") {
      throw new AppError("Ticket must be pending estimate approval", 409);
    }

    await domainService.decideEstimate(tenantId, input.estimateId, { userId: actorId, role: actorRole }, {
      decision: "approved",
      note: input.note,
      engineerId: input.engineerId,
      scheduledFor: input.scheduledFor,
    });

    const actor = await usersRepository.findById(actorId, tenantId);
    await serviceRequestsRepository.addTimelineEvent(
      id,
      actor?.name ?? actorId,
      "Estimate approved",
      input.note ?? `Engineer assigned: ${input.engineerId}`,
    );

    await notificationsService.notifyWorkflowAdvanced(tenantId, sr.reference, "assigned_engineer", actor?.name ?? actorId);
    return serviceRequestsRepository.findById(id, tenantId);
  }

  async rejectEstimate(
    id: string,
    tenantId: string,
    actorId: string,
    actorRole: string,
    input: { estimateId: string; reason: string; target: EstimateRejectTarget },
  ) {
    await this.assertEstimateApprover(actorId, tenantId, actorRole);
    if (!input.reason?.trim()) throw new AppError("A rejection reason is required", 422);
    if (!(ESTIMATE_REJECT_TARGETS as readonly string[]).includes(input.target)) {
      throw new AppError("Invalid reject target; must be estimate or inspection", 422);
    }

    const sr = await serviceRequestsRepository.findById(id, tenantId);
    if (!sr) throw new AppError("Service ticket not found", 404);
    if (normalizeTicketStatus(sr.status) !== "pending_approval") {
      throw new AppError("Ticket must be pending estimate approval", 409);
    }

    await domainService.decideEstimate(tenantId, input.estimateId, { userId: actorId, role: actorRole }, {
      decision: "rejected",
      note: input.reason,
    });

    const event =
      input.target === "inspection" ? "estimateRejectedToInspection" : "estimateRejectedToEstimate";
    const nextStatus = resolveTicketEventStatus("pending_approval", event);
    const actor = await usersRepository.findById(actorId, tenantId);

    await prisma.serviceRequest.update({
      where: { id },
      data: { status: nextStatus as never },
    });

    await serviceRequestsRepository.addTimelineEvent(
      id,
      actor?.name ?? actorId,
      `Estimate rejected — returned to ${input.target}`,
      input.reason,
    );

    return serviceRequestsRepository.findById(id, tenantId);
  }

  async submitChangeRequest(
    id: string,
    tenantId: string,
    actorId: string,
    actorRole: string,
    input: { description: string; items: unknown[]; jobId?: string },
  ) {
    if (actorRole !== "engineer" && actorRole !== "admin") {
      throw new AppError("Only assigned engineers can submit change requests", 403);
    }
    if (!input.description?.trim()) throw new AppError("Change request description is required", 422);

    const sr = await serviceRequestsRepository.findById(id, tenantId);
    if (!sr) throw new AppError("Service ticket not found", 404);
    if (normalizeTicketStatus(sr.status) !== "assigned_engineer") {
      throw new AppError("Change requests can only be submitted while engineer work is in progress", 409);
    }
    if (actorRole === "engineer" && sr.assignedEngineerId && sr.assignedEngineerId !== actorId) {
      throw new AppError("You are not the assigned engineer for this ticket", 403);
    }

    const actor = await usersRepository.findById(actorId, tenantId);
    const changeRequest = await prisma.$transaction(async (tx) => {
      const created = await tx.serviceTicketChangeRequest.create({
        data: {
          tenantId,
          serviceRequestId: id,
          jobId: input.jobId ?? null,
          requestedBy: actorId,
          description: input.description.trim(),
          items: (input.items ?? []) as import("@prisma/client").Prisma.InputJsonValue,
        },
      });
      await tx.serviceRequest.update({
        where: { id },
        data: { status: resolveTicketEventStatus("assigned_engineer", "changeRequestSubmitted") as never },
      });
      await tx.timelineEvent.create({
        data: {
          requestId: id,
          actor: actor?.name ?? actorId,
          action: "Change request submitted",
          note: input.description.trim(),
        },
      });
      await tx.notification.createMany({
        data: [
          { tenantId, type: "approval", title: "Engineer change request", body: `${sr.reference}: ${input.description.slice(0, 120)}`, recipientRole: "admin" },
          { tenantId, type: "approval", title: "Engineer change request", body: `${sr.reference}: ${input.description.slice(0, 120)}`, recipientRole: "coordinator" },
        ],
      });
      return created;
    });

    return changeRequest;
  }

  async decideChangeRequest(
    id: string,
    changeRequestId: string,
    tenantId: string,
    actorId: string,
    actorRole: string,
    input: { approved: boolean; note?: string },
  ) {
    this.assertAdmin(actorRole);
    const sr = await serviceRequestsRepository.findById(id, tenantId);
    if (!sr) throw new AppError("Service ticket not found", 404);
    if (normalizeTicketStatus(sr.status) !== "change_pending_approval") {
      throw new AppError("Ticket is not awaiting change request approval", 409);
    }

    const changeRequest = await prisma.serviceTicketChangeRequest.findFirst({
      where: { id: changeRequestId, serviceRequestId: id, tenantId, status: "pending" },
    });
    if (!changeRequest) throw new AppError("Pending change request not found", 404);

    const actor = await usersRepository.findById(actorId, tenantId);
    await prisma.$transaction(async (tx) => {
      await tx.serviceTicketChangeRequest.update({
        where: { id: changeRequestId },
        data: {
          status: input.approved ? "approved" : "rejected",
          reviewNote: input.note ?? null,
          reviewedBy: actorId,
          reviewedAt: new Date(),
        },
      });
      await tx.serviceRequest.update({
        where: { id },
        data: { status: resolveTicketEventStatus("change_pending_approval", "changeRequestResolved") as never },
      });
      await tx.timelineEvent.create({
        data: {
          requestId: id,
          actor: actor?.name ?? actorId,
          action: input.approved ? "Change request approved" : "Change request rejected",
          note: input.note ?? changeRequest.description,
        },
      });
    });

    return serviceRequestsRepository.findById(id, tenantId);
  }

  async finalApproval(
    id: string,
    tenantId: string,
    actorId: string,
    actorRole: string,
    input?: { note?: string; currency?: string; dueAt?: string },
  ) {
    this.assertAdmin(actorRole);
    const sr = await serviceRequestsRepository.findById(id, tenantId);
    if (!sr) throw new AppError("Service ticket not found", 404);
    if (normalizeTicketStatus(sr.status) !== "pending_final_approval") {
      throw new AppError("Ticket must be pending final approval after engineer work is complete", 409);
    }

    const job = await prisma.serviceJob.findFirst({
      where: { tenantId, serviceRequestId: id, status: "completed" },
    });
    if (!job) throw new AppError("A completed job is required before final approval", 409);

    const actor = await usersRepository.findById(actorId, tenantId);

    await prisma.serviceRequest.update({
      where: { id },
      data: { status: resolveTicketEventStatus("pending_final_approval", "finalApproved") as never },
    });

    await serviceRequestsRepository.addTimelineEvent(
      id,
      actor?.name ?? actorId,
      "Final approval granted",
      input?.note ?? "Proceeding to invoice generation",
    );

    // Generate invoice from completed job
    const dueAt = input?.dueAt ? new Date(input.dueAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await domainService.createInvoiceFromJob(tenantId, { userId: actorId, role: actorRole }, {
      jobId: job.id,
      currency: input?.currency ?? "USD",
      dueAt,
      skipBillingVerification: true,
    }).catch(async (err) => {
      // If invoice already exists, ensure ticket is invoiced
      if (err instanceof AppError && err.statusCode === 409) {
        const invoice = await prisma.invoice.findFirst({ where: { tenantId, serviceRequestId: id } });
        if (invoice) {
          await prisma.serviceRequest.update({
            where: { id },
            data: { status: resolveTicketEventStatus("pending_invoice", "invoiceGenerated") as never },
          });
          return;
        }
      }
      throw err;
    });

    await notificationsService.notifyWorkflowAdvanced(tenantId, sr.reference, "invoiced", actor?.name ?? actorId);
    return serviceRequestsRepository.findById(id, tenantId);
  }

  async rejectFinalApproval(
    id: string,
    tenantId: string,
    actorId: string,
    actorRole: string,
    input: { reason: string },
  ) {
    this.assertAdmin(actorRole);
    if (!input.reason?.trim()) throw new AppError("A rejection reason is required", 422);

    const sr = await serviceRequestsRepository.findById(id, tenantId);
    if (!sr) throw new AppError("Service ticket not found", 404);
    if (normalizeTicketStatus(sr.status) !== "pending_final_approval") {
      throw new AppError("Ticket must be pending final approval", 409);
    }

    const actor = await usersRepository.findById(actorId, tenantId);
    await prisma.serviceRequest.update({
      where: { id },
      data: { status: "assigned_engineer" as never },
    });
    await serviceRequestsRepository.addTimelineEvent(
      id,
      actor?.name ?? actorId,
      "Final approval rejected — returned to engineer",
      input.reason,
    );

    return serviceRequestsRepository.findById(id, tenantId);
  }

  async closeTicket(id: string, tenantId: string, actorId: string, actorRole: string, note?: string) {
    this.assertAdmin(actorRole);
    const sr = await serviceRequestsRepository.findById(id, tenantId);
    if (!sr) throw new AppError("Service ticket not found", 404);
    if (normalizeTicketStatus(sr.status) !== "invoiced") {
      throw new AppError("Ticket must be invoiced before closing", 409);
    }

    const actor = await usersRepository.findById(actorId, tenantId);
    await prisma.serviceRequest.update({
      where: { id },
      data: { status: resolveTicketEventStatus("invoiced", "ticketClosed") as never },
    });
    await serviceRequestsRepository.addTimelineEvent(
      id,
      actor?.name ?? actorId,
      "Ticket closed",
      note ?? "Administrative closure",
    );

    return serviceRequestsRepository.findById(id, tenantId);
  }
}

export const serviceTicketWorkflowService = new ServiceTicketWorkflowService();
