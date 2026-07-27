import { prisma } from "@/db/prisma";
import { serviceRequestsRepository } from "@/repositories/serviceRequests.repository";
import { usersRepository } from "@/repositories/users.repository";
import { AppError } from "@/middleware/errorHandler";
import { resolveTicketEventStatus } from "@/services/workflow/serviceTicketStateMachine";

type CreateInspectionData = {
  findings: string;
  recommendation: string;
  severity: string;
  attachmentFileIds?: string[];
  submit?: boolean;
};

export class InspectionsService {
  private assertAccess(
    request: { assignedTo: string | null },
    actorId: string,
    actorRole: string,
  ) {
    if (actorRole === "inspector" && request.assignedTo !== actorId) {
      throw new AppError("You can only access inspections assigned to you", 403);
    }
  }

  async getByRequestId(serviceRequestId: string, tenantId: string, actorId: string, actorRole: string) {
    const sr = await serviceRequestsRepository.findById(serviceRequestId, tenantId);
    if (!sr) throw new AppError("Service ticket not found", 404);
    this.assertAccess(sr, actorId, actorRole);

    return prisma.inspectionReport.findUnique({
      where: { serviceRequestId },
      include: {
        recommendations: { include: { catalogItem: true, inventoryItem: true } },
        attachments: { include: { file: true } },
      },
    });
  }

  async createOrUpdate(
    serviceRequestId: string,
    tenantId: string,
    actorId: string,
    actorRole: string,
    data: CreateInspectionData,
  ) {
    const sr = await serviceRequestsRepository.findById(serviceRequestId, tenantId);
    if (!sr) throw new AppError("Service ticket not found", 404);
    this.assertAccess(sr, actorId, actorRole);

    const existing = await prisma.inspectionReport.findUnique({ where: { serviceRequestId } });
    if (existing?.submittedAt && actorRole !== "admin") {
      throw new AppError("Submitted inspection reports are locked; only admin can revise", 409);
    }
    if (!["new", "inspection"].includes(sr.status) && !existing?.submittedAt) {
      throw new AppError("Inspection can only be edited during the inspection stage", 409);
    }

    const actor = await usersRepository.findById(actorId, tenantId);
    const reportedBy = actor?.name ?? actorId;
    const fileIds = [...new Set(data.attachmentFileIds ?? [])];
    const submitting = data.submit !== false;

    return prisma.$transaction(async (tx) => {
      if (fileIds.length) {
        const validFiles = await tx.storedFile.count({
          where: {
            tenantId,
            id: { in: fileIds },
            mimeType: { in: ["image/jpeg", "image/png", "image/webp"] },
          },
        });
        if (validFiles !== fileIds.length) throw new AppError("Every inspection image must be a valid uploaded image", 422);
      }

      const version = existing?.submittedAt && actorRole === "admin" ? existing.version + 1 : existing?.version ?? 1;

      const report = await tx.inspectionReport.upsert({
        where: { serviceRequestId },
        create: {
          serviceRequestId,
          findings: data.findings,
          recommendation: data.recommendation,
          severity: data.severity,
          reportedBy,
          submittedAt: submitting ? new Date() : null,
          version: 1,
        },
        update: {
          findings: data.findings,
          recommendation: data.recommendation,
          severity: data.severity,
          reportedBy,
          reportedAt: new Date(),
          version,
          ...(submitting ? { submittedAt: new Date() } : {}),
        },
      });

      if (fileIds.length) {
        await tx.inspectionAttachment.createMany({
          data: fileIds.map((fileId) => ({
            inspectionReportId: report.id,
            fileId,
            kind: "image",
          })),
          skipDuplicates: true,
        });
      }

      if (submitting) {
        const imageCount = await tx.inspectionAttachment.count({
          where: {
            inspectionReportId: report.id,
            file: { mimeType: { in: ["image/jpeg", "image/png", "image/webp"] } },
          },
        });
        if (imageCount < 1) throw new AppError("At least one inspection image is required", 422);

        if (sr.status === "new" || sr.status === "inspection") {
          const from = sr.status === "new" ? "inspection" : sr.status;
          if (sr.status === "new") {
            await tx.serviceRequest.update({
              where: { id: serviceRequestId },
              data: { status: "inspection" as never },
            });
          }
          const next = resolveTicketEventStatus(from === "inspection" ? "inspection" : "inspection", "inspectionSubmitted");
          await tx.serviceRequest.update({
            where: { id: serviceRequestId },
            data: { status: next as never },
          });
        }

        await tx.timelineEvent.create({
          data: {
            requestId: serviceRequestId,
            actor: reportedBy,
            action: "Inspection report submitted",
            note: `Severity: ${data.severity}. ${data.findings.slice(0, 120)}`,
          },
        });
      }

      return tx.inspectionReport.findUniqueOrThrow({
        where: { id: report.id },
        include: {
          recommendations: { include: { catalogItem: true, inventoryItem: true } },
          attachments: { include: { file: true } },
        },
      });
    });
  }
}

export const inspectionsService = new InspectionsService();
