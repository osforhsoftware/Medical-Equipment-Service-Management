import { prisma } from "@/db/prisma";
import { serviceRequestsRepository } from "@/repositories/serviceRequests.repository";
import { usersRepository } from "@/repositories/users.repository";
import { AppError } from "@/middleware/errorHandler";

type CreateInspectionData = {
  findings: string;
  recommendation: string;
  severity: string;
};

export class InspectionsService {
  async getByRequestId(serviceRequestId: string, tenantId: string) {
    const sr = await serviceRequestsRepository.findById(serviceRequestId, tenantId);
    if (!sr) throw new AppError("Service request not found", 404);

    const report = await prisma.inspectionReport.findUnique({ where: { serviceRequestId } });
    return report;
  }

  async createOrUpdate(serviceRequestId: string, tenantId: string, actorId: string, data: CreateInspectionData) {
    const sr = await serviceRequestsRepository.findById(serviceRequestId, tenantId);
    if (!sr) throw new AppError("Service request not found", 404);

    const actor = await usersRepository.findById(actorId, tenantId);
    const reportedBy = actor?.name ?? actorId;

    const report = await prisma.inspectionReport.upsert({
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

    // Advance SR to estimate stage
    await serviceRequestsRepository.update(serviceRequestId, tenantId, {
      status: "estimate",
    });

    await serviceRequestsRepository.addTimelineEvent(
      serviceRequestId,
      reportedBy,
      "Inspection report submitted",
      `Severity: ${data.severity}. ${data.findings.slice(0, 120)}`,
    );

    return report;
  }
}

export const inspectionsService = new InspectionsService();
