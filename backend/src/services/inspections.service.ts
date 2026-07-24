import { prisma } from "@/db/prisma";
import { serviceRequestsRepository } from "@/repositories/serviceRequests.repository";
import { usersRepository } from "@/repositories/users.repository";
import { AppError } from "@/middleware/errorHandler";

type CreateInspectionData = {
  findings: string;
  recommendation: string;
  severity: string;
  attachmentFileIds?: string[];
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
    if (!sr) throw new AppError("Service request not found", 404);
    this.assertAccess(sr, actorId, actorRole);

    const report = await prisma.inspectionReport.findUnique({
      where: { serviceRequestId },
      include: {
        recommendations: { include: { catalogItem: true, inventoryItem: true } },
        attachments: { include: { file: true } },
      },
    });
    return report;
  }

  async createOrUpdate(
    serviceRequestId: string,
    tenantId: string,
    actorId: string,
    actorRole: string,
    data: CreateInspectionData,
  ) {
    const sr = await serviceRequestsRepository.findById(serviceRequestId, tenantId);
    if (!sr) throw new AppError("Service request not found", 404);
    this.assertAccess(sr, actorId, actorRole);
    if (sr.status !== "inspection") {
      throw new AppError("Inspection can only be submitted during the inspection stage", 409);
    }

    const actor = await usersRepository.findById(actorId, tenantId);
    const reportedBy = actor?.name ?? actorId;
    const fileIds = [...new Set(data.attachmentFileIds ?? [])];

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
      const report = await tx.inspectionReport.upsert({
        where: { serviceRequestId },
        create: {
          serviceRequestId,
          findings: data.findings,
          recommendation: data.recommendation,
          severity: data.severity,
          reportedBy,
        },
        update: {
          findings: data.findings,
          recommendation: data.recommendation,
          severity: data.severity,
          reportedBy,
          reportedAt: new Date(),
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
      const imageCount = await tx.inspectionAttachment.count({
        where: {
          inspectionReportId: report.id,
          file: { mimeType: { in: ["image/jpeg", "image/png", "image/webp"] } },
        },
      });
      if (imageCount < 1) throw new AppError("At least one machine inspection image is required", 422);

      await tx.serviceRequest.update({
        where: { id: serviceRequestId },
        data: { status: "estimate" },
      });
      await tx.timelineEvent.create({
        data: {
          requestId: serviceRequestId,
          actor: reportedBy,
          action: "Inspection report submitted",
          note: `Severity: ${data.severity}. ${data.findings.slice(0, 120)}`,
        },
      });

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
