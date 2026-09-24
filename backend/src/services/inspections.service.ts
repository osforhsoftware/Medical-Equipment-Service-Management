import { prisma } from "@/db/prisma";
import { serviceRequestsRepository } from "@/repositories/serviceRequests.repository";
import { usersRepository } from "@/repositories/users.repository";
import { AppError } from "@/middleware/errorHandler";
import {
  normalizeTicketStatus,
  resolveTicketEventStatus,
} from "@/services/workflow/serviceTicketStateMachine";
import { validateInspectionSubmission } from "@/utils/inspectionValidation";
import { ticketAssignmentService } from "@/services/ticketAssignment.service";
import { normalizeAdditionalFields } from "@/lib/additionalFields";
import { Prisma } from "@prisma/client";
import { upsertOpenStockPurchaseRequest } from "@/lib/stockPurchaseRequest";

type RecommendedPartInput = {
  inventoryItemId: string;
  quantity: number;
  title?: string;
  description?: string;
  priority?: string;
};

type CreateInspectionData = {
  findings: string;
  recommendation: string;
  severity: string;
  attachmentFileIds?: string[];
  attachments?: { fileId: string; caption?: string }[];
  recommendedParts?: RecommendedPartInput[];
  additionalFields?: { label: string; value: string }[] | null;
  submit?: boolean;
};

export class InspectionsService {
  private assertAccess(
    request: { assignedTo: string | null; assignedInspectorId?: string | null },
    actorId: string,
    actorRole: string,
  ) {
    if (["admin", "coordinator", "estimator", "billing", "qa"].includes(actorRole)) return;
    if (actorRole === "inspector") {
      const lockedTo = request.assignedInspectorId ?? request.assignedTo;
      if (lockedTo && lockedTo !== actorId) {
        throw new AppError("You can only access inspections assigned to you", 403);
      }
    }
  }

  /** Enforce assignment lock when moving new → inspection. */
  private assertInspectionStartAllowed(
    request: { status: string; assignedInspectorId: string | null; assignedTo: string | null },
    actorId: string,
    actorRole: string,
  ) {
    if (normalizeTicketStatus(request.status) !== "new") return;
    if (actorRole === "admin") return;

    const assignedInspector = request.assignedInspectorId ?? request.assignedTo;
    if (!assignedInspector) {
      throw new AppError(
        "An inspector must be assigned before starting inspection on this ticket",
        403,
      );
    }
    if (assignedInspector !== actorId) {
      throw new AppError(
        "Only the assigned inspector may start inspection on this ticket",
        403,
      );
    }
  }

  async getByRequestId(serviceRequestId: string, tenantId: string, actorId: string, actorRole: string) {
    const sr = await serviceRequestsRepository.findById(serviceRequestId, tenantId);
    if (!sr) throw new AppError("Service ticket not found", 404);
    this.assertAccess(sr, actorId, actorRole);

    const report = await prisma.inspectionReport.findUnique({
      where: { serviceRequestId },
      include: {
        recommendations: { include: { catalogItem: true, inventoryItem: true } },
        attachments: { include: { file: true } },
      },
    });
    if (!report) return null;
    return {
      ...report,
      additionalFields: normalizeAdditionalFields(report.additionalFields) ?? [],
      reportedBy: await this.resolveReporterName(tenantId, report.reportedBy),
    };
  }

  /** Resolve stored user ids (legacy seed/data) to a display name. */
  private async resolveReporterName(tenantId: string, reportedBy: string): Promise<string> {
    const value = reportedBy?.trim();
    if (!value) return "";
    const byId = await usersRepository.findById(value, tenantId);
    if (byId?.name) return byId.name;
    return value;
  }

