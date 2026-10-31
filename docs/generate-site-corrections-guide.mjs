/**
 * Client-facing Site Corrections Guide
 * Structure follows a simple technical documentation template:
 * Title → Subtitle → Date → TOC → Overview → Checklist items
 * (What changed / Where / How to use)
 *
 * Run: node generate-site-corrections-guide.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BLUE = "1B4F9C";
const BLUE_DARK = "0F3A75";
const BLUE_SOFT = "E8F1FB";
const NAVY = "0F2A44";
const MUTED = "5A6A7A";
const GREEN = "1F6B3A";
const GREEN_SOFT = "E6F4EA";
const SOFT = "F5F7FA";
const WHITE = "FFFFFF";
const LINE = "D0D8E0";

const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const noBorder = { style: BorderStyle.NONE, size: 0, color: WHITE };
const borders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

const DATE_EDITED = "30 October 2026";

const corrections = [
  {
    id: 1,
    title: "Tax on estimates and billing",
    category: "Estimates & Billing",
    location: "Estimates → open / build estimate · Billing → invoice / job lines · Admin → Settings (default tax)",
    menuPath: "/app/estimates · /app/billing · /app/settings",
    what: "New estimate and billing lines no longer start at 12% tax. They start at 0%. The organization default tax rate in Settings is also 0%.",
    how: [
      "Open an estimate or billing document and add a new line.",
      "Tax % starts at 0. Type a percent only when tax applies.",
      "Admin can confirm the default in Settings so new documents do not pick up 12% automatically.",
    ],
  },
  {
    id: 2,
    title: "Share an estimate",
    category: "Estimates & Billing",
    location: "Estimates → open estimate detail or Print / PDF preview",
    menuPath: "/app/estimates/{id} · /app/estimates/{id}/preview",
    what: "Staff can send the estimate PDF to the customer using the same share pattern as inspection reports.",
    how: [
      "Open the estimate.",
      "Use Print / PDF to view or save the document.",
      "Use Gmail to open a compose window with the estimate ready to send.",
      "Use WhatsApp to open a share message with the estimate ready to send.",
    ],
  },
  {
    id: 3,
    title: "Clear a selected estimate or billing item",
    category: "Estimates & Billing",
    location: "Estimate line items · Billing line items (service catalog or inventory product picker)",
    menuPath: "/app/estimates (builder / detail) · /app/billing (invoice / job lines)",
    what: "After picking a catalog service or inventory product, a small close (×) button appears on that choice. Clicking it clears only the selection. The line stays; description can be edited or left blank.",
    how: [
      "Select a service or product on a line.",
      "Click the small close button on the selected chip / choice to clear it.",
      "You no longer need to pick a different item just to remove the current one.",
    ],
  },
  {
    id: 4,
    title: "Part number stays out of the description",
    category: "Estimates & Billing",
    location: "Estimate and billing description fields (line text)",
    menuPath: "/app/estimates · /app/billing",
    what: "Description shows the item name or custom text only. Part number / SKU is not appended (for example, no “Item name (PN-123)”). Part number is also removed from Register Equipment (see item 8).",
    how: [
      "Add or edit a line on an estimate or bill.",
      "Confirm the description is name or custom text only.",
      "Use the part / SKU field separately where shown for staff—not inside the description.",
    ],
  },
  {
    id: 5,
    title: "Serial number must be unique",
    category: "Equipment",
    location: "Equipment → Register / create equipment (single or bulk)",
    menuPath: "/app/equipment",
    what: "A serial number cannot match one already saved. Duplicate serials are blocked with a field error.",
    how: [
      "Enter a serial number when registering equipment.",
      "If it is already used, save is blocked and the serial field shows: “Serial number already taken. Please check.”",
      "The same check applies when several units are entered together or when an existing serial is typed again.",
    ],
  },
  {
    id: 6,
    title: "Address on customer and supplier",
    category: "Customers & Suppliers",
    location: "Customers → create / edit · Suppliers → create / edit",
    menuPath: "/app/customers · /app/suppliers",
    what: "An Address text area is available. On customers, the previous “Billing & delivery addresses” box is this Address field. On suppliers, Address is optional.",
    how: [
      "Open create or edit for a customer or supplier.",
      "Enter the address in the Address text area.",
      "Save. Supplier address may be left blank.",
    ],
  },
  {
    id: 7,
    title: "Inventory: remove maximum stock",
    category: "Inventory",
    location: "Inventory → Parts → Create inventory item",
    menuPath: "/app/inventory?stage=parts",
    what: "Maximum stock (Min/max level max) is removed from create inventory. Quantity on hand remains. Minimum level may remain only if reorder warnings need it.",
    how: [
      "Create a new inventory item under Inventory → Parts.",
      "Enter quantity on hand (and minimum level if shown).",
      "There is no maximum stock field to fill.",
    ],
  },
  {
    id: 8,
    title: "Fields removed from forms",
    category: "Equipment · Customers · Suppliers",
    location: "Register Equipment · Customer create/edit · Supplier create/edit",
    menuPath: "/app/equipment · /app/customers · /app/suppliers",
    what: "Removed fields: Part number (Register Equipment); Payment terms (Customer); Rating 0–5 and Delivery lead time days (Supplier). Supplier payment terms stay unless separately removed.",
    how: [
      "Open the forms above and confirm those fields are no longer shown.",
      "Continue using the remaining fields as usual.",
    ],
  },
  {
    id: 9,
    title: "QR code on inventory items",
    category: "Inventory",
    location: "Inventory → open item detail",
    menuPath: "/app/inventory/{id}",
    what: "Each inventory item has a QR code, same idea as equipment. Print or download for labels. Scanning opens that inventory item.",
    how: [
      "Open an inventory item detail page.",
      "View the QR code on the item.",
      "Print or download the QR for the part or bin label.",
      "Scan the code to open that inventory item in the system.",
    ],
  },
  {
    id: 10,
    title: "Purchase order workflow",
    category: "Purchase",
    location: "Purchase → PO (and related stages: shipment, GRN, stock)",
    menuPath: "/app/purchase-orders · /app/rfqs",
    what: "The purchase order path follows: create PO from supplier and lines → review → send/print → receive goods and update stock → close when receipt is complete.",
    how: [
      "Create the purchase order with supplier and lines.",
      "Review the order before it is sent.",
      "Send or print the order for the supplier.",
      "Receive goods (GRN) and update stock.",
      "Close the order when receipt is complete.",
    ],
  },
  {
    id: 11,
    title: "RFQ quote: print and share",
    category: "Purchase",
    location: "Purchase → RFQ / Supplier quote → open quote after it is created",
    menuPath: "/app/rfqs?stage=quotes",
    what: "After a quote is created from an RFQ, staff can Print / PDF, Gmail, or WhatsApp the quote without leaving the quote screen.",
    how: [
      "Open the supplier quote created from an RFQ.",
      "Use Print / PDF for the client copy.",
      "Use Gmail or WhatsApp to send the PDF from the same screen.",
    ],
  },
  {
    id: 12,
    title: "QA checklist from settings",
    category: "Jobs & QA · Settings",
    location: "Admin → Settings (default QA points) · Service Jobs → job QA section",
    menuPath: "/app/settings · /app/jobs/{id}",
    what: "QA is no longer a fixed list of five checks. Defaults are stored in Settings. On the job, those points appear as checkboxes. A + button adds optional extra points for that job only.",
    how: [
      "Admin sets default QA points in Settings.",
      "Open a job’s QA section—defaults appear as checkboxes.",
      "Use + to add optional extra points for that job.",
      "QA staff (or a manager in that role) updates and saves the checklist.",
      "After that update, staff can Download Service Report.",
    ],
  },
  {
    id: 13,
    title: "Reserve stock purpose is optional",
    category: "Inventory",
    location: "Inventory → Reserve stock",
    menuPath: "/app/stock-reservations",
    what: "Purpose is a message box and is optional. Saving with an empty purpose is allowed. The system does not block with “purpose is required.”",
    how: [
      "Create or edit a stock reservation.",
      "Leave Purpose blank if not needed, or type a note.",
      "Save—empty purpose is accepted.",
    ],
  },
  {
    id: 14,
    title: "Inspection report and service report cleanup",
    category: "Reports / PDFs",
    location: "Inspection report PDF · Service report PDF",
    menuPath: "/app/inspections · /app/jobs (Download Service Report)",
    what: "Customer PDFs no longer show internal status chips (Priority, Work status) or time. Time may still appear on estimate/billing detail screens for staff, but not on inspection or service report PDFs.",
    how: [
      "Generate or download an inspection report or service report.",
      "Confirm Priority / Work status chips are not on the customer PDF.",
      "Confirm time is not printed in header, photos, findings, or footer of those two reports.",
    ],
  },
  {
    id: 15,
    title: "Customer copy of an estimate or bill",
    category: "Estimates & Billing · PDFs",
    location: "Customer-facing estimate / bill PDF (share or print for customer)",
    menuPath: "/app/estimates/{id}/preview · Billing customer PDF",
    what: "The PDF sent to the customer does not show inventory product or price lines. The customer sees only the custom text written for that document. Staff still see products, quantities, and prices on internal screens.",
    how: [
      "Prepare the estimate or bill with internal lines as usual.",
      "Write the customer-facing custom text for the document.",
      "Print or share the customer PDF—only custom text appears for the customer.",
    ],
  },
  {
    id: 16,
    title: "Revision removed from estimate report",
    category: "Estimates · PDFs",
    location: "Estimate report → project details block under the ticket",
    menuPath: "/app/estimates/{id}/preview (and print/PDF)",
    what: "Revision (for example “Rev 1”) is removed from the project details block. It must not appear on the estimate report.",
    how: [
      "Open Print / PDF for an estimate.",
      "In project details under the ticket, confirm Revision is not shown.",
    ],
  },
  {
    id: 17,
    title: "Equipment location label",
    category: "Equipment",
    location: "Equipment → create / edit",
    menuPath: "/app/equipment",
    what: "Label renamed from “Location at site” to “Location”. Field stays optional; only the label changes.",
    how: [
      "Open create or edit equipment.",
      "Use the Location field (optional) as before.",
    ],
  },
  {
    id: 18,
    title: "Signature upload (draw or image)",
    category: "Inspection · Estimates · Billing",
    location: "Inspection capture · Estimate / billing staff signature collection · Inspection report",
    menuPath: "/app/inspections · Estimates · Billing",
    what: "Staff can attach a signature by drawing on screen or uploading an image. Signature may belong to the estimate creator, billing staff, or inspector. Saved signature appears on the inspection report. Digital signature upload is available wherever a staff signature is collected for estimate, billing, or inspection.",
    how: [
      "At inspection (or estimate / billing signature step), choose Draw or Upload.",
      "Draw on screen, or upload a signature image file.",
      "Save—the signature appears on the inspection report and related documents.",
    ],
  },
  {
    id: 19,
    title: "Remove approval control from Users",
    category: "Users · Administration",
    location: "Administration → Users → create / edit user",
    menuPath: "/app/users · /app/users/new · /app/users/{id}/edit",
    what: "The “Bypass approval steps” switch is removed from the user create and edit form. Staff no longer set a per-user approval bypass on the Users screen. Approval behaviour is controlled by organization Settings (Skip approvals), not by a user-level toggle.",
    how: [
      "Open Users → create or edit a staff user.",
      "Confirm there is no “Bypass approval steps” switch on the form.",
      "Set roles and module access as usual, then save.",
      "Use Admin → Settings → Skip approvals if the organization should run without approval queues.",
    ],
  },
  {
    id: 20,
    title: "Final service report — remove Service section",
    category: "Reports / PDFs",
    location: "Jobs → Download Service Report (Final Service Report PDF)",
    menuPath: "/app/jobs/{id} · mobile job detail (Download Service Report)",
    what: "The Final Service Report PDF no longer includes the redundant Service section. Removed fields: Service Type, Ticket Number, Scheduled Date, Service Date, Completed Date, and Ticket Opened Date. Report number, service date, completed date, and ticket remain in the PDF header only.",
    how: [
      "Open a completed job and use Download Service Report (or regenerate the report).",
      "Confirm there is no Service section listing Service Type, Ticket, Scheduled, Service date, Completed, or Ticket opened.",
      "Confirm those key facts still appear once in the report header where needed.",
    ],
  },
];

function p(text, opts = {}) {
  const { bold = false, color = NAVY, size = 20, center = false, spaceAfter = 80, spaceBefore = 0, italics = false } = opts;
  return new Paragraph({
    alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
    spacing: { after: spaceAfter, before: spaceBefore },
    children: [
      new TextRun({ text: String(text), bold, color, size, font: "Calibri", italics }),
    ],
  });
}

function mixedRuns(parts, spacing = {}) {
  return new Paragraph({
    spacing: { after: 80, ...spacing },
    children: parts.map((part) =>
      new TextRun({
        text: part.text,
        bold: !!part.bold,
        color: part.color || NAVY,
        size: part.size || 20,
        font: "Calibri",
        italics: !!part.italics,
      }),
    ),
  });
}

function cell(text, opts = {}) {
  const {
    bold = false,
    fill = WHITE,
    color = NAVY,
    width = 2200,
    align = AlignmentType.LEFT,
    fontSize = 18,
    borders: cellBorders = borders,
  } = opts;
  return new TableCell({
    borders: cellBorders,
    width: { size: width, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [
      new Paragraph({
        alignment: align,
        children: [
          new TextRun({
            text: String(text),
            bold,
            color,
            size: fontSize,
            font: "Calibri",
          }),
        ],
      }),
    ],
  });
}

function sectionBanner(title) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: noBorders,
            width: { size: 9360, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: BLUE },
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: title, bold: true, color: WHITE, size: 24, font: "Calibri" }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function metaRow(label, value) {
  return new TableRow({
    children: [
      cell(label, { bold: true, fill: BLUE_SOFT, color: BLUE_DARK, width: 2800, fontSize: 18 }),
      cell(value, { width: 6560, fontSize: 18 }),
    ],
  });
}

function correctionBlock(item) {
  const nodes = [];

  nodes.push(
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [900, 8460],
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders,
              width: { size: 900, type: WidthType.DXA },
              shading: { type: ShadingType.CLEAR, fill: GREEN_SOFT },
              margins: { top: 100, bottom: 100, left: 80, right: 80 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({ text: "☑", bold: true, color: GREEN, size: 22, font: "Segoe UI Symbol" }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({ text: "Done", bold: true, color: GREEN, size: 14, font: "Calibri" }),
                  ],
                }),
              ],
            }),
            new TableCell({
              borders,
              width: { size: 8460, type: WidthType.DXA },
              shading: { type: ShadingType.CLEAR, fill: SOFT },
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  spacing: { after: 40 },
                  children: [
                    new TextRun({
                      text: `${item.id}. ${item.title}`,
                      bold: true,
                      color: BLUE_DARK,
                      size: 24,
                      font: "Calibri",
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: "Category: ", bold: true, color: MUTED, size: 16, font: "Calibri" }),
                    new TextRun({ text: item.category, color: MUTED, size: 16, font: "Calibri" }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  );

  nodes.push(new Paragraph({ spacing: { after: 60 }, children: [] }));

  nodes.push(
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [2200, 7160],
      rows: [
        new TableRow({
          children: [
            cell("Where (menu)", { bold: true, fill: BLUE_SOFT, color: BLUE_DARK, width: 2200, fontSize: 17 }),
            cell(item.location, { width: 7160, fontSize: 17 }),
          ],
        }),
        new TableRow({
          children: [
            cell("Page path", { bold: true, fill: BLUE_SOFT, color: BLUE_DARK, width: 2200, fontSize: 17 }),
            cell(item.menuPath, { width: 7160, fontSize: 17, color: MUTED }),
          ],
        }),
        new TableRow({
          children: [
            cell("What was added / changed", { bold: true, fill: BLUE_SOFT, color: BLUE_DARK, width: 2200, fontSize: 17 }),
            cell(item.what, { width: 7160, fontSize: 17 }),
          ],
        }),
      ],
    }),
  );

  nodes.push(p("How to use", { bold: true, color: BLUE_DARK, size: 20, spaceBefore: 120, spaceAfter: 40 }));

  item.how.forEach((step, i) => {
    nodes.push(
      mixedRuns([
        { text: `${i + 1}. `, bold: true, color: BLUE, size: 18 },
        { text: step, color: NAVY, size: 18 },
      ]),
    );
  });

  nodes.push(new Paragraph({ spacing: { after: 280 }, children: [] }));
  return nodes;
}

const tocRows = corrections.map(
  (c) =>
    new TableRow({
      children: [
        cell(String(c.id), { bold: true, width: 700, align: AlignmentType.CENTER, fontSize: 17, fill: BLUE_SOFT, color: BLUE_DARK }),
        cell(c.title, { width: 5200, fontSize: 17 }),
        cell(c.category, { width: 2460, fontSize: 16, color: MUTED }),
        cell("Done", { bold: true, width: 1000, align: AlignmentType.CENTER, fontSize: 16, fill: GREEN_SOFT, color: GREEN }),
      ],
    }),
);

const children = [
  // Cover / title block (Planio-style template fields)
  sectionBanner("Medical Equipment Service Management"),
  new Paragraph({ spacing: { after: 80 }, children: [] }),
  p("Site Corrections & Updates Guide", { bold: true, color: BLUE_DARK, size: 36, spaceAfter: 60 }),
  p("A simple how-to guide for the latest system corrections: what changed, where to find it, and how to use it.", {
    color: MUTED,
    size: 20,
    spaceAfter: 160,
  }),

  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2800, 6560],
    rows: [
      metaRow("Document title", "MEMS Site Corrections & Updates Guide"),
      metaRow("Subtitle", "Client information pack — 20 corrections completed"),
      metaRow("Date last edited", DATE_EDITED),
      metaRow("Audience", "Client / operations staff / administrators"),
      metaRow("Status", "All listed corrections updated on the site"),
    ],
  }),

  new Paragraph({ spacing: { after: 200 }, children: [] }),

  // Overview
  sectionBanner("1. Overview"),
  new Paragraph({ spacing: { after: 100 }, children: [] }),
  p(
    "This guide informs the client that the Medical Equipment Service Management site has been updated with twenty corrections. Each item below explains what was added or changed, which page or menu location to open, and how to use the new behaviour.",
    { size: 20, spaceAfter: 120 },
  ),
  p("Main themes covered:", { bold: true, color: BLUE_DARK, size: 20, spaceAfter: 60 }),
  ...[
    "Tax defaults and line tax entry on estimates and billing",
    "Share estimate and RFQ quote via Print / PDF, Gmail, and WhatsApp",
    "Clearer line editing (clear selection, description without part number)",
    "Equipment serial uniqueness and Location label",
    "Customer and supplier Address field; unused form fields removed",
    "Inventory QR codes, optional reserve purpose, no maximum stock",
    "Purchase order workflow and configurable QA checklist",
    "Cleaner customer PDFs (no internal status/time; customer estimate/bill text only)",
    "Signature draw or upload for inspection, estimate, and billing",
    "Approval bypass removed from Users form (use Settings skip-approvals instead)",
    "Final service report PDF without redundant Service section fields",
  ].map((t) =>
    mixedRuns([
      { text: "•  ", bold: true, color: BLUE, size: 18 },
      { text: t, color: NAVY, size: 18 },
    ]),
  ),

  new Paragraph({ spacing: { after: 200 }, children: [] }),

  // TOC
  sectionBanner("2. Table of contents"),
  new Paragraph({ spacing: { after: 100 }, children: [] }),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [700, 5200, 2460, 1000],
    rows: [
      new TableRow({
        children: [
          cell("#", { bold: true, fill: BLUE, color: WHITE, width: 700, align: AlignmentType.CENTER, fontSize: 17 }),
          cell("Correction", { bold: true, fill: BLUE, color: WHITE, width: 5200, fontSize: 17 }),
          cell("Area", { bold: true, fill: BLUE, color: WHITE, width: 2460, fontSize: 17 }),
          cell("Status", { bold: true, fill: BLUE, color: WHITE, width: 1000, align: AlignmentType.CENTER, fontSize: 17 }),
        ],
      }),
      ...tocRows,
    ],
  }),

  new Paragraph({ spacing: { after: 240 }, children: [] }),

  // Checklist detail
  sectionBanner("3. Correction details — Where · What · How to use"),
  new Paragraph({ spacing: { after: 140 }, children: [] }),
  p(
    "Use this section as a checklist. Each item is marked Done because the correction is already applied on the website.",
    { color: MUTED, size: 18, spaceAfter: 160, italics: true },
  ),

  ...corrections.flatMap((item) => correctionBlock(item)),

  // Quick location map
  sectionBanner("4. Quick location map"),
  new Paragraph({ spacing: { after: 100 }, children: [] }),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2800, 6560],
    rows: [
      new TableRow({
        children: [
          cell("Module / menu", { bold: true, fill: BLUE, color: WHITE, width: 2800, fontSize: 17 }),
          cell("Related corrections", { bold: true, fill: BLUE, color: WHITE, width: 6560, fontSize: 17 }),
        ],
      }),
      new TableRow({
        children: [
          cell("Estimates", { bold: true, fill: BLUE_SOFT, width: 2800, fontSize: 17 }),
          cell("1 Tax · 2 Share · 3 Clear selection · 4 Description · 15 Customer PDF · 16 Revision · 18 Signature", {
            width: 6560,
            fontSize: 17,
          }),
        ],
      }),
      new TableRow({
        children: [
          cell("Billing", { bold: true, fill: BLUE_SOFT, width: 2800, fontSize: 17 }),
          cell("1 Tax · 3 Clear selection · 4 Description · 15 Customer PDF · 18 Signature", { width: 6560, fontSize: 17 }),
        ],
      }),
      new TableRow({
        children: [
          cell("Equipment", { bold: true, fill: BLUE_SOFT, width: 2800, fontSize: 17 }),
          cell("5 Unique serial · 8 Remove part number · 17 Location label", { width: 6560, fontSize: 17 }),
        ],
      }),
      new TableRow({
        children: [
          cell("Customers / Suppliers", { bold: true, fill: BLUE_SOFT, width: 2800, fontSize: 17 }),
          cell("6 Address · 8 Removed payment terms / rating / lead time", { width: 6560, fontSize: 17 }),
        ],
      }),
      new TableRow({
        children: [
          cell("Inventory / Reserve", { bold: true, fill: BLUE_SOFT, width: 2800, fontSize: 17 }),
          cell("7 No max stock · 9 QR code · 13 Optional purpose", { width: 6560, fontSize: 17 }),
        ],
      }),
      new TableRow({
        children: [
          cell("Purchase / RFQ / PO", { bold: true, fill: BLUE_SOFT, width: 2800, fontSize: 17 }),
          cell("10 PO workflow · 11 RFQ quote print & share", { width: 6560, fontSize: 17 }),
        ],
      }),
      new TableRow({
        children: [
          cell("Jobs / QA / Settings", { bold: true, fill: BLUE_SOFT, width: 2800, fontSize: 17 }),
          cell("1 Default tax (Settings) · 12 QA checklist defaults · 14 Service report PDF · 20 Final service report Service section removed", {
            width: 6560,
            fontSize: 17,
          }),
        ],
      }),
      new TableRow({
        children: [
          cell("Inspections", { bold: true, fill: BLUE_SOFT, width: 2800, fontSize: 17 }),
          cell("14 Inspection report PDF · 18 Signature draw / upload", { width: 6560, fontSize: 17 }),
        ],
      }),
      new TableRow({
        children: [
          cell("Users / Settings", { bold: true, fill: BLUE_SOFT, width: 2800, fontSize: 17 }),
          cell("19 Remove approval control from Users · Skip approvals remains in Settings", {
            width: 6560,
            fontSize: 17,
          }),
        ],
      }),
    ],
  }),

  new Paragraph({ spacing: { after: 240 }, children: [] }),

  sectionBanner("5. Notes for the client"),
  new Paragraph({ spacing: { after: 100 }, children: [] }),
  p(
    "All twenty corrections listed in this document are implemented on the live site. Staff should use the Where (menu) and How to use steps when training or verifying each change. If a later review finds any purchase-order step still missing or out of order, that can be listed in a short follow-up note under item 10.",
    { size: 19, spaceAfter: 120 },
  ),
  p("— End of Site Corrections & Updates Guide —", { center: true, color: MUTED, size: 16, spaceBefore: 200 }),
];

const doc = new Document({
  styles: {
    default: {
      document: {
        styles: [{ id: "Normal", run: { font: "Calibri", size: 20 } }],
      },
    },
  },
  numbering: {
    config: [
      {
        reference: "howto",
        levels: [
          {
            level: 0,
            format: LevelFormat.DECIMAL,
            text: "%1.",
            alignment: AlignmentType.LEFT,
          },
        ],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          margin: { top: 720, bottom: 720, left: 720, right: 720 },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({
                  text: "MEMS · Site Corrections Guide",
                  color: BLUE,
                  size: 16,
                  font: "Calibri",
                  bold: true,
                }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: "Page ", color: MUTED, size: 16, font: "Calibri" }),
                new TextRun({ children: [PageNumber.CURRENT], color: MUTED, size: 16, font: "Calibri" }),
                new TextRun({ text: " · Confidential client documentation · ", color: MUTED, size: 16, font: "Calibri" }),
                new TextRun({ text: DATE_EDITED, color: MUTED, size: 16, font: "Calibri" }),
              ],
            }),
          ],
        }),
      },
      children,
    },
  ],
});

const preferred = path.resolve(__dirname, "MEMS_SITE_CORRECTIONS_CLIENT_GUIDE.docx");
const fallback = path.resolve(__dirname, "MEMS_SITE_CORRECTIONS_CLIENT_GUIDE_UPDATED.docx");
const buffer = await Packer.toBuffer(doc);
let outDocx = preferred;
try {
  fs.writeFileSync(outDocx, buffer);
} catch (err) {
  if (err && (err.code === "EBUSY" || err.code === "EPERM")) {
    outDocx = fallback;
    fs.writeFileSync(outDocx, buffer);
    console.warn("Preferred DOCX was locked; wrote fallback instead.");
  } else {
    throw err;
  }
}
console.log("Wrote", outDocx);
