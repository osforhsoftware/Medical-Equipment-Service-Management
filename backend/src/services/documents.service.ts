import PDFDocument from "pdfkit";
import { prisma } from "@/db/prisma";
import { AppError } from "@/middleware/errorHandler";
import { fileStorageService } from "@/services/fileStorage.service";
import { BILLING_CHARGE_GROUPS, chargeGroupForType } from "@/utils/invoiceCharges";
import { normalizeAdditionalFields } from "@/lib/additionalFields";
import { formatInventoryItemClass } from "@/lib/inventoryItemClass";
import { parseJobStageDetails } from "@/lib/jobStageDetails";
import { calculateEstimateTotals, estimateLevelDiscount } from "@/lib/estimateTotals";

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

const WORK_REC_MARKER = "\n\nRecommendation:\n";
const AUTO_WORK_LOG_PREFIXES = [
  "Field work started",
  "Work paused — parts pending",
  "Work paused — awaiting review",
  "Job completed",
  "Customer sign-off captured",
];

function splitWorkRecommendation(raw: string | null | undefined) {
  const text = raw ?? "";
  const idx = text.indexOf(WORK_REC_MARKER);
  if (idx >= 0) {
    return {
      calibrationResult: text.slice(0, idx).trim(),
      recommendation: text.slice(idx + WORK_REC_MARKER.length).trim(),
    };
  }
  if (text.startsWith("Recommendation:\n")) {
    return { calibrationResult: "", recommendation: text.slice("Recommendation:\n".length).trim() };
  }
  return { calibrationResult: text.trim(), recommendation: "" };
}

function isNarrativeWorkLog(workPerformed: string) {
  const text = workPerformed.trim();
  return !AUTO_WORK_LOG_PREFIXES.some((prefix) => text === prefix || text.startsWith(`${prefix}\n`));
}

function displayValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function reportText(value: unknown) {
  const text = displayValue(value);
  if (!text) return "";
  if (text.toLowerCase() === "nil") return "";
  if (text === "—" || text === "–" || text === "-" || text === "---") return "";
  return text;
}

function formatReportQty(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return reportText(value);
  return Number.isInteger(amount) ? String(amount) : String(amount);
}

function sparePartLabel(item: {
  description?: string | null;
  inventoryItem?: { name?: string | null } | null;
  catalogItem?: { name?: string | null } | null;
}) {
  const linked = reportText(item.inventoryItem?.name) || reportText(item.catalogItem?.name);
  if (linked) return linked;
  const description = reportText(item.description);
  if (!description) return "";
  return reportText(description.replace(/^recommended (spare part|service):\s*/i, ""));
}

function sparePartNote(item: {
  description?: string | null;
  inventoryItem?: { name?: string | null } | null;
  catalogItem?: { name?: string | null } | null;
}) {
  const description = reportText(item.description);
  if (!description) return "";
  const spare = sparePartLabel(item);
  if (spare && description.toLowerCase() === spare.toLowerCase()) return "";
  return description;
}

function visibleJsonFields(value: unknown): Array<{ label: string; value: string }> {
  if (!value) return [];
  let rows: Array<{ label: string; value: string }> = [];
  if (Array.isArray(value)) {
    const allStrings = value.every((item) => typeof item === "string");
    rows = allStrings
      ? (value as string[]).map((item) => ({ label: "Code", value: item }))
      : value.map((item, index) => ({
          label: `Item ${index + 1}`,
          value: typeof item === "string" ? item : JSON.stringify(item),
        }));
  } else if (typeof value === "object") {
    rows = Object.entries(value as Record<string, unknown>).map(([key, val]) => ({
      label: key.replace(/_/g, " "),
      value: displayValue(val),
    }));
  } else {
    rows = [{ label: "Value", value: displayValue(value) }];
  }
  return rows.flatMap((row) => {
    const text = reportText(row.value);
    return text ? [{ label: row.label, value: text }] : [];
  });
}

function visibleErrorCodes(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => reportText(typeof item === "string" ? item : displayValue(item)))
      .filter(Boolean);
  }
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).map((item) => reportText(item)).filter(Boolean);
  }
  const text = reportText(value);
  return text ? [text] : [];
}

function orDash(value: unknown) {
  return displayValue(value) || "—";
}

function prettyLabel(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function serviceTypeLabel(type: string, typeOther?: string | null) {
  if (type === "Other" && displayValue(typeOther)) return displayValue(typeOther);
  return type;
}

function customerFacingPersonName(value: unknown) {
  const text = displayValue(value);
  if (!text || /^system\s+administrator$/i.test(text)) return "";
  return text;
}

function equipmentIdentityRows(equipment: {
  serialNumber?: string | null;
  model?: string | null;
  manufacturer?: string | null;
  name?: string | null;
}) {
  return [
    { label: "SL", value: orDash(equipment.serialNumber) },
    { label: "Model", value: orDash(equipment.model) },
    { label: "Make", value: orDash(equipment.manufacturer) },
    { label: "Description", value: orDash(equipment.name) },
  ];
}

function isServiceChargeType(type: string | null | undefined) {
  return chargeGroupForType(String(type ?? "other")).key === "serviceCharges";
}

/** Drop capture time and date from a photo comment. Filenames are not used as comments. */
function stripDateTimeFromCaption(value: unknown) {
  const text = displayValue(value);
  if (!text) return "";
  const stripped = text
    .replace(
      /\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}(?:[tT\s,]+(?:at\s+)?\d{1,2}[:.]\d{2}(?:[:.]\d{2})?(?:\s*[ap]m)?)?/gi,
      " ",
    )
    .replace(
      /\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}(?:[\s,]+(?:at\s+)?\d{1,2}[:.]\d{2}(?:[:.]\d{2})?(?:\s*[ap]m)?)?/gi,
      " ",
    )
    .replace(
      /\b\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?,?\s+\d{2,4}(?:[\s,]+(?:at\s+)?\d{1,2}[:.]\d{2}(?:[:.]\d{2})?(?:\s*[ap]m)?)?/gi,
      " ",
    )
    .replace(
      /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+\d{2,4}(?:[\s,]+(?:at\s+)?\d{1,2}[:.]\d{2}(?:[:.]\d{2})?(?:\s*[ap]m)?)?/gi,
      " ",
    )
    .replace(/\b\d{1,2}[:.]\d{2}(?:[:.]\d{2})?\s*[ap]m\b/gi, " ")
    .replace(/\b(?:img|image|photo|pic|screenshot)[_\-\s]*\d{6,14}\b/gi, " ")
    .replace(/\.(?:jpe?g|png|webp|gif|heic)$/i, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s,.;:_-]+|[\s,.;:_-]+$/g, "")
    .trim();
  if (!stripped || /^(?:whatsapp image|img|image|photo|pic|screenshot|camera)$/i.test(stripped)) return "";
  return stripped;
}

