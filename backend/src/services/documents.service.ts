import PDFDocument from "pdfkit";
import { prisma } from "@/db/prisma";
import { AppError } from "@/middleware/errorHandler";
import { fileStorageService } from "@/services/fileStorage.service";
import { BILLING_CHARGE_GROUPS, chargeGroupForType } from "@/utils/invoiceCharges";

type DocumentKind = "estimate" | "invoice" | "service-report" | "inspection-report";

const INK = "#0f172a";
const MUTED = "#64748b";
const LABEL = "#94a3b8";
const RULE = "#e2e8f0";
const RULE_STRONG = "#cbd5e1";
const ACCENT = "#1657a8";
const LEFT = 50;
const RIGHT = 545;
const WIDTH = RIGHT - LEFT;
const PAGE_BOTTOM = 730;

function money(value: unknown) {
  return `Rs. ${Number(value ?? 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function qtyMoney(value: unknown) {
  return Number(value ?? 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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

function fmtDateTime(value: Date) {
  return value.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const WORK_DETAILS_MARKER = "\n\nWork details:\n";

function splitInspectionFindings(raw: string) {
  const idx = raw.indexOf(WORK_DETAILS_MARKER);
  if (idx >= 0) {
    return {
      findings: raw.slice(0, idx).trim(),
      workDetails: raw.slice(idx + WORK_DETAILS_MARKER.length).trim(),
    };
  }
  return { findings: raw.trim(), workDetails: "" };
}

function displayValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export class DocumentsService {
  private async resolveReporterName(tenantId: string, reportedBy: string): Promise<string> {
    const value = displayValue(reportedBy);
    if (!value) return "";
    const user = await prisma.user.findFirst({
      where: { tenantId, id: value },
      select: { name: true },
    });
    return user?.name?.trim() || value;
  }

  private async header(
    doc: PDFKit.PDFDocument,
    tenantId: string,
    title: string,
    reference: string,
    meta?: Array<{ label: string; value: string }>,
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
        doc.image(buffer, LEFT, 48, { fit: [48, 48] });
        logoDrawn = true;
      } catch {
        // Keep the document valid if an old logo file is unavailable.
      }
    }

    const headerTop = 48;
    const textX = logoDrawn ? LEFT + 60 : LEFT;
    const name = tenant?.name ?? "MESMS";
    const contactLines = [
      displayValue(settings?.companyAddress),
      settings?.companyPhone ? `Mob: ${settings.companyPhone}` : "",
      displayValue(settings?.supportEmail),
      displayValue(settings?.companyWebsite),
    ].filter(Boolean);

    doc.fillColor(INK).font("Helvetica-Bold").fontSize(13).text(name.toUpperCase(), textX, headerTop, {
      width: 260,
    });
    let contactY = headerTop + 18;
    doc.font("Helvetica").fontSize(9).fillColor(MUTED);
    for (const line of contactLines) {
      doc.text(line, textX, contactY, { width: 260, lineBreak: false });
      contactY += 12;
    }
    if (!contactLines.length && settings?.supportEmail) {
      doc.text(settings.supportEmail, textX, contactY, { width: 260, lineBreak: false });
      contactY += 12;
    }

    const metaRows = meta?.length
      ? meta
      : [
          { label: `${title} No`, value: reference },
        ];

    const titleX = 300;
    const titleWidth = RIGHT - titleX;
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(16).text(title.toUpperCase(), titleX, headerTop, {
      width: titleWidth,
      align: "right",
    });
    let metaY = Math.max(headerTop + 26, doc.y + 4);
    for (const row of metaRows) {
      doc.fillColor(INK).font("Helvetica-Bold").fontSize(9).text(`${row.label}:`, 360, metaY, {
        width: 78,
        lineBreak: false,
      });
      doc.font("Helvetica").fontSize(9).text(row.value, 438, metaY, {
        width: RIGHT - 438,
        align: "right",
        lineBreak: false,
      });
      metaY += 14;
    }

    const ruleY = Math.max(contactY, metaY) + 10;
    doc.moveTo(LEFT, ruleY).lineTo(RIGHT, ruleY).lineWidth(1).strokeColor(RULE).stroke();
    doc.lineWidth(1);
    doc.y = ruleY + 14;
  }

  private partyAndMeta(
    doc: PDFKit.PDFDocument,
    billTo: { name: string; lines?: string[] },
    meta: Array<{ label: string; value: string }>,
    options?: { detailsHeading?: string },
  ) {
    const top = doc.y;
    const midX = LEFT + WIDTH / 2;
    const colW = WIDTH / 2 - 12;

    doc.fillColor(INK).font("Helvetica-Bold").fontSize(9).text("BILL TO", LEFT, top);
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(11).text(billTo.name, LEFT, top + 14, {
      width: colW,
    });
    doc.font("Helvetica").fontSize(9).fillColor(MUTED);
    let ly = top + 30;
    for (const line of billTo.lines ?? []) {
      doc.text(line, LEFT, ly, { width: colW });
      ly += 12;
    }

    const detailsHeading = (options?.detailsHeading ?? "PROJECT DETAILS").toUpperCase();
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(9).text(detailsHeading, midX + 12, top);
    let my = top + 14;
    for (const row of meta) {
      doc.fillColor(INK).font("Helvetica-Bold").fontSize(9).text(`${row.label}:`, midX + 12, my, {
        width: 72,
        lineBreak: false,
      });
      doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(row.value, midX + 84, my, {
        width: colW - 72,
      });
      my += 14;
    }

    const bottom = Math.max(ly, my) + 10;
    doc.moveTo(midX, top - 2).lineTo(midX, bottom).strokeColor(RULE).stroke();
    doc.moveTo(LEFT, bottom).lineTo(RIGHT, bottom).strokeColor(RULE).stroke();
    doc.y = bottom + 16;
  }

  private drawTableHeader(doc: PDFKit.PDFDocument, y: number) {
    doc.rect(LEFT, y, WIDTH, 22).strokeColor(RULE).stroke();
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(8);
    doc.text("Sl. No.", LEFT + 4, y + 7, { width: 36, align: "center" });
    doc.text("Description", LEFT + 44, y + 7, { width: 178 });
    doc.text("Price", 286, y + 7, { width: 68, align: "right" });
    doc.text("Discount", 358, y + 7, { width: 62, align: "right" });
    doc.text("Qty", 424, y + 7, { width: 36, align: "center" });
    doc.text("Amount", 464, y + 7, { width: 73, align: "right" });
    const cols = [LEFT + 40, LEFT + 230, 354, 422, 460];
    for (const x of cols) {
      doc.moveTo(x, y).lineTo(x, y + 22).strokeColor(RULE).stroke();
    }
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
      discount?: unknown;
    }>,
  ) {
    let y = this.drawTableHeader(doc, doc.y);

    lines.forEach((line, index) => {
      const desc = line.description || "—";
      doc.font("Helvetica").fontSize(9);
      const descH = doc.heightOfString(desc, { width: 178 });
      const rowH = Math.max(26, descH + 12);
      if (y + rowH > PAGE_BOTTOM) {
        doc.addPage();
        y = this.drawTableHeader(doc, 48);
      }
      doc.rect(LEFT, y, WIDTH, rowH).strokeColor(RULE).stroke();
      const cols = [LEFT + 40, LEFT + 230, 354, 422, 460];
      for (const x of cols) {
        doc.moveTo(x, y).lineTo(x, y + rowH).strokeColor(RULE).stroke();
      }
      doc.fillColor(INK).font("Helvetica").fontSize(9).text(String(index + 1), LEFT + 4, y + 8, {
        width: 36,
        align: "center",
      });
      doc.text(desc, LEFT + 44, y + 8, { width: 178 });
      const net = Math.max(
        0,
        Number(line.quantity ?? 0) * Number(line.unitPrice ?? 0) - Number(line.discount ?? 0),
      );
      doc.text(money(line.unitPrice), 286, y + 8, { width: 68, align: "right" });
      doc.text(money(line.discount ?? 0), 358, y + 8, { width: 62, align: "right" });
      doc.text(qtyMoney(line.quantity), 424, y + 8, { width: 36, align: "center" });
      doc.font("Helvetica-Bold").text(money(net), 464, y + 8, {
        width: 73,
        align: "right",
      });
      y += rowH;
    });

    doc.y = y + 16;
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
      doc.rect(LEFT, y, WIDTH, 20).strokeColor(RULE).stroke();
      doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(8).text(group.label.toUpperCase(), LEFT + 8, y + 6, {
        width: WIDTH - 16,
      });
      y += 20;
      for (const line of group.lines) {
        index += 1;
        const desc = line.description || "—";
        doc.font("Helvetica").fontSize(9);
        const descH = doc.heightOfString(desc, { width: 178 });
        const rowH = Math.max(26, descH + 12);
        if (y + rowH > PAGE_BOTTOM) {
          doc.addPage();
          y = this.drawTableHeader(doc, 48);
        }
        doc.rect(LEFT, y, WIDTH, rowH).strokeColor(RULE).stroke();
        const cols = [LEFT + 40, LEFT + 230, 354, 422, 460];
        for (const x of cols) {
          doc.moveTo(x, y).lineTo(x, y + rowH).strokeColor(RULE).stroke();
        }
        const net = Math.max(
          0,
          Number(line.quantity ?? 0) * Number(line.unitPrice ?? 0) - Number(line.discount ?? 0),
        );
        doc.fillColor(INK).font("Helvetica").fontSize(9).text(String(index), LEFT + 4, y + 8, {
          width: 36,
          align: "center",
        });
        doc.text(desc, LEFT + 44, y + 8, { width: 178 });
        doc.text(money(line.unitPrice), 286, y + 8, { width: 68, align: "right" });
        doc.text(money(line.discount ?? 0), 358, y + 8, { width: 62, align: "right" });
        doc.text(qtyMoney(line.quantity), 424, y + 8, { width: 36, align: "center" });
        doc.font("Helvetica-Bold").text(money(net), 464, y + 8, {
          width: 73,
          align: "right",
        });
        y += rowH;
      }
    }

    doc.y = y + 16;
    doc.fillColor(INK);
  }

  private totals(
    doc: PDFKit.PDFDocument,
    rows: Array<{ label: string; value: string; emphasis?: boolean }>,
  ) {
    const boxW = 230;
    const x = RIGHT - boxW;
    let y = doc.y;
    const boxTop = y;
    let contentH = 12;
    for (const row of rows) {
      contentH += row.emphasis ? 26 : 16;
    }
    doc.rect(x, boxTop, boxW, contentH).strokeColor(RULE).stroke();
    y = boxTop + 10;
    for (const row of rows) {
      if (row.emphasis) {
        y += 2;
        doc.moveTo(x + 10, y).lineTo(RIGHT - 10, y).strokeColor(RULE).stroke();
        y += 8;
        doc.fillColor(INK).font("Helvetica-Bold").fontSize(11);
        doc.text(row.label, x + 12, y, { width: 90 });
        doc.fontSize(12).text(row.value, x + 100, y - 1, { width: boxW - 112, align: "right" });
        y += 18;
      } else {
        doc.fillColor(INK).font("Helvetica").fontSize(9).text(row.label, x + 12, y, { width: 90 });
        doc.text(row.value, x + 100, y, { width: boxW - 112, align: "right" });
        y += 16;
      }
    }
    doc.y = boxTop + contentH + 12;
  }

  private stampFooters(doc: PDFKit.PDFDocument, company: string, kindLabel: string, reference: string) {
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i += 1) {
      doc.switchToPage(range.start + i);
      // PDFKit auto-adds a page when text is drawn past margin.bottom. The footer
      // lives in that margin, so drop it for the stamp or two blank pages appear.
      const bottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
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
      doc.page.margins.bottom = bottomMargin;
    }
  }

  private signatures(doc: PDFKit.PDFDocument, company: string) {
    const blockHeight = 76;
    this.ensureSpace(doc, blockHeight);
    const startY = doc.y + 6;
    const colGap = 40;
    const colW = (WIDTH - colGap) / 2;
    const rightX = LEFT + colW + colGap;
    const lineY = startY + 48;

    doc.fillColor(LABEL).font("Helvetica-Bold").fontSize(8);
    doc.text("AUTHORIZED SIGNATURE", LEFT, startY, { width: colW, lineBreak: false });
    doc.text("CUSTOMER ACKNOWLEDGEMENT", rightX, startY, { width: colW, lineBreak: false });

    doc.strokeColor(RULE_STRONG).lineWidth(0.75);
    doc.moveTo(LEFT, lineY).lineTo(LEFT + colW, lineY).stroke();
    doc.moveTo(rightX, lineY).lineTo(rightX + colW, lineY).stroke();

    doc.fillColor(MUTED).font("Helvetica").fontSize(9);
    doc.text(company, LEFT, lineY + 6, { width: colW, lineBreak: false });
    doc.text("Customer Signature", rightX, lineY + 6, { width: colW, lineBreak: false });

    doc.y = lineY + 24;
  }

  private inspectionSignatures(doc: PDFKit.PDFDocument, inspectorName: string, company: string) {
    const blockHeight = 76;
    this.ensureSpace(doc, blockHeight);
    const startY = doc.y + 6;
    const colGap = 40;
    const colW = (WIDTH - colGap) / 2;
    const rightX = LEFT + colW + colGap;
    const lineY = startY + 48;

    doc.fillColor(LABEL).font("Helvetica-Bold").fontSize(8);
    doc.text("INSPECTOR SIGNATURE", LEFT, startY, { width: colW, lineBreak: false });
    doc.text("APPROVAL SIGNATURE", rightX, startY, { width: colW, lineBreak: false });

    doc.strokeColor(RULE_STRONG).lineWidth(0.75);
    doc.moveTo(LEFT, lineY).lineTo(LEFT + colW, lineY).stroke();
    doc.moveTo(rightX, lineY).lineTo(rightX + colW, lineY).stroke();

    doc.fillColor(MUTED).font("Helvetica").fontSize(9);
    doc.text(inspectorName, LEFT, lineY + 6, { width: colW, lineBreak: false });
    doc.text(company, rightX, lineY + 6, { width: colW, lineBreak: false });

    doc.y = lineY + 24;
  }

  private ensureSpace(doc: PDFKit.PDFDocument, needed = 40) {
    if (doc.y + needed > PAGE_BOTTOM) doc.addPage();
  }

  private sectionHeading(doc: PDFKit.PDFDocument, title: string) {
    this.ensureSpace(doc, 36);
    doc.x = LEFT;
    doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(9).text(title.toUpperCase(), LEFT, doc.y, {
      width: WIDTH,
    });
    doc.x = LEFT;
    doc.moveDown(0.3);
    doc.moveTo(LEFT, doc.y).lineTo(RIGHT, doc.y).lineWidth(0.5).strokeColor(RULE).stroke();
    doc.moveDown(0.6);
    doc.x = LEFT;
    doc.fillColor(INK);
  }

  private keyValueRows(
    doc: PDFKit.PDFDocument,
    rows: Array<{ label: string; value: string }>,
    columns = 2,
  ) {
    const colW = WIDTH / columns;
    let col = 0;
    let rowY = doc.y;
    for (const row of rows) {
      if (col === 0) {
        this.ensureSpace(doc, 28);
        rowY = doc.y;
      }
      const x = LEFT + col * colW;
      doc.fillColor(LABEL).font("Helvetica-Bold").fontSize(7.5).text(row.label.toUpperCase(), x, rowY, {
        width: colW - 12,
      });
      doc.fillColor(INK).font("Helvetica").fontSize(9).text(row.value, x, rowY + 11, {
        width: colW - 12,
      });
      col += 1;
      if (col >= columns) {
        col = 0;
        doc.y = rowY + 30;
      }
    }
    if (col !== 0) doc.y = rowY + 30;
    doc.moveDown(0.4);
  }

  private bodyParagraph(doc: PDFKit.PDFDocument, text: string) {
    this.ensureSpace(doc, 24);
    doc.x = LEFT;
    doc.fillColor(INK).font("Helvetica").fontSize(9).text(text || " ", LEFT, doc.y, {
      width: WIDTH,
      align: "left",
    });
    doc.x = LEFT;
    doc.moveDown(0.5);
  }

  private severityBanner(doc: PDFKit.PDFDocument, severity: string) {
    this.ensureSpace(doc, 34);
    const colors: Record<string, string> = {
      low: "#64748b",
      medium: "#1657a8",
      high: "#d97706",
      critical: "#dc2626",
    };
    const color = colors[severity.toLowerCase()] ?? INK;
    doc.save();
    doc.rect(LEFT, doc.y, WIDTH, 24).fill("#f8fafc");
    doc.restore();
    doc.fillColor(color).font("Helvetica-Bold").fontSize(12).text(
      severity.toUpperCase(),
      LEFT + 10,
      doc.y + 7,
      { width: WIDTH - 20 },
    );
    doc.y += 30;
    doc.fillColor(INK);
  }

  private async drawInspectionPhotos(
    doc: PDFKit.PDFDocument,
    tenantId: string,
    actorId: string,
    actorRole: string,
    attachments: Array<{ fileId: string; caption?: string | null; file?: { originalName: string } }>,
  ) {
    if (!attachments.length) return;

    const perRow = 2;
    const gap = 14;
    const cellW = (WIDTH - gap * (perRow - 1)) / perRow;
    const imgH = 120;
    const captionArea = 28;
    const rowGap = 12;

    for (let i = 0; i < attachments.length; i += perRow) {
      const batch = attachments.slice(i, i + perRow);
      const rowHeight = imgH + captionArea + rowGap;
      this.ensureSpace(doc, rowHeight);
      const rowY = doc.y;

      for (let col = 0; col < batch.length; col += 1) {
        const att = batch[col];
        const x = LEFT + col * (cellW + gap);

        doc.save();
        doc.rect(x, rowY, cellW, imgH).strokeColor(RULE).lineWidth(0.5).stroke();
        doc.restore();

        const padding = 5;
        try {
          const { buffer } = await fileStorageService.download(tenantId, att.fileId, actorId, actorRole);
          doc.image(buffer, x + padding, rowY + padding, {
            fit: [cellW - padding * 2, imgH - padding * 2],
            align: "center",
            valign: "center",
          });
        } catch {
          doc.fillColor(MUTED).font("Helvetica").fontSize(8).text("Image unavailable", x, rowY + imgH / 2 - 4, {
            width: cellW,
            align: "center",
            lineBreak: false,
          });
        }

        const caption = att.caption?.trim() || att.file?.originalName || "";
        doc.fillColor(LABEL).font("Helvetica-Bold").fontSize(6.5).text("COMMENT", x, rowY + imgH + 4, {
          width: cellW,
          align: "left",
          lineBreak: false,
        });
        doc.fillColor(MUTED).font("Helvetica").fontSize(7.5).text(caption || "No comment provided", x, rowY + imgH + 13, {
          width: cellW,
          align: "left",
          lineGap: 0,
        });
      }

      doc.y = rowY + rowHeight;
    }

    doc.moveDown(0.2);
    doc.fillColor(INK);
  }

  private renderJsonFields(doc: PDFKit.PDFDocument, label: string, value: unknown) {
    if (!value || (typeof value === "object" && !Array.isArray(value) && !Object.keys(value as object).length)) {
      return;
    }
    this.sectionHeading(doc, label);
    if (Array.isArray(value)) {
      for (const item of value) {
        this.bodyParagraph(doc, typeof item === "string" ? item : JSON.stringify(item));
      }
      return;
    }
    if (typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>);
      this.keyValueRows(
        doc,
        entries.map(([key, val]) => ({
          label: key.replace(/_/g, " "),
          value: displayValue(val),
        })),
      );
      return;
    }
    this.bodyParagraph(doc, displayValue(value));
  }

  async generate(tenantId: string, actorId: string, kind: DocumentKind, entityId: string, actorRole = "admin") {
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
        include: { lineItems: true, customer: true },
      });
      if (!estimate) throw new AppError("Estimate not found", 404);
      reference = estimate.reference;
      filename = `${reference}.pdf`;
      const customer = estimate.customer;
      const billLines = [
        [customer?.address, customer?.city, customer?.country].filter(Boolean).join(", "),
        customer?.phone || "",
        customer?.email || "",
      ].filter(Boolean);
      await this.header(doc, tenantId, "Estimate", reference, [
        { label: "Estimate No", value: reference },
        { label: "Date", value: fmtDate(estimate.createdAt) },
        { label: "Project code", value: estimate.requestRef || "—" },
      ]);
      this.partyAndMeta(
        doc,
        {
          name: estimate.customerName,
          lines: billLines,
        },
        [
          ...(estimate.equipmentName ? [{ label: "Equipment", value: estimate.equipmentName }] : []),
          { label: "Valid until", value: fmtDate(estimate.validUntil) },
          { label: "Status", value: estimate.status },
        ],
        { detailsHeading: "PROJECT DETAILS" },
      );
      this.drawLines(doc, estimate.lineItems);
      const taxRates = [...new Set(estimate.lineItems.map((line) => Number(line.taxRate ?? 0)))];
      const taxLabel = taxRates.length === 1 && taxRates[0] > 0 ? `GST (${taxRates[0]}%)` : "Tax";
      this.totals(doc, [
        { label: "Subtotal", value: money(estimate.subtotal) },
        ...(Number(estimate.discount) > 0 ? [{ label: "Discount", value: `-${money(estimate.discount)}` }] : []),
        { label: taxLabel, value: money(estimate.tax) },
        { label: "Grand Total", value: money(estimate.total), emphasis: true },
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
        include: {
          lineItems: true,
          payments: true,
          customer: true,
          salesOrder: true,
          job: { include: { equipment: true, serviceRequest: true } },
        },
      });
      if (!invoice) throw new AppError("Invoice not found", 404);
      reference = invoice.reference;
      filename = `${reference}.pdf`;
      invoiceId = invoice.id;
      const isSale = Boolean(invoice.salesOrderId);
      const customer = invoice.customer;
      const billLines = [
        [customer?.address, customer?.city, customer?.country].filter(Boolean).join(", "),
        customer?.phone || "",
        customer?.email || "",
      ].filter(Boolean);
      const codeLabel = isSale ? "Sale code" : "Project code";
      await this.header(doc, tenantId, "Invoice", reference, [
        { label: "Invoice No", value: reference },
        { label: "Date", value: fmtDate(invoice.issuedAt) },
        { label: codeLabel, value: invoice.jobRef || "—" },
      ]);
      const detailRows = isSale
        ? [
            { label: "Sale", value: invoice.salesOrder?.reference || invoice.jobRef || "—" },
            { label: "Status", value: invoice.status },
            { label: "Due date", value: fmtDate(invoice.dueAt) },
          ]
        : [
            ...(invoice.job?.equipmentName
              ? [{ label: "Equipment", value: invoice.job.equipmentName }]
              : []),
            ...(invoice.job?.equipment?.location
              ? [{ label: "Location", value: invoice.job.equipment.location }]
              : []),
            { label: "Job", value: invoice.jobRef || "—" },
            { label: "Status", value: invoice.status },
          ];
      this.partyAndMeta(
        doc,
        { name: invoice.customerName, lines: billLines },
        detailRows,
        { detailsHeading: isSale ? "SALE DETAILS" : "PROJECT DETAILS" },
      );
      this.drawGroupedLines(doc, invoice.lineItems);
      const taxRates = [...new Set(invoice.lineItems.map((line) => Number(line.taxRate ?? 0)))];
      const taxLabel = taxRates.length === 1 && taxRates[0] > 0 ? `GST (${taxRates[0]}%)` : "Tax";
      this.totals(doc, [
        { label: "Subtotal", value: money(invoice.amount) },
        { label: taxLabel, value: money(invoice.tax) },
        { label: "Grand Total", value: money(invoice.total), emphasis: true },
        ...(Number(invoice.paidTotal) > 0
          ? [
              { label: "Paid", value: money(invoice.paidTotal) },
              { label: "Balance", value: money(invoice.balanceDue) },
            ]
          : []),
      ]);
      kindLabel = "Invoice";
    } else if (kind === "service-report") {
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
    } else if (kind === "inspection-report") {
      const sr = await prisma.serviceRequest.findFirst({
        where: { id: entityId, tenantId },
        include: {
          customer: true,
          equipment: true,
          equipmentItems: true,
          inspectionReport: {
            include: {
              recommendations: true,
              attachments: { include: { file: true } },
            },
          },
        },
      });
      if (!sr) throw new AppError("Service ticket not found", 404);
      const report = sr.inspectionReport;
      if (!report) throw new AppError("Inspection report not found", 404);

      reference = sr.reference;
      filename = `${reference}-inspection-report.pdf`;
      const reportStatus = report.submittedAt ? "Submitted" : "Draft";
      const split = splitInspectionFindings(report.findings);
      const customer = sr.customer;
      const siteAddress = [customer?.address, customer?.city, customer?.country].filter(Boolean).join(", ");
      const inspectorName = await this.resolveReporterName(tenantId, report.reportedBy);

      await this.header(doc, tenantId, "Inspection Report", reference);
      this.keyValueRows(doc, [
        { label: "Severity", value: report.severity.toUpperCase() },
        { label: "Inspection date", value: fmtDateTime(report.reportedAt) },
        { label: "Inspector", value: inspectorName },
        { label: "Status", value: reportStatus },
      ]);

      this.sectionHeading(doc, "Customer");
      this.keyValueRows(doc, [
        { label: "Name", value: displayValue(customer?.name ?? sr.customerName) },
        { label: "Phone", value: displayValue(customer?.phone) },
        { label: "Email", value: displayValue(customer?.email) },
        { label: "Site address", value: displayValue(siteAddress) },
      ]);

      this.sectionHeading(doc, "Equipment");
      const equipmentRows: Array<{ label: string; value: string }> = [];
      if (sr.equipment) {
        const eq = sr.equipment;
        equipmentRows.push(
          { label: "Equipment", value: displayValue(eq.name) },
          {
            label: "Brand / Model",
            value: [displayValue(eq.manufacturer), displayValue(eq.model)].filter(Boolean).join(" · "),
          },
          { label: "Serial no.", value: displayValue(eq.serialNumber) },
          { label: "Asset ID", value: displayValue(eq.assetTag) },
          { label: "Location", value: displayValue(eq.location) },
          { label: "Condition", value: displayValue(report.machineCondition ?? eq.condition) },
        );
      } else if (sr.equipmentItems.length) {
        for (const item of sr.equipmentItems) {
          equipmentRows.push(
            { label: "Equipment", value: displayValue(item.equipmentName) },
            { label: "Asset ID", value: displayValue(item.assetTag) },
          );
        }
      } else {
        equipmentRows.push(
          { label: "Equipment", value: displayValue(sr.equipmentName) },
          { label: "Condition", value: displayValue(report.machineCondition) },
        );
      }
      this.keyValueRows(doc, equipmentRows);

      this.sectionHeading(doc, "Inspection Findings");
      this.bodyParagraph(doc, split.findings);

      if (split.workDetails) {
        this.sectionHeading(doc, "Work Required");
        this.bodyParagraph(doc, split.workDetails);
      }

      this.sectionHeading(doc, "Recommendations");
      this.bodyParagraph(doc, report.recommendation);
      if (report.recommendations.length) {
        this.ensureSpace(doc, 30);
        doc.fillColor(LABEL).font("Helvetica-Bold").fontSize(8);
        doc.text("RECOMMENDED PARTS & WORK", LEFT, doc.y);
        doc.moveDown(0.5);
        for (const item of report.recommendations) {
          this.ensureSpace(doc, 20);
          doc.fillColor(INK).font("Helvetica-Bold").fontSize(9).text(
            `${item.title} · Qty ${Number(item.quantity)} · ${item.priority}`,
          );
          if (item.description) {
            doc.font("Helvetica").fontSize(8.5).fillColor(MUTED).text(item.description);
          }
          doc.moveDown(0.4);
        }
        doc.fillColor(INK);
      }

      this.renderJsonFields(doc, "Checklist", report.checklist);
      this.renderJsonFields(doc, "Measurements", report.measurements);
      this.renderJsonFields(doc, "Error codes", report.errorCodes);
      if (report.calibrationStatus) {
        this.sectionHeading(doc, "Calibration");
        this.bodyParagraph(doc, report.calibrationStatus);
      }

      if (report.attachments.length) {
        const photoBlockHeight = Math.ceil(report.attachments.length / 2) * (120 + 28 + 12) + 24;
        this.ensureSpace(doc, Math.min(photoBlockHeight, 140));
        this.sectionHeading(doc, "Inspection Photos");
        await this.drawInspectionPhotos(doc, tenantId, actorId, actorRole, report.attachments);
      }

      if (report.technicianRemarks) {
        this.sectionHeading(doc, "Remarks");
        this.bodyParagraph(doc, report.technicianRemarks);
      }

      this.inspectionSignatures(doc, inspectorName, company);
      kindLabel = "Inspection Report";
    } else {
      throw new AppError("Unsupported document kind", 400);
    }

    if (kind !== "invoice") {
      this.stampFooters(doc, company, kindLabel, reference);
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
