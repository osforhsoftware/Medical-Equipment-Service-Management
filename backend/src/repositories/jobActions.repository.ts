import { prisma } from "@/db/prisma";
import type { JobActivity, JobPartsRequest, JobPhoto, JobSignature, JobStockDeduction } from "@prisma/client";

export class JobActionsRepository {
  async addPhotos(
    jobId: string,
    photos: { filename: string; mimeType: string; dataUrl: string; uploadedBy: string }[],
  ): Promise<JobPhoto[]> {
    return prisma.$transaction(
      photos.map((p) =>
        prisma.jobPhoto.create({
          data: { jobId, ...p },
        }),
      ),
    );
  }

  async addPartsRequest(
    jobId: string,
    data: { notes: string; requestedBy: string },
  ): Promise<JobPartsRequest> {
    return prisma.jobPartsRequest.create({
      data: { jobId, notes: data.notes, requestedBy: data.requestedBy },
    });
  }

  async upsertSignature(
    jobId: string,
    data: { customerName: string; signatureData?: string; capturedBy: string },
  ): Promise<JobSignature> {
    return prisma.jobSignature.upsert({
      where: { jobId },
      create: {
        jobId,
        customerName: data.customerName,
        signatureData: data.signatureData,
        capturedBy: data.capturedBy,
      },
      update: {
        customerName: data.customerName,
        signatureData: data.signatureData,
        capturedBy: data.capturedBy,
        capturedAt: new Date(),
      },
    });
  }

  async addStockDeduction(
    jobId: string,
    data: {
      inventoryItemId: string;
      itemName: string;
      sku: string;
      quantity: number;
      deductedBy: string;
    },
  ): Promise<JobStockDeduction> {
    return prisma.jobStockDeduction.create({ data: { jobId, ...data } });
  }

  async addActivity(
    jobId: string,
    data: { actor: string; action: string; note?: string },
  ): Promise<JobActivity> {
    return prisma.jobActivity.create({ data: { jobId, ...data } });
  }

  async getActivities(jobId: string): Promise<JobActivity[]> {
    return prisma.jobActivity.findMany({
      where: { jobId },
      orderBy: { createdAt: "desc" },
    });
  }
}

export const jobActionsRepository = new JobActionsRepository();
