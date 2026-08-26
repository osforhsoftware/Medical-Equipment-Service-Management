import PDFDocument from "pdfkit";
import { prisma } from "@/db/prisma";
import { AppError } from "@/middleware/errorHandler";
import { fileStorageService } from "@/services/fileStorage.service";
import { BILLING_CHARGE_GROUPS, chargeGroupForType, lineAmount } from "@/utils/invoiceCharges";

type DocumentKind = "estimate" | "invoice" | "service-report";

const INK = "#0f172a";
const MUTED = "#64748b";
const LABEL = "#94a3b8";
const RULE = "#e2e8f0";
const RULE_STRONG = "#cbd5e1";
const WASH = "#f8fafc";
const ACCENT = "#1657a8";
const LEFT = 50;
const RIGHT = 545;
const WIDTH = RIGHT - LEFT;
const PAGE_BOTTOM = 730;

function money(value: unknown) {
  return `Rs ${Number(value ?? 0).toLocaleString("en-IN", {
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

function fmtDate(value: Date) {
  return value.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export class DocumentsService {
  private async header(
    doc: PDFKit.PDFDocument,
    tenantId: string,
    title: string,
    reference: string,
  ) {
    const [tenant, settings] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId } }),
      prisma.tenantSettings.findUnique({ where: { tenantId } }),
    ]);

    let logoDrawn = false;
    if (settings?.logoFileId) {
      try {
        const { buffer } = await fileStorageService.download(
          tenantId,
          settings.logoFileId,
          "system",
          "admin",
        );
        doc.image(buffer, LEFT, 58, { fit: [44, 44] });
        logoDrawn = true;
      } catch {
        // Keep the document valid if an old logo file is unavailable.
      }
    }

    const headerTop = 58;
    const headerH = 44;
    const textX = logoDrawn ? LEFT + 56 : LEFT;
    const name = tenant?.name ?? "MESMS";
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(14).text(name, textX, headerTop + 6, {
      width: 248,
      lineBreak: false,
    });
    doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(settings?.supportEmail ?? "", textX, headerTop + 26, {
      width: 248,
      lineBreak: false,
    });

    doc.fillColor(INK).font("Helvetica-Bold").fontSize(16).text(title.toUpperCase(), 330, headerTop + 4, {
      width: WIDTH - 280,
      align: "right",
      lineBreak: false,
    });
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(11).text(reference, 330, headerTop + 26, {
      width: WIDTH - 280,
      align: "right",
      lineBreak: false,
    });
    const ruleY = headerTop + headerH + 14;
    doc.moveTo(LEFT, ruleY).lineTo(RIGHT, ruleY).lineWidth(1).strokeColor(RULE).stroke();
    doc.moveTo(LEFT, ruleY).lineTo(LEFT + 56, ruleY).lineWidth(2).strokeColor(ACCENT).stroke();
    doc.lineWidth(1);
    doc.y = ruleY + 20;
  }

  private partyAndMeta(
    doc: PDFKit.PDFDocument,
    billTo: { name: string; lines?: string[] },
    meta: Array<{ label: string; value: string }>,
  ) {
    const top = doc.y;
    const colW = WIDTH / 2;

    doc.fillColor(LABEL).font("Helvetica-Bold").fontSize(8).text("BILL TO", LEFT, top);
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(12).text(billTo.name, LEFT, top + 14, {
      width: colW - 16,
    });
    doc.font("Helvetica").fontSize(9).fillColor(MUTED);
    let ly = top + 32;
    for (const line of billTo.lines ?? []) {
      doc.text(line, LEFT, ly, { width: colW - 16 });
      ly += 13;
    }

    let my = top;
    for (const row of meta) {
      doc.fillColor(LABEL).font("Helvetica").fontSize(8).text(row.label.toUpperCase(), LEFT + colW, my + 1, {
        width: 92,
      });
      doc.fillColor(INK).font("Helvetica-Bold").fontSize(10).text(row.value, LEFT + colW + 96, my, {
        width: colW - 96,
      });
      my += 16;
    }

    doc.y = Math.max(ly, my) + 18;
  }

  private drawTableHeader(doc: PDFKit.PDFDocument, y: number) {
    doc.save();
    doc.rect(LEFT, y, WIDTH, 22).fill(WASH);
    doc.restore();
    doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(8);
    doc.text("#", LEFT, y + 7, { width: 18 });
    doc.text("DESCRIPTION", LEFT + 22, y + 7, { width: 198 });
    doc.text("QTY", 292, y + 7, { width: 36, align: "center" });
    doc.text("RATE", 332, y + 7, { width: 70, align: "right" });
    doc.text("TAX", 406, y + 7, { width: 40, align: "center" });
    doc.text("AMOUNT", 450, y + 7, { width: 87, align: "right" });
    doc.moveTo(LEFT, y + 22).lineTo(RIGHT, y + 22).strokeColor(RULE).stroke();
    return y + 22;
  }

  private drawLines(
    doc: PDFKit.PDFDocument,
    lines: Array<{
      description: string;
      quantity: unknown;
      unitPrice: unknown;
      lineTotal: unknown;
      taxRate?: unknown;
    }>,
  ) {
    let y = this.drawTableHeader(doc, doc.y);

    lines.forEach((line, index) => {
      const desc = line.description || "—";
      doc.font("Helvetica").fontSize(9);
      const descH = doc.heightOfString(desc, { width: 198 });
      const rowH = Math.max(26, descH + 12);
      if (y + rowH > PAGE_BOTTOM) {
        doc.addPage();
        y = this.drawTableHeader(doc, 48);
      }
      doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(String(index + 1), LEFT, y + 8, { width: 18 });
      doc.fillColor(INK).text(desc, LEFT + 22, y + 8, { width: 198 });
      doc.text(String(Number(line.quantity)), 292, y + 8, { width: 36, align: "center" });
      doc.text(money(line.unitPrice), 332, y + 8, { width: 70, align: "right" });
      doc.fillColor(MUTED).text(`${Number(line.taxRate ?? 0)}%`, 406, y + 8, { width: 40, align: "center" });
      doc.fillColor(INK).font("Helvetica-Bold").text(money(line.lineTotal), 450, y + 8, {
        width: 87,
        align: "right",
      });
      y += rowH;
      doc.moveTo(LEFT, y).lineTo(RIGHT, y).strokeColor(RULE).stroke();
    });

    doc.y = y + 18;
    doc.fillColor(INK);
  }

  private drawGroupedLines(
    doc: PDFKit.PDFDocument,
    lines: Array<{
      type?: string | null;
      description: string;
      quantity: unknown;
      unitPrice: unknown;
      lineTotal: unknown;
      taxRate?: unknown;
      discount?: unknown;
    }>,
  ) {
    const grouped = BILLING_CHARGE_GROUPS.map((group) => ({
      ...group,
      lines: lines.filter((line) => chargeGroupForType(String(line.type ?? "other")).key === group.key),
    })).filter((group) => group.lines.length > 0);

    if (!grouped.length) {
      this.drawLines(doc, lines);
      return;
    }

    let y = this.drawTableHeader(doc, doc.y);
    let index = 0;
    for (const group of grouped) {
      if (y + 22 > PAGE_BOTTOM) {
        doc.addPage();
        y = this.drawTableHeader(doc, 48);
      }
      doc.save();
      doc.rect(LEFT, y, WIDTH, 20).fill("#eef4fb");
      doc.restore();
      doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(8).text(group.label.toUpperCase(), LEFT + 8, y + 6, {
        width: WIDTH - 16,
      });
      y += 20;
      for (const line of group.lines) {
        index += 1;
        const desc = line.description || "—";
        doc.font("Helvetica").fontSize(9);
        const descH = doc.heightOfString(desc, { width: 198 });
        const rowH = Math.max(26, descH + 12);
        if (y + rowH > PAGE_BOTTOM) {
          doc.addPage();
          y = this.drawTableHeader(doc, 48);
        }
        doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(String(index), LEFT, y + 8, { width: 18 });
        doc.fillColor(INK).text(desc, LEFT + 22, y + 8, { width: 198 });
        doc.text(String(Number(line.quantity)), 292, y + 8, { width: 36, align: "center" });
        doc.text(money(line.unitPrice), 332, y + 8, { width: 70, align: "right" });
        doc.fillColor(MUTED).text(`${Number(line.taxRate ?? 0)}%`, 406, y + 8, { width: 40, align: "center" });
        doc.fillColor(INK).font("Helvetica-Bold").text(money(line.lineTotal), 450, y + 8, {
          width: 87,
          align: "right",
        });
        y += rowH;
        doc.moveTo(LEFT, y).lineTo(RIGHT, y).strokeColor(RULE).stroke();
      }
    }

    doc.y = y + 18;
    doc.fillColor(INK);
  }

  private totals(
    doc: PDFKit.PDFDocument,
    rows: Array<{ label: string; value: string; emphasis?: boolean }>,
  ) {
    const boxW = 220;
    const x = RIGHT - boxW;
    let y = doc.y;
    for (const row of rows) {
      if (row.emphasis) {
        y += 4;
        doc.moveTo(x, y).lineTo(RIGHT, y).strokeColor(RULE_STRONG).stroke();
        y += 10;
        doc.fillColor(INK).font("Helvetica-Bold").fontSize(11);
        doc.text(row.label, x, y, { width: 80 });
        doc.fontSize(13).text(row.value, x + 80, y - 1, { width: boxW - 80, align: "right" });
        y += 22;
      } else {
        doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(row.label, x, y, { width: 80 });
        doc.fillColor(INK).font("Helvetica").text(row.value, x + 80, y, { width: boxW - 80, align: "right" });
        y += 16;
      }
    }
    doc.y = y + 10;
  }

  private stampFooters(doc: PDFKit.PDFDocument, company: string, kindLabel: string, reference: string) {
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i += 1) {
      doc.switchToPage(range.start + i);
      const y = doc.page.height - 40;
      doc.moveTo(LEFT, y).lineTo(RIGHT, y).strokeColor(RULE).stroke();
      doc.fillColor(MUTED).font("Helvetica").fontSize(8);
      doc.text(`${company}  ·  ${kindLabel} ${reference}`, LEFT, y + 8, {
        width: WIDTH / 2,
        lineBreak: false,
      });
      doc.text(`Page ${i + 1} of ${range.count}`, LEFT + WIDTH / 2, y + 8, {
        width: WIDTH / 2,
        align: "right",
        lineBreak: false,
      });
    }
  }

  private signatures(doc: PDFKit.PDFDocument, company: string) {
    if (doc.y > 640) doc.addPage();
    const y = doc.y + 18;
    const colW = (WIDTH - 40) / 2;
    const rightX = LEFT + colW + 40;
    doc.fillColor(LABEL).font("Helvetica-Bold").fontSize(8);
    doc.text("AUTHORIZED SIGNATURE", LEFT, y, { width: colW });
    doc.text("CUSTOMER ACKNOWLEDGEMENT", rightX, y, { width: colW });
    doc.moveTo(LEFT, y + 44).lineTo(LEFT + colW, y + 44).strokeColor(RULE_STRONG).stroke();
    doc.moveTo(rightX, y + 44).lineTo(rightX + colW, y + 44).stroke();
    doc.fillColor(MUTED).font("Helvetica").fontSize(9);
    doc.text(company, LEFT, y + 50, { width: colW });
    doc.text("Customer Signature", rightX, y + 50, { width: colW });
    doc.y = y + 72;
  }

  async generate(tenantId: string, actorId: string, kind: DocumentKind, entityId: string) {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 56, bottom: 56, left: 50, right: 50 },
      bufferPages: true,
      info: { Title: `${kind} ${entityId}` },
    });
    let reference = entityId;
    let filename = `${kind}-${entityId}.pdf`;
    let invoiceId: string | undefined;
    let kindLabel = "Document";
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const company = tenant?.name ?? "MESMS";

    if (kind === "estimate") {
      const estimate = await prisma.estimate.findFirst({
        where: { id: entityId, tenantId },
        include: { lineItems: true },
      });
      if (!estimate) throw new AppError("Estimate not found", 404);
      reference = estimate.reference;
      filename = `${reference}.pdf`;
      await this.header(doc, tenantId, "Estimate", reference);
      this.partyAndMeta(
        doc,
        {
          name: estimate.customerName,
          lines: estimate.equipmentName ? [`Equipment: ${estimate.equipmentName}`] : [],
        },
        [
          { label: "Issue date", value: fmtDate(estimate.createdAt) },
          { label: "Valid until", value: fmtDate(estimate.validUntil) },
          { label: "Reference", value: estimate.requestRef || "—" },
        ],
      );
      this.drawLines(doc, estimate.lineItems);
      this.totals(doc, [
        { label: "Subtotal", value: money(estimate.subtotal) },
        ...(Number(estimate.discount) > 0 ? [{ label: "Discount", value: `-${money(estimate.discount)}` }] : []),
        { label: "Tax", value: money(estimate.tax) },
        { label: "Total", value: money(estimate.total), emphasis: true },
      ]);
      if (estimate.terms) {
        doc.fillColor(LABEL).font("Helvetica-Bold").fontSize(8).text("TERMS & CONDITIONS");
        doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(estimate.terms, { width: WIDTH });
        doc.moveDown();
      }
      this.signatures(doc, company);
      kindLabel = "Estimate";
    } else if (kind === "invoice") {
      const invoice = await prisma.invoice.findFirst({
        where: { id: entityId, tenantId },
        include: { lineItems: true, payments: true },
      });
      if (!invoice) throw new AppError("Invoice not found", 404);
      reference = invoice.reference;
      filename = `${reference}.pdf`;
      invoiceId = invoice.id;
      await this.header(doc, tenantId, "Invoice", reference);
      this.partyAndMeta(
        doc,
        { name: invoice.customerName },
        [
          { label: "Issue date", value: fmtDate(invoice.issuedAt) },
          { label: "Due date", value: fmtDate(invoice.dueAt) },
          { label: "Job", value: invoice.jobRef || "—" },
        ],
      );
      this.drawGroupedLines(doc, invoice.lineItems);
      const groupTotals = BILLING_CHARGE_GROUPS.map((group) => ({
        label: group.label,
        value: money(
          invoice.lineItems
            .filter((line) => chargeGroupForType(line.type).key === group.key)
            .reduce((sum, line) => sum + lineAmount({
              type: line.type,
              quantity: Number(line.quantity),
              unitPrice: Number(line.unitPrice),
              discount: Number(line.discount),
              taxRate: Number(line.taxRate),
              lineTotal: Number(line.lineTotal),
            }), 0),
        ),
        amount: invoice.lineItems
          .filter((line) => chargeGroupForType(line.type).key === group.key)
          .reduce((sum, line) => sum + Number(line.lineTotal), 0),
      })).filter((row) => row.amount > 0);
      this.totals(doc, [
        ...groupTotals.map((row) => ({ label: row.label, value: row.value })),
        { label: "Final Amount", value: money(invoice.total), emphasis: true },
        { label: "Paid", value: money(invoice.paidTotal) },
        { label: "Balance", value: money(invoice.balanceDue) },
      ]);
      this.signatures(doc, company);
      kindLabel = "Invoice";
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
      doc.fillColor(INK).font("Helvetica-Bold").fontSize(12).text(job.equipmentName, LEFT, doc.y);
      doc.font("Helvetica").fontSize(9).fillColor(MUTED);
      doc.text(`Customer: ${job.customerName}`);
      doc.text(`Service type: ${job.type}`);
      doc.text(`Scheduled: ${fmtDate(job.scheduledFor)}`);
      doc.text(`Team: ${job.assignments.map((assignment) => assignment.user.name).join(", ") || job.engineer}`).moveDown();
      doc.fillColor(INK).font("Helvetica-Bold").text("Work performed").moveDown(0.4);
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
      kindLabel = "Service Report";
    }

    this.stampFooters(doc, company, kindLabel, reference);
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