  private async notifyProcurementShortage(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    tenantId: string,
    itemName: string,
    sku: string,
    quantity: number,
    reference: string,
  ) {
    await tx.notification.createMany({
      data: [
        {
          tenantId,
          type: "stock",
          title: "Stock purchase request",
          body: `${quantity} × ${itemName} (${sku}) required for inspection on ${reference}`,
          recipientRole: "inventory",
        },
        {
          tenantId,
          type: "stock",
          title: "Stock purchase request",
          body: `${quantity} × ${itemName} (${sku}) required for inspection on ${reference}`,
          recipientRole: "admin",
        },
      ],
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
    if (existing?.submittedAt && actorRole !== "admin" && actorRole !== "coordinator") {
      throw new AppError("Submitted inspection reports are locked; only an administrator or coordinator can revise", 409);
    }
    const srStatus = normalizeTicketStatus(sr.status);
    if (!["new", "inspection"].includes(srStatus) && !existing?.submittedAt) {
      throw new AppError("Inspection can only be edited during the inspection stage", 409);
    }

    const actor = await usersRepository.findById(actorId, tenantId);
    const reportedBy = actor?.name ?? actorId;
    const attachmentItems = (() => {
      if (data.attachments?.length) {
        const seen = new Set<string>();
        return data.attachments.filter((item) => {
          if (seen.has(item.fileId)) return false;
          seen.add(item.fileId);
          return true;
        });
      }
      return [...new Set(data.attachmentFileIds ?? [])].map((fileId) => ({ fileId, caption: undefined as string | undefined }));
    })();
    const fileIds = attachmentItems.map((item) => item.fileId);
    const submitting = data.submit !== false;

    if (submitting) {
      this.assertInspectionStartAllowed(sr, actorId, actorRole);
    }

    const result = await prisma.$transaction(async (tx) => {
      if (fileIds.length) {
        const validFiles = await tx.storedFile.count({
          where: {
            tenantId,
            id: { in: fileIds },
            mimeType: { in: ["image/jpeg", "image/png", "image/webp"] },
          },
        });
        if (validFiles !== fileIds.length) {
          throw new AppError("Every inspection image must be a valid uploaded image", 422);
        }
      }

      const version =
        existing?.submittedAt && (actorRole === "admin" || actorRole === "coordinator")
          ? existing.version + 1
          : existing?.version ?? 1;

      const additionalFieldsJson =
        data.additionalFields !== undefined
          ? normalizeAdditionalFields(data.additionalFields) ?? Prisma.JsonNull
          : undefined;

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
          ...(additionalFieldsJson !== undefined ? { additionalFields: additionalFieldsJson } : {}),
        },
        update: {
          findings: data.findings,
          recommendation: data.recommendation,
          severity: data.severity,
          reportedBy,
          reportedAt: new Date(),
          version,
          ...(submitting ? { submittedAt: new Date() } : {}),
          ...(additionalFieldsJson !== undefined ? { additionalFields: additionalFieldsJson } : {}),
        },
      });

      if (attachmentItems.length) {
        await tx.inspectionAttachment.createMany({
          data: attachmentItems.map((item) => ({
            inspectionReportId: report.id,
            fileId: item.fileId,
            caption: item.caption?.trim() || null,
            kind: "image",
          })),
          skipDuplicates: true,
        });
      }

      const partResults: Array<{
        inventoryItemId: string;
        requestedQuantity: number;
        availableQuantity: number;
        procurementStatus: "available" | "pending_procurement";
        purchaseRequestId?: string;
        recommendationId: string;
      }> = [];

      if (submitting) {
        const imageCount = await tx.inspectionAttachment.count({
          where: {
            inspectionReportId: report.id,
            file: { mimeType: { in: ["image/jpeg", "image/png", "image/webp"] } },
          },
        });

        const validation = validateInspectionSubmission({
          severity: data.severity,
          findings: data.findings,
          imageCount,
        });
        if (!validation.ok) throw new AppError("Inspection submission is invalid", 422);

        const parts = data.recommendedParts;
        const keepItemIds = new Set<string>();

        if (parts) {
          await tx.inspectionRecommendation.deleteMany({
            where: { inspectionReportId: report.id, type: "part" },
          });

          for (const part of parts) {
            if (!part.inventoryItemId || part.quantity <= 0) continue;
            const item = await tx.inventoryItem.findFirst({
              where: { id: part.inventoryItemId, tenantId },
            });
            if (!item) throw new AppError(`Inventory item ${part.inventoryItemId} not found`, 404);

            const requestedQuantity = Math.max(1, Math.ceil(Number(part.quantity)));
            const available = Math.max(0, item.inStock - item.reserved);
            const shortage = requestedQuantity > available;
            const procurementStatus = shortage ? "pending_procurement" : "available";

            const recommendation = await tx.inspectionRecommendation.create({
              data: {
                inspectionReportId: report.id,
                inventoryItemId: part.inventoryItemId,
                type: "part",
                title: part.title?.trim() || item.name,
                description: part.description?.trim() || `Recommended spare part: ${item.name}`,
                priority: (part.priority ?? "medium") as never,
                quantity: requestedQuantity,
                estimatedCost: Number(item.sellingPrice ?? item.unitCost ?? 0) * requestedQuantity,
                procurementStatus,
              },
            });

            keepItemIds.add(part.inventoryItemId);
            const { request, created } = await upsertOpenStockPurchaseRequest(tx, {
              tenantId,
              inventoryItemId: part.inventoryItemId,
              quantity: requestedQuantity,
              requestedBy: actorId,
              serviceRequestId,
              note: `Requested from inspection report on ${sr.reference}`,
            });
            if (created) {
              await this.notifyProcurementShortage(
                tx,
                tenantId,
                item.name,
                item.sku,
                requestedQuantity,
                sr.reference,
              );
            }

            partResults.push({
              inventoryItemId: part.inventoryItemId,
              requestedQuantity,
              availableQuantity: available,
              procurementStatus,
              purchaseRequestId: request?.id,
              recommendationId: recommendation.id,
            });
          }

          const stale = await tx.stockPurchaseRequest.findMany({
            where: {
              tenantId,
              serviceRequestId,
              jobId: null,
              status: "open",
              purchaseOrderId: null,
              note: { contains: "inspection report" },
              ...(keepItemIds.size ? { inventoryItemId: { notIn: [...keepItemIds] } } : {}),
            },
          });
          if (stale.length && (keepItemIds.size || parts.length === 0)) {
            await tx.stockPurchaseRequest.deleteMany({
              where: { id: { in: stale.map((row) => row.id) } },
            });
          }
        }

        if (srStatus === "new" || srStatus === "inspection") {
          if (srStatus === "new") {
            await tx.serviceRequest.update({
              where: { id: serviceRequestId },
              data: { status: "inspection" as never },
            });
          }
          const next = resolveTicketEventStatus("inspection", "inspectionSubmitted");
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

      const saved = await tx.inspectionReport.findUniqueOrThrow({
        where: { id: report.id },
        include: {
          recommendations: { include: { catalogItem: true, inventoryItem: true } },
          attachments: { include: { file: true } },
        },
      });

      return {
        ...saved,
        additionalFields: normalizeAdditionalFields(saved.additionalFields) ?? [],
        partResults: submitting ? partResults : undefined,
      };
    });

    if (submitting) {
      const ticket = await serviceRequestsRepository.findById(serviceRequestId, tenantId);
      if (ticket) {
        await ticketAssignmentService.applyAfterInspectionSubmitted(tenantId, ticket, reportedBy);
      }
    }

    return {
      ...result,
      reportedBy: await this.resolveReporterName(tenantId, result.reportedBy),
    };
  }
}

export const inspectionsService = new InspectionsService();
