import { createHash, randomUUID } from "crypto";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/db/prisma";
import { env } from "@/config/env";
import { AppError } from "@/middleware/errorHandler";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "application/pdf",
  "text/plain", "text/csv", "video/mp4", "video/webm",
]);

function storageRoot() {
  return path.resolve(process.cwd(), env.PRIVATE_STORAGE_PATH);
}

function safePath(storageKey: string) {
  const root = storageRoot();
  const resolved = path.resolve(root, storageKey);
  if (!resolved.startsWith(`${root}${path.sep}`)) throw new AppError("Invalid storage key", 400);
  return resolved;
}

export class FileStorageService {
  async save(tenantId: string, uploadedById: string, file: Express.Multer.File) {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) throw new AppError("File type is not allowed", 415);
    if (!file.size || file.size > env.MAX_UPLOAD_BYTES) throw new AppError("File exceeds upload size limit", 413);
    return this.saveBuffer(tenantId, uploadedById, {
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
    });
  }

  async saveBuffer(
    tenantId: string,
    uploadedById: string,
    file: { buffer: Buffer; originalName: string; mimeType: string },
  ) {
    if (!ALLOWED_MIME_TYPES.has(file.mimeType)) throw new AppError("File type is not allowed", 415);
    if (!file.buffer.length || file.buffer.length > env.MAX_UPLOAD_BYTES) {
      throw new AppError("File exceeds upload size limit", 413);
    }
    const extension = path.extname(file.originalName).toLowerCase().replace(/[^a-z0-9.]/g, "");
    const storageKey = path.join(tenantId, `${randomUUID()}${extension}`).replaceAll("\\", "/");
    const destination = safePath(storageKey);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, file.buffer, { flag: "wx" });
    try {
      return await prisma.storedFile.create({
        data: {
          tenantId,
          storageKey,
          originalName: path.basename(file.originalName),
          mimeType: file.mimeType,
          size: file.buffer.length,
          sha256: createHash("sha256").update(file.buffer).digest("hex"),
          uploadedById,
        },
      });
    } catch (error) {
      await unlink(destination).catch(() => undefined);
      throw error;
    }
  }

  async metadata(tenantId: string, id: string, actorId: string, role: string) {
    const file = await prisma.storedFile.findFirst({ where: { id, tenantId } });
    if (!file) throw new AppError("File not found", 404);
    await this.assertAccess(file.id, tenantId, actorId, role, file.uploadedById);
    return file;
  }

  async download(tenantId: string, id: string, actorId: string, role: string) {
    const file = await this.metadata(tenantId, id, actorId, role);
    try {
      return { file, buffer: await readFile(safePath(file.storageKey)) };
    } catch {
      throw new AppError("Stored file content is unavailable", 404);
    }
  }

  private async assertAccess(fileId: string, tenantId: string, actorId: string, role: string, uploaderId: string) {
    if (role !== "customer" || actorId === uploaderId) return;
    const user = await prisma.user.findFirst({ where: { id: actorId, tenantId } });
    if (!user?.customerId) throw new AppError("File access denied", 403);
    const [clientDocument, inspectionAttachment] = await Promise.all([
      prisma.document.findFirst({
        where: { tenantId, fileId, isInternal: false },
      }),
      prisma.inspectionAttachment.findFirst({
        where: {
          fileId,
          inspectionReport: { serviceRequest: { tenantId, customerId: user.customerId } },
        },
      }),
    ]);
    if (inspectionAttachment) return;
    if (!clientDocument) throw new AppError("File access denied", 403);
    if (clientDocument.invoiceId) {
      const invoice = await prisma.invoice.findFirst({
        where: { id: clientDocument.invoiceId, tenantId, customerId: user.customerId },
      });
      if (invoice) return;
    }
    if (clientDocument.entityType === "estimate") {
      const estimate = await prisma.estimate.findFirst({
        where: { id: clientDocument.entityId, tenantId, customerId: user.customerId },
      });
      if (estimate) return;
    }
    if (clientDocument.entityType === "service-report") {
      const job = await prisma.serviceJob.findFirst({
        where: { id: clientDocument.entityId, tenantId, customerId: user.customerId },
      });
      if (job) return;
    }
    throw new AppError("File access denied", 403);
  }
}

export const fileStorageService = new FileStorageService();