export class DocumentsService {
  private async resolveReporterName(tenantId: string, reportedBy: string): Promise<string> {
    const value = displayValue(reportedBy);
    if (!value) return "";
    const user = await prisma.user.findFirst({
      where: { tenantId, id: value },
      select: { name: true },
    });
    return customerFacingPersonName(user?.name?.trim() || value);
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

  private stampFooters(
    doc: PDFKit.PDFDocument,
    company: string,
    kindLabel: string,
    reference: string,
    layout?: { left: number; right: number },
  ) {
    const left = layout?.left ?? LEFT;
    const right = layout?.right ?? RIGHT;
    const width = right - left;
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i += 1) {
      doc.switchToPage(range.start + i);
      // PDFKit auto-adds a page when text is drawn past margin.bottom. The footer
      // lives in that margin, so drop it for the stamp or two blank pages appear.
      const bottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      const y = doc.page.height - 40;
      doc.moveTo(left, y).lineTo(right, y).strokeColor(RULE).stroke();
      doc.fillColor(MUTED).font("Helvetica").fontSize(8);
      doc.text(`${company}  ·  ${kindLabel} ${reference}`, left, y + 8, {
        width: width / 2,
        lineBreak: false,
      });
      doc.text(`Page ${i + 1} of ${range.count}`, left + width / 2, y + 8, {
        width: width / 2,
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
    bounds?: { left: number; width: number; bottom: number },
  ) {
    if (!attachments.length) return;

    const left = bounds?.left ?? LEFT;
    const width = bounds?.width ?? WIDTH;
    const bottom = bounds?.bottom ?? PAGE_BOTTOM;
    const perRow = 2;
    const gap = 14;
    const cellW = (width - gap * (perRow - 1)) / perRow;
    const imgH = 120;
    const captionArea = 28;
    const rowGap = 12;

    for (let i = 0; i < attachments.length; i += perRow) {
      const batch = attachments.slice(i, i + perRow);
      const rowHeight = imgH + captionArea + rowGap;
      if (doc.y + rowHeight > bottom) doc.addPage();
      const rowY = doc.y;

      for (let col = 0; col < batch.length; col += 1) {
        const att = batch[col];
        const x = left + col * (cellW + gap);

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

        const caption = stripDateTimeFromCaption(att.caption);
        if (caption) {
          doc.fillColor(LABEL).font("Helvetica-Bold").fontSize(6.5).text("COMMENT", x, rowY + imgH + 4, {
            width: cellW,
            align: "left",
            lineBreak: false,
          });
          doc.fillColor(MUTED).font("Helvetica").fontSize(7.5).text(caption, x, rowY + imgH + 13, {
            width: cellW,
            align: "left",
            lineGap: 0,
          });
        }
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

  private drawUsageTable(
    doc: PDFKit.PDFDocument,
    rows: Array<{ item: string; sku: string; kind: string; taken: string; used: string }>,
    columns: { taken: string; used: string } = { taken: "TAKEN", used: "USED" },
  ) {
    const headers = [
      { label: "ITEM", x: LEFT + 6, w: 168 },
      { label: "SKU / PART NO.", x: LEFT + 178, w: 78 },
      { label: "TYPE", x: LEFT + 260, w: 72 },
      { label: columns.taken, x: LEFT + 336, w: 42 },
      { label: columns.used, x: LEFT + 382, w: 104 },
    ];
    const paintHeader = (y: number) => {
      doc.save();
      doc.rect(LEFT, y, WIDTH, 18).fill("#f1f5f9");
      doc.restore();
      doc.fillColor(LABEL).font("Helvetica-Bold").fontSize(7);
      for (const col of headers) {
        doc.text(col.label, col.x, y + 5, { width: col.w, lineBreak: false });
      }
      return y + 20;
    };

    this.ensureSpace(doc, 40);
    let y = paintHeader(doc.y);
    rows.forEach((row, index) => {
      const values = [row.item || "—", row.sku || "—", row.kind || "—", row.taken, row.used];
      doc.font("Helvetica").fontSize(8.5);
      const heights = headers.map((col, colIndex) =>
        doc.heightOfString(values[colIndex] || "—", { width: col.w - 4 }),
      );
      const rowH = Math.max(20, ...heights) + 8;
      if (y + rowH > PAGE_BOTTOM) {
        doc.addPage();
        y = paintHeader(56);
      }
      if (index % 2 === 1) {
        doc.save();
        doc.rect(LEFT, y - 1, WIDTH, rowH).fill("#f8fafc");
        doc.restore();
      }
      values.forEach((value, colIndex) => {
        const col = headers[colIndex];
        doc.fillColor(colIndex === 0 ? INK : MUTED).font("Helvetica").fontSize(8).text(value || "—", col.x, y + 4, {
          width: col.w - 4,
        });
      });
      y += rowH;
    });
    doc.moveTo(LEFT, y).lineTo(RIGHT, y).strokeColor(RULE).stroke();
    doc.y = y + 12;
    doc.x = LEFT;
    doc.fillColor(INK);
  }

  private async drawCustomerSignOff(
    doc: PDFKit.PDFDocument,
    tenantId: string,
    actorId: string,
    actorRole: string,
    signature: { customerName: string; capturedAt: Date; fileId: string | null; signatureData: string | null },
  ) {
    this.sectionHeading(doc, "Customer sign-off");
    this.keyValueRows(doc, [
      { label: "Signed by", value: signature.customerName },
      { label: "Sign-off date", value: fmtDateTime(signature.capturedAt) },
    ]);
    let buffer: Buffer | null = null;
    if (signature.fileId) {
      try {
        const downloaded = await fileStorageService.download(tenantId, signature.fileId, actorId, actorRole);
        buffer = downloaded.buffer;
      } catch {
        buffer = null;
      }
    } else if (signature.signatureData?.startsWith("data:")) {
      const match = /^data:[^;]+;base64,(.+)$/.exec(signature.signatureData);
      if (match) buffer = Buffer.from(match[1], "base64");
    }
    if (!buffer) return;
    this.ensureSpace(doc, 90);
    try {
      const imageY = doc.y;
      doc.image(buffer, LEFT, imageY, { fit: [180, 70] });
      doc.y = imageY + 78;
      doc.x = LEFT;
    } catch {
      // A stored signature that is not a valid image should not fail the report.
    }
  }

  private inspectionContentBottom(doc: PDFKit.PDFDocument) {
    return doc.page.height - doc.page.margins.bottom - 6;
  }

  private ensureInspectionSpace(doc: PDFKit.PDFDocument, needed: number) {
    if (doc.y + needed > this.inspectionContentBottom(doc)) doc.addPage();
  }

  private paintInspectionHeader(
    doc: PDFKit.PDFDocument,
    input: {
      top: number;
      left: number;
      right: number;
      width: number;
      company: string;
      lines: string[];
      reference: string;
      inspectionDate: string;
      logo: Buffer | null;
    },
  ) {
    const logoSize = 44;
    let textX = input.left;
    if (input.logo) {
      try {
        doc.image(input.logo, input.left, input.top, { fit: [logoSize, logoSize] });
        textX = input.left + logoSize + 10;
      } catch {
        textX = input.left;
      }
    }
    const textW = Math.max(80, input.right - textX);
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(14).text(input.company, textX, input.top, {
      width: textW,
    });
    let lineY = doc.y + 1;
    doc.font("Helvetica").fontSize(9).fillColor("#334155");
    for (const line of input.lines) {
      doc.text(line, textX, lineY, { width: textW });
      lineY = doc.y + 1;
    }
    let y = Math.max(input.top + (input.logo ? logoSize : 0), lineY) + 12;
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(12).text("INSPECTION REPORT", input.left, y, {
      width: input.width,
    });
    y = doc.y + 8;
    const meta = [
      { label: "Report No", value: input.reference },
      ...(input.inspectionDate ? [{ label: "Inspection Date", value: input.inspectionDate }] : []),
    ];
    doc.font("Helvetica").fontSize(9);
    const labelWidth = Math.max(...meta.map((row) => doc.widthOfString(row.label)), 0) + 14;
    for (const row of meta) {
      doc.fillColor("#64748b").font("Helvetica").fontSize(9).text(row.label, input.left, y, {
        width: labelWidth,
        lineBreak: false,
      });
      doc.fillColor(INK).font("Helvetica").fontSize(10).text(row.value, input.left + labelWidth, y, {
        width: input.width - labelWidth,
        align: "right",
        lineBreak: false,
      });
      y += 14;
    }
    y += 4;
    doc.moveTo(input.left, y).lineTo(input.right, y).lineWidth(1).strokeColor(RULE).stroke();
    doc.lineWidth(1);
    doc.fillColor(INK);
    return y + 12;
  }

  private paintInspectionHeading(doc: PDFKit.PDFDocument, left: number, width: number, title: string) {
    if (doc.y > doc.page.margins.top + 4) doc.y += 16;
    this.ensureInspectionSpace(doc, 22);
    const y = doc.y;
    doc.save();
    doc.rect(left, y + 1, 3, 11).fill(ACCENT);
    doc.restore();
    doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(9).text(title.toUpperCase(), left + 8, y, {
      width: width - 8,
      lineBreak: false,
    });
    doc.y = y + 18;
    doc.x = left;
    doc.fillColor(INK);
  }

  private paintInspectionFields(
    doc: PDFKit.PDFDocument,
    left: number,
    width: number,
    title: string,
    rows: Array<{ label: string; value: string }>,
  ) {
    const visible = rows.flatMap((row) => {
      const value = reportText(row.value);
      return value ? [{ label: row.label, value }] : [];
    });
    if (!visible.length) return;
    this.paintInspectionHeading(doc, left, width, title);
    const colW = width / 2;
    for (let index = 0; index < visible.length; index += 2) {
      const pair = visible.slice(index, index + 2);
      doc.font("Helvetica").fontSize(10);
      const rowH = Math.max(
        34,
        ...pair.map((item) => doc.heightOfString(item.value, { width: colW - 16 }) + 18),
      );
      this.ensureInspectionSpace(doc, rowH);
      const y = doc.y;
      pair.forEach((item, column) => {
        const x = left + column * colW;
        doc.fillColor("#64748b").font("Helvetica-Bold").fontSize(8).text(item.label.toUpperCase(), x, y, {
          width: colW - 16,
        });
        doc.fillColor(INK).font("Helvetica").fontSize(10).text(item.value, x, y + 12, {
          width: colW - 16,
        });
      });
      doc.y = y + rowH;
      doc.x = left;
    }
  }

  private paintInspectionParagraph(doc: PDFKit.PDFDocument, left: number, width: number, text: string, muted = false) {
    doc.font("Helvetica").fontSize(10);
    const height = doc.heightOfString(text, { width });
    const remaining = this.inspectionContentBottom(doc) - doc.y;
    if (height > remaining && remaining < 36) doc.addPage();
    doc.fillColor(muted ? "#94a3b8" : INK).font("Helvetica").fontSize(10).text(text, left, doc.y, { width });
    doc.x = left;
    doc.moveDown(0.3);
  }

  private paintInspectionNarrative(doc: PDFKit.PDFDocument, left: number, width: number, title: string, text: string) {
    this.paintInspectionHeading(doc, left, width, title);
    const value = reportText(text);
    this.paintInspectionParagraph(doc, left, width, value || "No findings recorded", !value);
  }

  private paintInspectionChip(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    label: string,
    colors: { bg: string; fg: string; border: string },
  ) {
    doc.font("Helvetica-Bold").fontSize(8);
    const w = doc.widthOfString(label) + 18;
    doc.roundedRect(x, y, w, 16, 8).lineWidth(0.6).fillAndStroke(colors.bg, colors.border);
    doc.fillColor(colors.fg).text(label, x + 9, y + 4, { lineBreak: false });
    return w;
  }

  private async drawStyledInspectionReport(
    doc: PDFKit.PDFDocument,
    input: {
      tenantId: string;
      actorId: string;
      actorRole: string;
      company: string;
      orgLines: string[];
      reference: string;
      inspectionDate: string;
      severity: string;
      completionLabel: string;
      reportStatus: string;
      inspectorName: string;
      logo: Buffer | null;
      clientRows: Array<{ label: string; value: string }>;
      equipmentRows: Array<{ label: string; value: string }>;
      findings: string;
      workDetails: string;
      recommendation: string;
      parts: Array<{
        id: string;
        title: string;
        description: string;
        priority: string;
        quantity: unknown;
        inventoryItem?: { name?: string | null } | null;
        catalogItem?: { name?: string | null } | null;
      }>;
      checklist: unknown;
      measurements: unknown;
      errorCodes: unknown;
      calibration: string;
      additionalFields: Array<{ label: string; value: string }>;
      attachments: Array<{ fileId: string; caption?: string | null; file?: { originalName: string } }>;
      remarks: string;
    },
  ) {
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const width = right - left;
    const originTop = doc.page.margins.top;
    let drawingHeader = false;
    const paintHeader = () => {
      if (drawingHeader) return;
      drawingHeader = true;
      const bottom = this.paintInspectionHeader(doc, {
        top: originTop,
        left,
        right,
        width,
        company: input.company,
        lines: input.orgLines,
        reference: input.reference,
        inspectionDate: input.inspectionDate,
        logo: input.logo,
      });
      doc.page.margins.top = bottom;
      doc.y = bottom;
      doc.x = left;
      drawingHeader = false;
    };
    const onPageAdded = () => paintHeader();
    doc.on("pageAdded", onPageAdded);
    paintHeader();

    const priorityColors = (severity: string) => {
      const value = severity.toLowerCase();
      if (value === "high" || value === "critical") return { bg: "#fef2f2", fg: "#b91c1c", border: "#fecaca" };
      if (value === "medium") return { bg: "#fffbeb", fg: "#b45309", border: "#fcd34d" };
      return { bg: "#f1f5f9", fg: "#475569", border: "#e2e8f0" };
    };
    const completionColors = input.completionLabel.toLowerCase() === "completed"
      ? { bg: "#f0fdf4", fg: "#15803d", border: "#bbf7d0" }
      : { bg: "#fffbeb", fg: "#b45309", border: "#fcd34d" };

    this.ensureInspectionSpace(doc, 52);
    const barY = doc.y;
    const barH = 42;
    doc.roundedRect(left, barY, width, barH, 4).lineWidth(0.8).strokeColor(RULE).stroke();
    let chipX = left + 10;
    const severity = reportText(input.severity);
    if (severity) {
      chipX += this.paintInspectionChip(doc, chipX, barY + 13, prettyLabel(severity), priorityColors(severity)) + 6;
    }
    this.paintInspectionChip(doc, chipX, barY + 13, input.completionLabel, completionColors);
    const pairs = [
      ...(reportText(input.inspectorName) ? [{ label: "INSPECTOR", value: input.inspectorName }] : []),
      { label: "REPORT STATUS", value: input.reportStatus },
    ];
    doc.font("Helvetica").fontSize(9);
    const pairWidths = pairs.map((pair) => Math.max(doc.font("Helvetica-Bold").fontSize(7).widthOfString(pair.label), doc.font("Helvetica").fontSize(9).widthOfString(pair.value)));
    let pairX = right - 10 - pairWidths.reduce((sum, item) => sum + item, 0) - Math.max(0, pairs.length - 1) * 16;
    pairs.forEach((pair, index) => {
      doc.fillColor("#64748b").font("Helvetica-Bold").fontSize(7).text(pair.label, pairX, barY + 10, {
        width: pairWidths[index],
        lineBreak: false,
      });
      doc.fillColor(INK).font("Helvetica").fontSize(9).text(pair.value, pairX, barY + 22, {
        width: pairWidths[index],
        lineBreak: false,
      });
      pairX += pairWidths[index] + 16;
    });
    doc.y = barY + barH + 4;
    doc.x = left;
    doc.fillColor(INK);

    this.paintInspectionFields(doc, left, width, "Client Details", input.clientRows);
    this.paintInspectionFields(doc, left, width, "Equipment", input.equipmentRows);
    this.paintInspectionNarrative(doc, left, width, "Inspection Findings", input.findings);
    if (reportText(input.workDetails)) {
      this.paintInspectionHeading(doc, left, width, "Work Required");
      this.paintInspectionParagraph(doc, left, width, reportText(input.workDetails));
    }
    this.paintInspectionNarrative(doc, left, width, "Recommendations", input.recommendation);

    if (input.parts.length) {
      this.paintInspectionHeading(doc, left, width, "Requested Parts & Services");
      const columns = [
        { label: "ITEM", w: width * 0.32 },
        { label: "QUANTITY", w: width * 0.14 },
        { label: "PRIORITY", w: width * 0.16 },
        { label: "RECOMMENDED SPARE PART", w: width * 0.38 },
      ];
      const paintTableHeader = () => {
        this.ensureInspectionSpace(doc, 22);
        const y = doc.y;
        doc.font("Helvetica-Bold").fontSize(7.5);
        let x = left;
        columns.forEach((column) => {
          doc.fillColor("#64748b").text(column.label, x + 4, y + 4, { width: column.w - 8, lineBreak: false });
          x += column.w;
        });
        doc.moveTo(left, y + 16).lineTo(right, y + 16).strokeColor(RULE).lineWidth(0.6).stroke();
        doc.y = y + 18;
        doc.x = left;
      };
      paintTableHeader();
      for (const item of input.parts) {
        const cells = [
          reportText(item.title) || sparePartLabel(item),
          formatReportQty(item.quantity),
          reportText(item.priority) ? prettyLabel(item.priority) : "",
          sparePartLabel(item),
        ];
        doc.font("Helvetica").fontSize(9);
        const rowH = Math.max(
          20,
          ...cells.map((cell, index) => doc.heightOfString(cell || " ", { width: columns[index].w - 8 })),
        ) + 8;
        if (doc.y + rowH > this.inspectionContentBottom(doc)) {
          doc.addPage();
          paintTableHeader();
        }
        const y = doc.y;
        let x = left;
        cells.forEach((cell, index) => {
          doc.fillColor(INK).font("Helvetica").fontSize(9).text(cell, x + 4, y + 3, { width: columns[index].w - 8 });
          x += columns[index].w;
        });
        const lineY = y + rowH;
        doc.moveTo(left, lineY).lineTo(right, lineY).strokeColor(RULE).lineWidth(0.4).stroke();
        doc.y = lineY;
        doc.x = left;
      }
      const notes = input.parts.map((item) => sparePartNote(item)).filter(Boolean);
      if (notes.length) {
        doc.moveDown(0.35);
        for (const note of notes) {
          this.paintInspectionParagraph(doc, left, width, note, true);
        }
      }
    }

    const checklist = visibleJsonFields(input.checklist);
    if (checklist.length) this.paintInspectionFields(doc, left, width, "Checklist", checklist);
    const measurements = visibleJsonFields(input.measurements);
    if (measurements.length) this.paintInspectionFields(doc, left, width, "Measurements", measurements);
    const codes = visibleErrorCodes(input.errorCodes);
    if (codes.length) {
      this.paintInspectionHeading(doc, left, width, "Error Codes");
      let x = left;
      let y = doc.y;
      doc.font("Helvetica-Bold").fontSize(8);
      for (const code of codes) {
        const chipW = doc.widthOfString(code) + 16;
        if (x > left && x + chipW > right) {
          x = left;
          y += 18;
        }
        if (y + 16 > this.inspectionContentBottom(doc)) {
          doc.addPage();
          y = doc.y;
          x = left;
        }
        doc.roundedRect(x, y, chipW, 14, 3).lineWidth(0.5).strokeColor(RULE).stroke();
        doc.fillColor(INK).text(code, x + 8, y + 3, { lineBreak: false });
        x += chipW + 6;
      }
      doc.y = y + 20;
      doc.x = left;
    }
    if (reportText(input.calibration)) {
      this.paintInspectionHeading(doc, left, width, "Calibration");
      this.paintInspectionParagraph(doc, left, width, reportText(input.calibration));
    }
    if (input.additionalFields.length) {
      this.paintInspectionFields(doc, left, width, "Additional Fields", input.additionalFields);
    }
    if (input.attachments.length) {
      this.paintInspectionHeading(doc, left, width, "Inspection Photos");
      await this.drawInspectionPhotos(doc, input.tenantId, input.actorId, input.actorRole, input.attachments, {
        left,
        width,
        bottom: this.inspectionContentBottom(doc),
      });
    }
    if (reportText(input.remarks)) {
      this.paintInspectionHeading(doc, left, width, "Remarks");
      this.paintInspectionParagraph(doc, left, width, reportText(input.remarks));
    }

    doc.x = left;
    doc.fillColor(INK);
    doc.removeListener("pageAdded", onPageAdded);
  }

  async generate(tenantId: string, actorId: string, kind: DocumentKind, entityId: string, actorRole = "admin") {
    const inspectionMargin = (15 * 72) / 25.4;
    const doc = new PDFDocument({
      size: "A4",
      margins: kind === "inspection-report"
        ? { top: inspectionMargin, bottom: inspectionMargin, left: inspectionMargin, right: inspectionMargin }
        : { top: 56, bottom: 56, left: 50, right: 50 },
      bufferPages: true,
      info: { Title: `${kind} ${entityId}` },
    });
    let footerLayout: { left: number; right: number } | undefined;
    let reference = entityId;
    let filename = `${kind}-${entityId}.pdf`;
    let invoiceId: string | undefined;
    let kindLabel = "Document";
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, include: { settings: true } });
    const company = tenant?.name ?? "MESMS";

    if (kind === "estimate") {
      const estimate = await prisma.estimate.findFirst({
        where: { id: entityId, tenantId },
        include: {
          lineItems: true,
          customer: true,
          revisions: { orderBy: { revision: "desc" }, take: 1 },
        },
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
      const preparedBy = estimate.salespersonId
        ? (await prisma.user.findFirst({
            where: { id: estimate.salespersonId, tenantId },
            select: { name: true },
          }))?.name
        : null;
      await this.header(doc, tenantId, "Estimate", reference, [
        { label: "Quotation No", value: reference },
        { label: "Revision", value: `Rev ${estimate.revision}` },
        { label: "Date", value: fmtDate(estimate.sentAt ?? estimate.createdAt) },
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
          { label: "Currency", value: estimate.currency || "INR" },
          { label: "Valid until", value: fmtDate(estimate.validUntil) },
          ...(estimate.estimatedCompletion
            ? [{ label: "Est. completion", value: fmtDate(estimate.estimatedCompletion) }]
            : []),
          ...(estimate.warranty ? [{ label: "Warranty", value: estimate.warranty }] : []),
          ...(preparedBy ? [{ label: "Prepared by", value: preparedBy }] : []),
          { label: "Approval", value: estimate.status },
        ],
        { detailsHeading: "PROJECT DETAILS" },
      );
      this.drawLines(
        doc,
        estimate.lineItems.map((line) => ({
          ...line,
          description: line.partNumber ? `${line.description} (${line.partNumber})` : line.description,
        })),
      );
      const taxRates = [...new Set(estimate.lineItems.map((line) => Number(line.taxRate ?? 0)))];
      const taxLabel = taxRates.length === 1 && taxRates[0] > 0 ? `GST (${taxRates[0]}%)` : "Tax";
      const totals = calculateEstimateTotals(
        estimate.lineItems,
        estimateLevelDiscount({
          discount: estimate.discount,
          subtotal: estimate.subtotal,
          lineItems: estimate.lineItems,
          revisions: estimate.revisions,
        }),
      );
      this.totals(doc, [
        { label: "Subtotal", value: money(totals.subtotal) },
        { label: "Discount", value: `-${money(totals.discount)}` },
        { label: taxLabel, value: money(totals.tax) },
        { label: "Grand Total", value: money(totals.total), emphasis: true },
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
            ...(invoice.job?.equipment
              ? equipmentIdentityRows({
                  serialNumber: invoice.job.equipment.serialNumber,
                  model: invoice.job.equipment.model,
                  manufacturer: invoice.job.equipment.manufacturer,
                  name: invoice.job.equipment.name || invoice.job.equipmentName,
                })
              : invoice.job?.equipmentName
                ? [{ label: "Description", value: invoice.job.equipmentName }]
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
      const invoiceTotals = calculateEstimateTotals(invoice.lineItems, 0);
      this.totals(doc, [
        { label: "Subtotal", value: money(invoiceTotals.subtotal) },
        { label: "Discount", value: `-${money(invoiceTotals.discount)}` },
        { label: taxLabel, value: money(invoiceTotals.tax) },
        { label: "Grand Total", value: money(invoiceTotals.total), emphasis: true },
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
          extras: { include: { inventoryItem: true } },
          stockDeductions: true,
          signature: true,
          photos: { include: { file: true } },
          customer: true,
          equipment: true,
          partsRequests: { include: { lines: { include: { inventoryItem: true } } } },
          estimate: { include: { lineItems: true } },
          serviceRequest: {
            include: {
              customer: true,
              equipment: true,
              equipmentItems: true,
            },
          },
        },
      });
      if (!job) throw new AppError("Service job not found", 404);
      const narrativeLogs = job.workLogs.filter((log) => isNarrativeWorkLog(log.workPerformed));
      if (!narrativeLogs.length) {
        throw new AppError("Fill the work report before generating a service report", 409);
      }
      reference = job.reference;
      filename = `${reference}-service-report.pdf`;

      const ticket = job.serviceRequest;
      const customer = job.customer ?? ticket?.customer ?? null;
      const equipment = job.equipment ?? ticket?.equipment ?? null;
      const serviceStarted = narrativeLogs[0]?.startedAt ?? job.scheduledFor;
      const serviceEnded = job.completedAt ?? narrativeLogs[narrativeLogs.length - 1]?.endedAt ?? null;
      const team =
        job.assignments
          .map((assignment) => customerFacingPersonName(assignment.user.name))
          .filter(Boolean)
          .join(", ") || customerFacingPersonName(job.engineer);
      const siteAddress = [
        displayValue(customer?.address),
        displayValue(customer?.city),
        displayValue(customer?.country),
      ]
        .filter(Boolean)
        .join(", ");

      await this.header(doc, tenantId, "Service Report", reference, [
        { label: "Report No", value: reference },
        { label: "Service date", value: fmtDate(serviceStarted) },
        { label: "Completed", value: serviceEnded ? fmtDate(serviceEnded) : "—" },
        { label: "Ticket", value: job.requestRef || "—" },
      ]);

      this.sectionHeading(doc, "Client details");
      this.keyValueRows(doc, [
        { label: "Customer", value: orDash(customer?.name ?? job.customerName) },
        { label: "Contact person", value: orDash(customer?.contactPerson) },
        { label: "Phone", value: orDash(customer?.phone) },
        { label: "Email", value: orDash(customer?.email) },
        { label: "City", value: orDash(customer?.city) },
        { label: "GST / license", value: orDash(customer?.licenseGst) },
      ]);
      if (siteAddress || customer?.deliveryAddress) {
        this.keyValueRows(
          doc,
          [
            ...(siteAddress ? [{ label: "Site address", value: siteAddress }] : []),
            ...(customer?.deliveryAddress
              ? [{ label: "Delivery address", value: displayValue(customer.deliveryAddress) }]
              : []),
          ],
          1,
        );
      }

      this.sectionHeading(doc, "Equipment");
      const equipmentRows: Array<{ label: string; value: string }> = equipment
        ? equipmentIdentityRows({
            serialNumber: equipment.serialNumber,
            model: equipment.model,
            manufacturer: equipment.manufacturer,
            name: equipment.name || job.equipmentName,
          })
        : [{ label: "Description", value: orDash(job.equipmentName) }];
      if (!equipment && ticket?.equipmentItems?.length) {
        equipmentRows.length = 0;
        for (const item of ticket.equipmentItems) {
          equipmentRows.push({ label: "Description", value: orDash(item.equipmentName) });
        }
      }
      this.keyValueRows(doc, equipmentRows);

      this.sectionHeading(doc, "Service");
      this.keyValueRows(doc, [
        { label: "Service type", value: serviceTypeLabel(job.type, job.typeOther) },
        { label: "Status", value: prettyLabel(String(job.status)) },
        ...(team ? [{ label: "Engineer / team", value: team }] : []),
        { label: "Ticket", value: orDash(job.requestRef) },
        { label: "Scheduled", value: fmtDate(job.scheduledFor) },
        { label: "Service date", value: fmtDateTime(serviceStarted) },
        { label: "Completed", value: serviceEnded ? fmtDateTime(serviceEnded) : "—" },
        ...(ticket?.createdAt ? [{ label: "Ticket opened", value: fmtDate(ticket.createdAt) }] : []),
      ]);
      if (displayValue(ticket?.description)) {
        this.sectionHeading(doc, "Reported problem");
        this.bodyParagraph(doc, displayValue(ticket?.description));
      }

      this.sectionHeading(doc, "Work performed");
      for (const log of narrativeLogs) {
        const { calibrationResult, recommendation } = splitWorkRecommendation(log.calibrationResult);
        this.ensureSpace(doc, 36);
        doc.x = LEFT;
        const engineerName = customerFacingPersonName(log.user.name);
        const workedAt = `${fmtDateTime(log.startedAt)}${log.endedAt ? ` to ${fmtDateTime(log.endedAt)}` : ""}`;
        doc.fillColor(INK).font("Helvetica-Bold").fontSize(9).text(
          engineerName ? `${engineerName} — ${workedAt}` : workedAt,
          LEFT,
          doc.y,
          { width: WIDTH },
        );
        doc.moveDown(0.3);
        this.bodyParagraph(doc, log.workPerformed);
        if (log.testingResult) {
          this.sectionHeading(doc, "Testing results");
          this.bodyParagraph(doc, log.testingResult);
        }
        if (calibrationResult) {
          this.sectionHeading(doc, "Calibration / measurements");
          this.bodyParagraph(doc, calibrationResult);
        }
        if (recommendation) {
          this.sectionHeading(doc, "Recommendation");
          this.bodyParagraph(doc, recommendation);
        }
      }

      const takenRows: Array<{ item: string; sku: string; kind: string; taken: string; used: string }> = [];
      for (const request of job.partsRequests) {
        for (const line of request.lines) {
          const issued = Number(line.qtyIssued);
          const used = Number(line.qtyConsumed);
          if (issued <= 0 && used <= 0) continue;
          const kind = line.inventoryItem
            ? formatInventoryItemClass(line.inventoryItem.itemClass)
            : "Spare Parts";
          takenRows.push({
            item: line.itemName,
            sku: line.sku,
            kind,
            taken: String(Math.max(issued, used)),
            used: String(used),
          });
        }
      }
      for (const item of job.stockDeductions) {
        const key = `${item.sku}::${item.itemName}`;
        const existing = takenRows.find((row) => `${row.sku}::${row.item}` === key);
        if (existing) {
          existing.used = String(Math.max(Number(existing.used), item.quantity));
          continue;
        }
        takenRows.push({
          item: item.itemName,
          sku: item.sku,
          kind: "Spare Parts",
          taken: String(item.quantity),
          used: String(item.quantity),
        });
      }
      for (const extra of job.extras) {
        if (isServiceChargeType(extra.type)) continue;
        takenRows.push({
          item: extra.status === "approved" ? extra.description : `${extra.description} (${prettyLabel(extra.status)})`,
          sku: extra.inventoryItem?.sku || "",
          kind: prettyLabel(extra.type || "product"),
          taken: String(Number(extra.quantity)),
          used: extra.status === "approved" ? String(Number(extra.quantity)) : "0",
        });
      }

      this.sectionHeading(doc, "Parts and products taken");
      if (takenRows.length) {
        this.drawUsageTable(doc, takenRows);
      } else {
        this.bodyParagraph(doc, "No parts or products were recorded on this job.");
      }

      const currentLines = (job.estimate?.lineItems ?? []).filter(
        (line) => !line.revisionId && !isServiceChargeType(line.type),
      );
      if (currentLines.length) {
        this.sectionHeading(doc, "Quoted items");
        this.drawUsageTable(
          doc,
          currentLines.map((line) => ({
            item: line.partNumber ? `${line.description} (${line.partNumber})` : line.description,
            sku: line.partNumber || "",
            kind: prettyLabel(line.type),
            taken: String(Number(line.quantity)),
            used: money(line.lineTotal),
          })),
          { taken: "QTY", used: "AMOUNT" },
        );
      }

      const stages = parseJobStageDetails(job.stageDetails);
      const qa = stages.qa;
      if (qa?.result || qa?.notes) {
        this.sectionHeading(doc, "Quality check");
        this.keyValueRows(doc, [
          { label: "Result", value: qa.result ? prettyLabel(qa.result) : "—" },
          {
            label: "Checked",
            value: qa.checkedAt && !Number.isNaN(new Date(qa.checkedAt).getTime())
              ? fmtDateTime(new Date(qa.checkedAt))
              : "—",
          },
        ]);
        if (qa.notes) this.bodyParagraph(doc, qa.notes);
      }
      const delivery = stages.delivery;
      if (delivery?.deliveredAt || delivery?.method || delivery?.receivedBy) {
        this.sectionHeading(doc, "Delivery");
        this.keyValueRows(doc, [
          { label: "Method", value: orDash(delivery.method) },
          { label: "Received by", value: orDash(delivery.receivedBy) },
          {
            label: "Delivered",
            value:
              delivery.deliveredAt && !Number.isNaN(new Date(delivery.deliveredAt).getTime())
                ? fmtDateTime(new Date(delivery.deliveredAt))
                : "—",
          },
          { label: "Courier", value: orDash(delivery.courier?.name) },
          { label: "Waybill", value: orDash(delivery.courier?.waybill) },
        ]);
        if (delivery.note) this.bodyParagraph(doc, delivery.note);
      }

      const jobFields = normalizeAdditionalFields(job.additionalFields);
      const ticketFields = normalizeAdditionalFields(ticket?.additionalFields);
      const extraFields = [...(ticketFields ?? []), ...(jobFields ?? [])];
      if (extraFields.length) {
        this.sectionHeading(doc, "Additional details");
        this.keyValueRows(
          doc,
          extraFields.map((field) => ({ label: field.label, value: orDash(field.value) })),
        );
      }

      const jobPhotos = job.photos.filter((photo) => photo.fileId);
      if (jobPhotos.length) {
        this.sectionHeading(doc, "Service photos");
        await this.drawInspectionPhotos(
          doc,
          tenantId,
          actorId,
          actorRole,
          jobPhotos.map((photo) => ({
            fileId: photo.fileId as string,
            caption: photo.caption,
            file: photo.file ? { originalName: photo.file.originalName } : undefined,
          })),
        );
      }

      if (job.signature) {
        await this.drawCustomerSignOff(doc, tenantId, actorId, actorRole, job.signature);
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
              recommendations: { include: { inventoryItem: true, catalogItem: true } },
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
      const settings = tenant?.settings;
      let logo: Buffer | null = null;
      if (settings?.logoFileId) {
        try {
          const downloaded = await fileStorageService.download(tenantId, settings.logoFileId, "system", "admin");
          logo = downloaded.buffer;
        } catch {
          logo = null;
        }
      }
      const equipmentRows: Array<{ label: string; value: string }> = [];
      const pushEquipment = (label: string, value: unknown) => {
        equipmentRows.push({ label, value: displayValue(value) });
      };
      if (sr.equipment) {
        for (const row of equipmentIdentityRows(sr.equipment)) {
          pushEquipment(row.label, row.value);
        }
      } else if (sr.equipmentItems.length) {
        for (const item of sr.equipmentItems) {
          pushEquipment("Description", item.equipmentName);
        }
      } else {
        pushEquipment("Description", sr.equipmentName);
      }
      const extraFields = normalizeAdditionalFields((report as { additionalFields?: unknown }).additionalFields) ?? [];
      const visibleExtra = extraFields.flatMap((field) => {
        if (/signature/i.test(field.label) || field.value.startsWith("data:image")) return [];
        return [{ label: field.label, value: field.value }];
      });
      footerLayout = {
        left: doc.page.margins.left,
        right: doc.page.width - doc.page.margins.right,
      };
      await this.drawStyledInspectionReport(doc, {
        tenantId,
        actorId,
        actorRole,
        company,
        orgLines: [
          reportText(settings?.companyAddress),
          reportText(settings?.companyPhone),
          reportText(settings?.supportEmail),
          reportText(settings?.companyWebsite),
        ].filter(Boolean),
        reference,
        inspectionDate: reportText(fmtDate(report.reportedAt)),
        severity: report.severity,
        completionLabel: report.submittedAt ? "Completed" : "Draft",
        reportStatus,
        inspectorName,
        logo,
        clientRows: [
          { label: "Name", value: reportText(customer?.name) || reportText(sr.customerName) },
          { label: "Phone", value: displayValue(customer?.phone) },
          { label: "Email", value: displayValue(customer?.email) },
          { label: "Site address", value: displayValue(siteAddress) },
        ],
        equipmentRows,
        findings: split.findings,
        workDetails: split.workDetails,
        recommendation: report.recommendation ?? "",
        parts: report.recommendations,
        checklist: report.checklist,
        measurements: report.measurements,
        errorCodes: report.errorCodes,
        calibration: report.calibrationStatus ?? "",
        additionalFields: visibleExtra,
        attachments: report.attachments,
        remarks: report.technicianRemarks ?? "",
      });
      kindLabel = "Inspection Report";
    } else {
      throw new AppError("Unsupported document kind", 400);
    }

    if (kind !== "invoice") {
      this.stampFooters(doc, company, kindLabel, reference, footerLayout);
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
