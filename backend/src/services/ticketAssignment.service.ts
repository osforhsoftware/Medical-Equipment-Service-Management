import { prisma } from "@/db/prisma";
import { settingsRepository } from "@/repositories/settings.repository";
import { notificationsService } from "@/services/notifications.service";
import { findActiveStaffWithRole } from "@/utils/userRoles";

type TicketForAssignment = {
  id: string;
  reference: string;
  equipmentName: string | null;
};

export class TicketAssignmentService {
  async defaultInspectorOnCreate(tenantId: string) {
    const settings = await settingsRepository.ensureDefaults(tenantId);
    if (!settings.autoAssignInspectorOnCreate || !settings.defaultInspectorUserId) return null;
    return findActiveStaffWithRole(tenantId, settings.defaultInspectorUserId, "inspector");
  }

  async applyAfterInspectionSubmitted(
    tenantId: string,
    ticket: TicketForAssignment,
    actorName: string,
  ) {
    const settings = await settingsRepository.ensureDefaults(tenantId);
    const equipmentName = ticket.equipmentName ?? "Equipment";

    await notificationsService.create(tenantId, {
      type: "job",
      title: "Inspection completed",
      body: `${ticket.reference} (${equipmentName}) is ready for estimate.`,
      recipientRole: "coordinator",
    });

    if (settings.autoAssignCoordinatorAfterInspection && settings.defaultCoordinatorUserId) {
      const coordinator = await findActiveStaffWithRole(
        tenantId,
        settings.defaultCoordinatorUserId,
        "coordinator",
      );
      if (coordinator) {
        await notificationsService.notifyAssignment(
          tenantId,
          ticket.reference,
          coordinator.id,
          coordinator.name,
          equipmentName,
        );
        await prisma.timelineEvent.create({
          data: {
            requestId: ticket.id,
            actor: actorName,
            action: `Routed to ${coordinator.name}`,
            note: "Auto-assigned to the service coordinator after inspection.",
          },
        });
      }
    }

    if (settings.autoAssignEstimatorAfterInspection && settings.defaultEstimatorUserId) {
      const estimator = await findActiveStaffWithRole(
        tenantId,
        settings.defaultEstimatorUserId,
        "estimator",
      );
      if (estimator) {
        await prisma.serviceRequest.update({
          where: { id: ticket.id },
          data: {
            assignedTo: estimator.id,
            assignedName: estimator.name,
            assignedEstimatorId: estimator.id,
          },
        });
        await prisma.timelineEvent.create({
          data: {
            requestId: ticket.id,
            actor: actorName,
            action: `Assigned to ${estimator.name}`,
            note: "Auto-assigned to estimate staff after inspection.",
          },
        });
        await notificationsService.notifyAssignment(
          tenantId,
          ticket.reference,
          estimator.id,
          estimator.name,
          equipmentName,
        );
        return;
      }
    }

    if (settings.autoAssignCoordinatorAfterInspection && settings.defaultCoordinatorUserId) {
      const coordinator = await findActiveStaffWithRole(
        tenantId,
        settings.defaultCoordinatorUserId,
        "coordinator",
      );
      if (coordinator) {
        await prisma.serviceRequest.update({
          where: { id: ticket.id },
          data: {
            assignedTo: coordinator.id,
            assignedName: coordinator.name,
          },
        });
      }
    }
  }

  async defaultEngineerOnApproval(tenantId: string) {
    const settings = await settingsRepository.ensureDefaults(tenantId);
    if (!settings.autoAssignEngineerOnApproval || !settings.defaultEngineerUserId) return null;
    return findActiveStaffWithRole(tenantId, settings.defaultEngineerUserId, "engineer");
  }
}

export const ticketAssignmentService = new TicketAssignmentService();
