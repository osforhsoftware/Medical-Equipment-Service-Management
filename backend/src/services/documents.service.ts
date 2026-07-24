import PDFDocument from "pdfkit";
import { prisma } from "@/db/prisma";
import { AppError } from "@/middleware/errorHandler";
import { fileStorageService } from "@/services/fileStorage.service";

type DocumentKind = "estimate" | "invoice" | "service-report";

function money(value: unknown) {
  return `INR ${Number(value ?? 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

async function toBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

export class DocumentsService {
  private async header(doc: PDFKit.PDFDocument, tenantId: string, title: string, reference: string) {
    const [tenant, settings] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId } }),
      prisma.tenantSettings.findUnique({ where: { tenantId } }),
    ]);
    if (settings?.logoFileId) {
      try {
        const { buffer } = await fileStorageService.download(
          tenantId,
          settings.logoFileId,
          "system",
          "admin",
        );
        doc.image(buffer, 50, 40, { fit: [56, 56] });
      } catch {
        // The document remains valid if an old logo file is unavailable.
      }
    }
    doc.fontSize(18).font("Helvetica-Bold").text(tenant?.name ?? "MESMS", 120, 42);
    doc.fontSize(9).font("Helvetica").fillColor("#475569").text(settings?.supportEmail ?? "", 120, 66);
    doc.fillColor("#0f172a").fontSize(20).font("Helvetica-Bold").text(title.toUpperCase(), 350, 42, {
      width: 195,
      align: "right",
    });
    doc.fontSize(10).font("Helvetica").text(reference, 350, 68, { width: 195, align: "right" });
    doc.moveTo(50, 110).lineTo(545, 110).lineWidth(1.5).stroke("#0f172a");
    doc.y = 128;
  }

  private drawLines(
    doc: PDFKit.PDFDocument,
    lines: Array<{ description: string; quantity: unknown; unitPrice: unknown; lineTotal: unknown }>,
  ) {
    doc.font("Helvetica-Bold").fontSize(9);
    doc.text("Description", 50, doc.y, { width: 280 });
    doc.text("Qty", 335, doc.y, { width: 45, align: "right" });
    doc.text("Unit price", 385, doc.y, { width: 75, align: "right" });
    doc.text("Amount", 465, doc.y, { width: 80, align: "right" });
    doc.moveDown(0.7).moveTo(50, doc.y).lineTo(545, doc.y).stroke("#cbd5e1").moveDown(0.5);
    doc.font("Helvetica").fontSize(9);
    for (const line of lines) {
      const y = doc.y;
      doc.text(line.description, 50, y, { width: 280 });
      doc.text(String(Number(line.quantity)), 335, y, { width: 45, align: "right" });
      doc.text(money(line.unitPrice), 385, y, { width: 75, align: "right" });
      doc.text(money(line.lineTotal), 465, y, { width: 80, align: "right" });
      doc.y = Math.max(doc.y, y + 18);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke("#e2e8f0").moveDown(0.4);
    }
  }

  async generate(tenantId: string, actorId: string, kind: DocumentKind, entityId: string) {
    const doc = new PDFDocument({ size: "A4", margin: 50, info: { Title: `${kind} ${entityId}` } });
    let reference = entityId;
    let filename = `${kind}-${entityId}.pdf`;
    let invoiceId: string | undefined;

    if (kind === "estimate") {
      const estimate = await prisma.estimate.findFirst({
        where: { id: entityId, tenantId },
        include: { lineItems: true },
      });
      if (!estimate) throw new AppError("Estimate not found", 404);
      reference = estimate.reference;
      filename = `${reference}.pdf`;
      await this.header(doc, tenantId, "Estimate", reference);
      doc.fontSize(9).fillColor("#475569").text("Prepared for").fillColor("#0f172a");
      doc.fontSize(12).font("Helvetica-Bold").text(estimate.customerName);
      doc.fontSize(9).font("Helvetica").text(`Equipment: ${estimate.equipmentName}`);
      doc.text(`Valid until: ${estimate.validUntil.toLocaleDateString()}`).moveDown();
      this.drawLines(doc, estimate.lineItems);
      doc.moveDown().font("Helvetica-Bold").text(`Subtotal: ${money(estimate.subtotal)}`, { align: "right" });
      doc.text(`Discount: ${money(estimate.discount)}`, { align: "right" });
      doc.text(`Tax: ${money(estimate.tax)}`, { align: "right" });
      doc.fontSize(13).text(`Total: ${money(estimate.total)}`, { align: "right" });
      if (estimate.terms) doc.moveDown().fontSize(9).font("Helvetica-Bold").text("Terms").font("Helvetica").text(estimate.terms);
    } else if (kind === "invoice") {
      const invoice = await prisma.invoice.findFirst({
        where: { id: entityId, tenantId },
        include: { lineItems: true, payments: true },
      });
      if (!invoice) throw new AppError("Invoice not found", 404);
      reference = invoice.reference;
      filename = `${reference}.pdf`;
      invoiceId = invoice.id;
      await this.header(doc, tenantId, "Tax Invoice", reference);
      doc.fontSize(9).fillColor("#475569").text("Bill to").fillColor("#0f172a");
      doc.fontSize(12).font("Helvetica-Bold").text(invoice.customerName);
      doc.fontSize(9).font("Helvetica").text(`Issued: ${invoice.issuedAt.toLocaleDateString()}`);
      doc.text(`Due: ${invoice.dueAt.toLocaleDateString()}`).moveDown();
      this.drawLines(doc, invoice.lineItems);
      doc.moveDown().font("Helvetica-Bold").text(`Subtotal: ${money(invoice.amount)}`, { align: "right" });
      doc.text(`Tax: ${money(invoice.tax)}`, { align: "right" });
      doc.fontSize(13).text(`Total: ${money(invoice.total)}`, { align: "right" });
      doc.fontSize(10).text(`Paid: ${money(invoice.paidTotal)}  |  Balance: ${money(invoice.balanceDue)}`, {
        align: "right",
      });
    } else {
      const job = await prisma.serviceJob.findFirst({
        where: { id: entityId, tenantId },
        include: {
          workLogs: { include: { user: true }, orderBy: { startedAt: "asc" } },
          assignments: { where: { endedAt: null }, include: { user: true } },
          extras: true,
          stockDeductions: true,
          signature: true,
        },
      });
      if (!job) throw new AppError("Service job not found", 404);
      if (job.status !== "completed") throw new AppError("Only completed jobs have a final service report", 409);
      reference = job.reference;
      filename = `${reference}-service-report.pdf`;
      await this.header(doc, tenantId, "Service Report", reference);
      doc.fontSize(11).font("Helvetica-Bold").text(job.equipmentName);
      doc.fontSize(9).font("Helvetica").text(`Customer: ${job.customerName}`);
      doc.text(`Service type: ${job.type}`);
      doc.text(`Scheduled: ${job.scheduledFor.toLocaleDateString()}`);
      doc.text(`Team: ${job.assignments.map((assignment) => assignment.user.name).join(", ") || job.engineer}`).moveDown();
      doc.font("Helvetica-Bold").text("Work performed").moveDown(0.4);
      for (const log of job.workLogs) {
        doc.font("Helvetica-Bold").text(`${log.user.name} — ${log.startedAt.toLocaleString()}`);
        doc.font("Helvetica").text(log.workPerformed);
        if (log.testingResult) doc.text(`Testing: ${log.testingResult}`);
        if (log.calibrationResult) doc.text(`Calibration: ${log.calibrationResult}`);
        doc.moveDown(0.6);
      }
      if (job.stockDeductions.length) {
        doc.font("Helvetica-Bold").text("Parts consumed");
        for (const item of job.stockDeductions) doc.font("Helvetica").text(`${item.quantity} × ${item.itemName} (${item.sku})`);
      }
      if (job.signature) {
        doc.moveDown().font("Helvetica-Bold").text(`Customer sign-off: ${job.signature.customerName}`);
        doc.font("Helvetica").text(`Captured: ${job.signature.capturedAt.toLocaleString()}`);
      }
    }

    const buffer = await toBuffer(doc);
    const file = await fileStorageService.saveBuffer(tenantId, actorId, {
      buffer,
      originalName: filename,
      mimeType: "application/pdf",
    });
    const latest = await prisma.document.aggregate({
      where: { tenantId, entityType: kind, entityId, kind },
      _max: { version: true },
    });
    const document = await prisma.document.create({
      data: {
        tenantId,
        fileId: file.id,
        invoiceId,
        entityType: kind,
        entityId,
        kind,
        version: (latest._max.version ?? 0) + 1,
        createdBy: actorId,
      },
    });
    return { document, file, downloadUrl: `/api/files/${file.id}/download`, reference };
  }
}

export const documentsService = new DocumentsService();
