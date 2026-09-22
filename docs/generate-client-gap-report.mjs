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
  ImageRun,
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
  convertInchesToTwip,
} from "docx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workflowImageCandidates = [
  path.resolve(__dirname, "mems-service-workflow-repair-qa-delivery.png"),
  path.resolve(process.env.USERPROFILE || "", ".cursor/projects/c-Users-USER-Documents-shabeeb-mems-software-Medical-Equipment-Service-Management/assets/mems-service-workflow-repair-qa-delivery.png"),
];
const workflowImagePath = workflowImageCandidates.find((p) => fs.existsSync(p));
const workflowImageBuffer = workflowImagePath ? fs.readFileSync(workflowImagePath) : null;

const NAVY = "0F2A44";
const TEAL = "1A6B6B";
const ACCENT = "C45C26";
const LIGHT = "F4F7F9";
const SOFT = "E8EEF2";
const GREEN = "1F6B3A";
const AMBER = "8A5A00";
const RED = "8B2E2E";
const MUTED = "5A6A7A";
const WHITE = "FFFFFF";

const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: "D0D8E0" };
const noBorder = { style: BorderStyle.NONE, size: 0, color: WHITE };
const borders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

function cell(text, opts = {}) {
  const {
    bold = false,
    fill = WHITE,
    color = NAVY,
    width = 2200,
    align = AlignmentType.LEFT,
    fontSize = 18,
  } = opts;
  return new TableCell({
    borders,
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

function headerCell(text, width = 2200) {
  return cell(text, { bold: true, fill: NAVY, color: WHITE, width, align: AlignmentType.LEFT, fontSize: 17 });
}

function statusCell(status, width = 1600) {
  const map = {
    Keep: { fill: "E6F4EA", color: GREEN },
    Improve: { fill: "FFF4DF", color: AMBER },
    Add: { fill: "E8F1FF", color: "1A4A8A" },
    Disable: { fill: "FCE8E8", color: RED },
    Done: { fill: "E6F4EA", color: GREEN },
    Partial: { fill: "FFF4DF", color: AMBER },
    Missing: { fill: "FCE8E8", color: RED },
    Low: { fill: "E6F4EA", color: GREEN },
    Medium: { fill: "FFF4DF", color: AMBER },
    "Low–Medium": { fill: "FFF4DF", color: AMBER },
  };
  const s = map[status] || { fill: SOFT, color: NAVY };
  return cell(status, { bold: true, fill: s.fill, color: s.color, width, align: AlignmentType.CENTER, fontSize: 17 });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: TEAL, space: 8 } },
    children: [new TextRun({ text, bold: true, color: NAVY, size: 28, font: "Calibri" })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 120 },
    children: [new TextRun({ text, bold: true, color: TEAL, size: 24, font: "Calibri" })],
  });
}

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 140, line: 276 },
    children: [
      new TextRun({
        text,
        color: opts.muted ? MUTED : "243447",
        size: opts.size || 20,
        italics: opts.italics || false,
        bold: opts.bold || false,
        font: "Calibri",
      }),
    ],
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { after: 80, line: 276 },
    children: [new TextRun({ text, color: "243447", size: 20, font: "Calibri" })],
  });
}

function callout(title, body, fill = LIGHT, titleColor = TEAL) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: noBorders,
            width: { size: 9360, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill },
            margins: { top: 140, bottom: 140, left: 200, right: 200 },
            children: [
              new Paragraph({
                spacing: { after: 60 },
                children: [new TextRun({ text: title, bold: true, color: titleColor, size: 20, font: "Calibri" })],
              }),
              new Paragraph({
                spacing: { after: 0, line: 276 },
                children: [new TextRun({ text: body, color: "243447", size: 19, font: "Calibri" })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function spacer(after = 160) {
  return new Paragraph({ spacing: { after }, children: [] });
}

const doc = new Document({
  styles: {
    default: { document: { styles: [{ id: "Normal", run: { font: "Calibri", size: 20 } }] } },
  },
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "•",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: convertInchesToTwip(0.25), hanging: convertInchesToTwip(0.18) } } },
          },
        ],
      },
      {
        reference: "steps",
        levels: [
          {
            level: 0,
            format: LevelFormat.DECIMAL,
            text: "%1.",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: convertInchesToTwip(0.3), hanging: convertInchesToTwip(0.2) } } },
          },
        ],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(0.7),
            bottom: convertInchesToTwip(0.7),
            left: convertInchesToTwip(0.75),
            right: convertInchesToTwip(0.75),
          },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: TEAL, space: 6 } },
              spacing: { after: 120 },
              children: [
                new TextRun({ text: "MEMS  ·  Medical Equipment Service Management", bold: true, color: NAVY, size: 16, font: "Calibri" }),
                new TextRun({ text: "     |     Client Alignment Report", color: MUTED, size: 16, font: "Calibri" }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              border: { top: { style: BorderStyle.SINGLE, size: 6, color: "D0D8E0", space: 6 } },
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({ text: "Confidential  ·  Page ", color: MUTED, size: 15, font: "Calibri" }),
                new TextRun({ children: [PageNumber.CURRENT], color: MUTED, size: 15, font: "Calibri" }),
                new TextRun({ text: " of ", color: MUTED, size: 15, font: "Calibri" }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], color: MUTED, size: 15, font: "Calibri" }),
              ],
            }),
          ],
        }),
      },
      children: [
        // COVER BAND
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [9360],
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  borders: noBorders,
                  width: { size: 9360, type: WidthType.DXA },
                  shading: { type: ShadingType.CLEAR, fill: NAVY },
                  margins: { top: 280, bottom: 280, left: 280, right: 280 },
                  children: [
                    new Paragraph({
                      spacing: { after: 80 },
                      children: [
                        new TextRun({
                          text: "CLIENT ALIGNMENT & CORRECTION PLAN",
                          bold: true,
                          color: WHITE,
                          size: 18,
                          font: "Calibri",
                        }),
                      ],
                    }),
                    new Paragraph({
                      spacing: { after: 120 },
                      children: [
                        new TextRun({
                          text: "ERP Blueprint vs Live MEMS Website",
                          bold: true,
                          color: WHITE,
                          size: 36,
                          font: "Calibri",
                        }),
                      ],
                    }),
                    new Paragraph({
                      spacing: { after: 40 },
                      children: [
                        new TextRun({
                          text: "What stays  ·  Flow Repair→QA→Delivery  ·  Staff permissions  ·  PPT corrections",
                          color: "B8C9D9",
                          size: 19,
                          font: "Calibri",
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
        spacer(200),

        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [3120, 3120, 3120],
          rows: [
            new TableRow({
              children: [
                cell("Document type", { bold: true, fill: SOFT, width: 3120, fontSize: 16, color: MUTED }),
                cell("Reference", { bold: true, fill: SOFT, width: 3120, fontSize: 16, color: MUTED }),
                cell("Date", { bold: true, fill: SOFT, width: 3120, fontSize: 16, color: MUTED }),
              ],
            }),
            new TableRow({
              children: [
                cell("Client correction & gap report", { width: 3120, fontSize: 17 }),
                cell("ERP MODEL (1).pptx", { width: 3120, fontSize: 17 }),
                cell("12 September 2026", { width: 3120, fontSize: 17 }),
              ],
            }),
            new TableRow({
              children: [
                cell("System", { bold: true, fill: SOFT, width: 3120, fontSize: 16, color: MUTED }),
                cell("Audience", { bold: true, fill: SOFT, width: 3120, fontSize: 16, color: MUTED }),
                cell("Status", { bold: true, fill: SOFT, width: 3120, fontSize: 16, color: MUTED }),
              ],
            }),
            new TableRow({
              children: [
                cell("MEMS — Medical Equipment Service Management", { width: 3120, fontSize: 17 }),
                cell("Client / stakeholders", { width: 3120, fontSize: 17 }),
                cell("Ready for review", { width: 3120, fontSize: 17, color: GREEN, bold: true }),
              ],
            }),
          ],
        }),
        spacer(220),

        callout(
          "Plain message for the client",
          "Your ERP PowerPoint blueprint and the live MEMS website already follow the same service idea. We do not need to rebuild the system or remove core modules. We will apply your marked corrections, clarify Repair → QA → Delivery with stage fields and staff ownership, set clear staff permission levels (including multiple permissions on one user when needed), and temporarily disable the Customer Portal as you requested. Staff day-to-day work continues on the same path — with clearer alignment to the PPT.",
          "EEF6F6",
          TEAL,
        ),

        h1("1. Purpose of this document"),
        p(
          "This report explains, in clear business language, how the current MEMS website compares with the client ERP MODEL presentation, what corrections we will make, whether the service flow will change, how Repair → QA → Delivery and staff permissions will work, and what remains for a later phase.",
        ),
        bullet("Confirm that the live system already covers most of the ERP scope."),
        bullet("List every client-marked correction from the PPT."),
        bullet("Explain Repair → QA → Delivery: who manages each stage, UI design, and fields that appear on update."),
        bullet("Explain staff permission levels and assigning more than one permission type to one staff member."),
        bullet("Show what we keep, improve, add, or disable."),
        bullet("Give practical examples of how each correction appears in the software."),

        h1("2. Bottom line — remove or redesign?"),
        h2("2.1 Do we remove large sections?"),
        p(
          "No. Core CRM, Service, Inventory, Purchase, Sales, Billing, Dashboard, and Reports stay. The only module you asked to turn off for now is the Customer Portal.",
        ),
        h2("2.2 Does the main workflow need a full redesign?"),
        p(
          "No. The MEMS service path already matches the PPT chain. Corrections improve forms, categories, communication, and portal visibility — they do not replace Receiving → Inspection → Estimate → Repair → QA → Delivery → Invoice.",
        ),

        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [2800, 1600, 4960],
          rows: [
            new TableRow({
              children: [
                headerCell("Topic", 2800),
                headerCell("Impact", 1600),
                headerCell("What it means for daily work", 4960),
              ],
            }),
            new TableRow({
              children: [
                cell("Disable Customer Portal", { width: 2800, fontSize: 17 }),
                statusCell("Low", 1600),
                cell("Staff flow unchanged. Customers use phone/email until portal returns.", { width: 4960, fontSize: 17 }),
              ],
            }),
            new TableRow({
              children: [
                cell("Additional fields (Customer / Job / Inspection)", { width: 2800, fontSize: 17 }),
                statusCell("Low", 1600),
                cell("More data on forms. Stage order stays the same.", { width: 4960, fontSize: 17 }),
              ],
            }),
            new TableRow({
              children: [
                cell("Spare Parts vs Consumables", { width: 2800, fontSize: 17 }),
                statusCell("Low", 1600),
                cell("Clearer stock categories when issuing or purchasing parts.", { width: 4960, fontSize: 17 }),
              ],
            }),
            new TableRow({
              children: [
                cell("Edit & delete job registration", { width: 2800, fontSize: 17 }),
                statusCell("Low–Medium", 1600),
                cell("Staff can correct or remove wrong registrations. Tickets already support this; jobs need UI completion.", { width: 4960, fontSize: 17 }),
              ],
            }),
            new TableRow({
              children: [
                cell("Inspection report via WhatsApp & Gmail", { width: 2800, fontSize: 17 }),
                statusCell("Medium", 1600),
                cell("New send actions on the report. Inspection → Estimate sequence does not change.", { width: 4960, fontSize: 17 }),
              ],
            }),
          ],
        }),

        h1("3. Service flow — current website vs PPT"),
        h2("3.1 PPT target chain"),
        p("Receiving → Inspection → Estimate → Repair → QA → Delivery → Invoice → Warranty", { bold: true }),
        h2("3.2 Current MEMS live chain"),
        p(
          "Ticket (New) → Inspection → Estimate → Pending approval → Assign engineer / Job → Final approval → Invoice → Payment → Closed",
          { bold: true },
        ),
        h2("3.3 After correction (aligned wording)"),
        p(
          "The stages stay. We align naming and completeness with the PPT so the client sees one clear story: register the job, inspect, quote, approve, repair with parts, quality check, deliver, invoice, and track warranty on the equipment.",
        ),
        callout(
          "Example — Rigid scope / endoscope-style repair (same story as PPT)",
          "Receive equipment and open a service ticket → capture condition and photos → complete inspection checklist and generate PDF → prepare estimate with parts and labour → customer or staff approval → technician repairs and issues stock → QA / final confirmation → delivery note and invoice → warranty dates recorded on the equipment. After correction, the inspection PDF can also be sent on WhatsApp and Gmail in one step.",
          LIGHT,
          NAVY,
        ),

        h2("3.4 Repair → QA → Delivery — how it works in real life (PPT alignment)"),
        p(
          "These three steps are separate jobs with different staff and different screens. They are not one button. When the job moves to the next step, that step’s fields appear on the UI.",
        ),

        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [1600, 1800, 2800, 3160],
          rows: [
            new TableRow({
              children: [
                headerCell("Stage", 1600),
                headerCell("Who manages", 1800),
                headerCell("UI / screen", 2800),
                headerCell("Fields that appear when updated", 3160),
              ],
            }),
            new TableRow({
              children: [
                cell("Repair", { width: 1600, bold: true, fontSize: 17 }),
                cell("Engineer / Technician", { width: 1800, fontSize: 17 }),
                cell("Job detail → Repair tab. Status: In Progress / Parts Pending.", { width: 2800, fontSize: 17 }),
                cell("Work done, parts used (stock issue), labour time, photos, technician notes. Button: Submit for QA.", { width: 3160, fontSize: 17 }),
              ],
            }),
            new TableRow({
              children: [
                cell("QA", { width: 1600, bold: true, fontSize: 17 }),
                cell("QA staff or Coordinator (preferably not the same engineer)", { width: 1800, fontSize: 17 }),
                cell("Same job → QA tab unlocks after Repair submit. Status: QA Pending / Review.", { width: 2800, fontSize: 17 }),
                cell("QA checklist pass/fail, final test results, final photos, QA name & signature. Pass → Delivery, Fail → back to Repair.", { width: 3160, fontSize: 17 }),
              ],
            }),
            new TableRow({
              children: [
                cell("Delivery", { width: 1600, bold: true, fontSize: 17 }),
                cell("Coordinator / Front desk", { width: 1800, fontSize: 17 }),
                cell("Same job → Delivery tab unlocks after QA Pass.", { width: 2800, fontSize: 17 }),
                cell("Delivery note, packing list, courier/hand-over, tracking, dispatch & delivery dates, customer acknowledgement. Then Ready for Invoice.", { width: 3160, fontSize: 17 }),
              ],
            }),
          ],
        }),
        spacer(120),
        callout(
          "Do fields appear when the stage is updated?",
          "Yes. Moving Repair → QA → Delivery opens that stage’s form fields. Previous stage data stays saved (audit history). Invoice and Warranty follow after Delivery is complete.",
          "EEF6F6",
          TEAL,
        ),
        spacer(120),
        p("Planned job screen stepper (PPT-style): Repair → QA → Delivery → Invoice. Each tab shows only that stage’s fields and only for staff with permission."),
        ...(workflowImageBuffer
          ? [
              spacer(80),
              new Paragraph({
                spacing: { after: 80 },
                children: [
                  new TextRun({
                    text: "Workflow diagram — full chain and Repair → QA → Delivery detail",
                    bold: true,
                    color: NAVY,
                    size: 18,
                    font: "Calibri",
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 160 },
                children: [
                  new ImageRun({
                    type: "png",
                    data: workflowImageBuffer,
                    transformation: { width: 620, height: 349 },
                    altText: {
                      title: "MEMS service workflow",
                      description: "Receiving through Warranty with Repair QA Delivery callout",
                      name: "workflow",
                    },
                  }),
                ],
              }),
            ]
          : []),
        h2("3.5 What we will do for Repair → QA → Delivery (like the PPT)"),
        bullet("Keep the MEMS job pipeline; rename and separate steps clearly as Repair, QA, and Delivery."),
        bullet("Build a complete job UI with step tabs and stage-specific fields (as in the table above)."),
        bullet("Unlock each next tab only when the previous stage is completed."),
        bullet("Record who did Repair, who did QA, and who confirmed Delivery (audit trail)."),
        bullet("After Delivery → Invoice → save Warranty dates on the equipment record."),

        h1("4. Staff roles & permissions (PPT-aligned)"),
        p(
          "Your ERP blueprint lists role-based access (Admin, Service Admin, Technician, QA, Sales, Purchase, Finance, Manager, Customer). MEMS already uses roles. We will strengthen this so staff work only on what they are allowed to see and do — matching the PPT security model.",
        ),
        h2("4.1 Different permission levels by staff type"),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [2200, 3580, 3580],
          rows: [
            new TableRow({
              children: [
                headerCell("Role level", 2200),
                headerCell("Typical access", 3580),
                headerCell("Flow stages they own", 3580),
              ],
            }),
            ...[
              ["Admin / Manager", "Full modules, users, settings, approvals override", "All stages; oversight"],
              ["Coordinator / Service Admin", "Tickets, assign jobs, delivery, customer contact", "Receiving, Approval, Delivery"],
              ["Inspector", "Inspections and reports", "Inspection"],
              ["Estimator", "Quotations and line items", "Estimate"],
              ["Engineer / Technician", "Assigned jobs, parts issue, work report", "Repair"],
              ["QA", "QA checklist and pass/fail (not own repair)", "QA"],
              ["Sales", "Sales orders, customers (sales path)", "Sales flow"],
              ["Purchase / Inventory", "Stock, PO, suppliers", "Parts support for Repair"],
              ["Finance / Billing", "Invoices and payments", "Invoice"],
              ["Customer (portal — later)", "Own equipment/status only", "Portal when re-enabled"],
            ].map(
              ([a, b, c]) =>
                new TableRow({
                  children: [
                    cell(a, { width: 2200, fontSize: 17, bold: true }),
                    cell(b, { width: 3580, fontSize: 17 }),
                    cell(c, { width: 3580, fontSize: 17 }),
                  ],
                }),
            ),
          ],
        }),
        h2("4.2 One staff member can hold more than one permission type"),
        p(
          "In real workshops, one person may wear two hats (for example Coordinator + QA, or Sales + Billing). The software will allow an administrator to assign multiple roles / permission sets to the same staff login — not only a single fixed role.",
        ),
        bullet("Admin opens Users → selects the staff member."),
        bullet("Adds one or more roles/permission packs (e.g. Engineer + Inventory, or Coordinator + QA)."),
        bullet("Menus and actions update to the combined access (union of allowed modules)."),
        bullet("Sensitive actions still follow rules (e.g. prefer different person for QA vs Repair when possible; Admin can configure exceptions)."),
        callout(
          "What we will do (permissions — as in the PPT)",
          "Keep and extend role-based access control (RBAC). Clear permission levels per role for Receiving, Inspection, Estimate, Repair, QA, Delivery, Invoice, Sales, Purchase, and Finance. Provide an option to attach multiple permission types to one staff user. Restrict menus, edit/delete, approvals, and stock/finance actions by permission. Keep an audit trail of who changed what — matching the PPT Security, Audit & Document Control section.",
          "FFF8F2",
          ACCENT,
        ),

        h1("5. Client-marked corrections (from your PPT)"),
        p("These items were specifically called out on the blueprint. They are our primary correction list."),

        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [700, 2800, 2200, 3660],
          rows: [
            new TableRow({
              children: [
                headerCell("#", 700),
                headerCell("Client request", 2800),
                headerCell("Action", 2200),
                headerCell("Software example after correction", 3660),
              ],
            }),
            new TableRow({
              children: [
                cell("1", { width: 700, bold: true, align: AlignmentType.CENTER }),
                cell("Additional fields on Customer Master", { width: 2800, fontSize: 17 }),
                statusCell("Add", 2200),
                cell("On Customer form: extra fields (e.g. branch, preferred contact, internal code) beyond name, VAT, addresses.", { width: 3660, fontSize: 17 }),
              ],
            }),
            new TableRow({
              children: [
                cell("2", { width: 700, bold: true, align: AlignmentType.CENTER }),
                cell("Part categories: Spare Parts and Consumables", { width: 2800, fontSize: 17 }),
                statusCell("Improve", 2200),
                cell("Every stock item tagged Spare Part or Consumable; filters and reports respect both.", { width: 3660, fontSize: 17 }),
              ],
            }),
            new TableRow({
              children: [
                cell("3", { width: 700, bold: true, align: AlignmentType.CENTER }),
                cell("Additional fields on Job Registration", { width: 2800, fontSize: 17 }),
                statusCell("Add", 2200),
                cell("When creating a ticket/job: optional extra fields for site notes, accessories received, etc.", { width: 3660, fontSize: 17 }),
              ],
            }),
            new TableRow({
              children: [
                cell("4", { width: 700, bold: true, align: AlignmentType.CENTER }),
                cell("Edit and delete on Job Registration", { width: 2800, fontSize: 17 }),
                statusCell("Improve", 2200),
                cell("Authorized staff can edit wrong details or delete a mistaken registration (with confirmation).", { width: 3660, fontSize: 17 }),
              ],
            }),
            new TableRow({
              children: [
                cell("5", { width: 700, bold: true, align: AlignmentType.CENTER }),
                cell("Additional fields on Inspection report", { width: 2800, fontSize: 17 }),
                statusCell("Add", 2200),
                cell("Inspection form includes extra client-required fields next to findings, photos, recommendation.", { width: 3660, fontSize: 17 }),
              ],
            }),
            new TableRow({
              children: [
                cell("6", { width: 700, bold: true, align: AlignmentType.CENTER }),
                cell("Send Inspection Report via WhatsApp and Gmail", { width: 2800, fontSize: 17 }),
                statusCell("Add", 2200),
                cell("On Inspection Report: buttons Send WhatsApp and Send Gmail/Email with PDF attached or linked.", { width: 3660, fontSize: 17 }),
              ],
            }),
            new TableRow({
              children: [
                cell("7", { width: 700, bold: true, align: AlignmentType.CENTER }),
                cell("Customer Portal — for future, disable now", { width: 2800, fontSize: 17 }),
                statusCell("Disable", 2200),
                cell("Portal login and menus turned off. Staff ERP continues. Portal re-enabled in a later phase.", { width: 3660, fontSize: 17 }),
              ],
            }),
          ],
        }),

        h1("6. Module status — website today vs ERP PPT"),
        p("Honest status so the client can see what is already working and what only needs correction."),

        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [2400, 1400, 5560],
          rows: [
            new TableRow({
              children: [
                headerCell("Module", 2400),
                headerCell("Status", 1400),
                headerCell("Notes", 5560),
              ],
            }),
            ...[
              ["CRM / Customers", "Done", "Live register and customer 360. Extra fields still to add."],
              ["Equipment master", "Done", "Assets, serials, warranty/AMC fields present."],
              ["Service tickets & jobs", "Done", "Core operations match PPT service focus."],
              ["Inspection + PDF", "Done", "Checklist and PDF exist; WhatsApp/Gmail send missing."],
              ["Estimate / quotation", "Done", "Builder, revisions, approval path live."],
              ["Technician / repair jobs", "Done", "Workbench, parts, photos, statuses live."],
              ["Inventory & stock", "Done", "Issue, ledger, transfers; tighten Spare vs Consumable."],
              ["Purchasing", "Done", "Suppliers, purchase requests, POs, returns."],
              ["Sales", "Done", "Counter sales, delivery, sale invoices."],
              ["Finance / billing", "Done", "Service & sale invoices, payments (not full accounting GL)."],
              ["Warranty management", "Partial", "Equipment warranty fields + AMC backend; dedicated staff screen to strengthen."],
              ["Customer Portal", "Disable", "Built and live today — will be disabled per your PPT note."],
              ["Dashboard & reports", "Done", "KPIs and operational reports available."],
              ["Notifications", "Partial", "In-app alerts exist; broad WhatsApp/email automation is later."],
              ["Roles & permissions", "Improve", "Roles exist; strengthen levels + multi-permission per staff (PPT RBAC)."],
              ["Repair / QA / Delivery split", "Improve", "Clarify separate stages, fields, and staff ownership on job UI."],
            ].map(
              ([m, s, n]) =>
                new TableRow({
                  children: [
                    cell(m, { width: 2400, fontSize: 17, bold: true }),
                    statusCell(s, 1400),
                    cell(n, { width: 5560, fontSize: 17 }),
                  ],
                }),
            ),
          ],
        }),

        h1("7. What we keep (no removal)"),
        bullet("Service as the operational core — tickets, inspection, estimate, jobs, billing."),
        bullet("Shared masters — customers, equipment, parts used across service and sales."),
        bullet("Inventory, purchasing, sales, and receivables already connected to the same data."),
        bullet("Roles, audit trail, PDF documents, and management dashboards."),
        p(
          "Removing these would reduce value and move away from your ERP blueprint. We keep them.",
          { muted: true, italics: true },
        ),

        h1("8. What we disable or defer"),
        h2("8.1 Disable now"),
        bullet("Customer Portal — visibility and self-approval for customers (as marked: “for future, disable now”)."),
        h2("8.2 Later / advanced (not removed from the vision)"),
        bullet("Full WhatsApp and email automation for every job event (beyond inspection report send)."),
        bullet("Supplier portal, predictive maintenance, deep accounting/ERP GL integration."),
        bullet("Extra advanced analytics beyond current reports."),
        p(
          "These stay on the roadmap. They are not part of the immediate correction list from your PPT notes.",
          { muted: true, italics: true },
        ),

        h1("9. Correction examples — how the software will feel"),
        h2("9.1 Customer Master — additional fields"),
        p(
          "Today: create customer with legal name, contacts, VAT, addresses, payment terms. After correction: the same screen accepts extra client-defined fields so hospital/dealer-specific data is stored once and reused on tickets and invoices.",
        ),
        h2("9.2 Inventory — Spare Parts and Consumables"),
        p(
          "Today: items sit in taxonomy categories (including Consumables). After correction: every part is clearly Spare Part or Consumable so purchasing, stock issue to a job, and reports match the PPT language.",
        ),
        h2("9.3 Job registration — edit and delete"),
        p(
          "Today: service tickets can be edited/deleted by authorized roles; job delete is not fully exposed in the staff UI. After correction: if a registration was opened with the wrong serial or customer, staff can correct it or remove it safely with confirmation — matching your PPT note.",
        ),
        h2("9.4 Inspection — extra fields + WhatsApp / Gmail"),
        p(
          "Today: inspector completes findings, photos, recommendation, and downloads/prints PDF. After correction: additional fields appear on the report, and staff can send the finished report directly to the customer via WhatsApp and Gmail without leaving MEMS.",
        ),
        h2("9.5 Customer Portal — disabled"),
        p(
          "Today: customers can log into /portal for equipment, estimates, and history. After correction: that entry is disabled. Approvals and communication continue through staff process (and WhatsApp/Gmail for inspection reports) until the portal phase returns.",
        ),
        h2("9.6 Repair → QA → Delivery screens"),
        p(
          "Today: repair work and final confirmation are partly combined. After correction: clear Repair, QA, and Delivery tabs with stage fields, staff ownership, and unlock rules — as described in section 3.4.",
        ),
        h2("9.7 Permissions — levels and multi-role staff"),
        p(
          "Today: users have roles that control menus. After correction: clearer permission levels per PPT role, plus the option to give one staff member more than one permission type when their real job needs it.",
        ),

        h1("10. Recommended implementation order"),
        new Paragraph({
          numbering: { reference: "steps", level: 0 },
          spacing: { after: 80 },
          children: [new TextRun({ text: "Disable Customer Portal (as requested).", size: 20, font: "Calibri", color: "243447" })],
        }),
        new Paragraph({
          numbering: { reference: "steps", level: 0 },
          spacing: { after: 80 },
          children: [new TextRun({ text: "Apply Spare Parts vs Consumables categories.", size: 20, font: "Calibri", color: "243447" })],
        }),
        new Paragraph({
          numbering: { reference: "steps", level: 0 },
          spacing: { after: 80 },
          children: [new TextRun({ text: "Complete job registration edit/delete in the staff screens.", size: 20, font: "Calibri", color: "243447" })],
        }),
        new Paragraph({
          numbering: { reference: "steps", level: 0 },
          spacing: { after: 80 },
          children: [new TextRun({ text: "Add additional fields on Customer, Job, then Inspection.", size: 20, font: "Calibri", color: "243447" })],
        }),
        new Paragraph({
          numbering: { reference: "steps", level: 0 },
          spacing: { after: 80 },
          children: [new TextRun({ text: "Separate Repair → QA → Delivery UI with stage fields (PPT flow).", size: 20, font: "Calibri", color: "243447" })],
        }),
        new Paragraph({
          numbering: { reference: "steps", level: 0 },
          spacing: { after: 80 },
          children: [new TextRun({ text: "Strengthen staff permission levels and multi-permission assignment per user.", size: 20, font: "Calibri", color: "243447" })],
        }),
        new Paragraph({
          numbering: { reference: "steps", level: 0 },
          spacing: { after: 80 },
          children: [new TextRun({ text: "Enable Inspection Report send via WhatsApp and Gmail.", size: 20, font: "Calibri", color: "243447" })],
        }),
        new Paragraph({
          numbering: { reference: "steps", level: 0 },
          spacing: { after: 140 },
          children: [new TextRun({ text: "Review with client, then plan later-phase portal and automation.", size: 20, font: "Calibri", color: "243447" })],
        }),

        h1("11. Message you can share with stakeholders"),
        callout(
          "Suggested client statement",
          "We reviewed your ERP MODEL presentation against the live MEMS system. The operational core already matches your blueprint. We will not remove the main modules. We will apply your marked corrections — additional fields, spare/consumable categories, job edit-delete, WhatsApp/Gmail for inspection reports — clarify Repair → QA → Delivery with stage fields and staff ownership, strengthen role permission levels (including multiple permissions on one staff user as needed), and disable the Customer Portal until a later phase. Daily operations stay stable while the product lines up with your PPT.",
          "FFF8F2",
          ACCENT,
        ),
        spacer(200),

        h1("12. Closing"),
        p(
          "MEMS is already a working Medical Equipment Service & Sales platform. Your PPT confirms the target architecture and highlights a clear correction list — including flow completeness (Repair, QA, Delivery), permissions, and the portal pause. This document is the shared agreement of what we keep, what we correct, what we disable now, and how staff and stages will work.",
        ),
        p("Prepared for client review from the ERP MODEL (1).pptx blueprint and the current MEMS website.", {
          muted: true,
          italics: true,
        }),
        spacer(120),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [9360],
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  borders: noBorders,
                  width: { size: 9360, type: WidthType.DXA },
                  shading: { type: ShadingType.CLEAR, fill: NAVY },
                  margins: { top: 160, bottom: 160, left: 220, right: 220 },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new TextRun({
                          text: "MEMS  ·  Service-first ERP alignment  ·  Confidential client report",
                          color: WHITE,
                          size: 17,
                          font: "Calibri",
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    },
  ],
});

const outPath = new URL("./CLIENT_ERP_ALIGNMENT_CORRECTION_REPORT.docx", import.meta.url);
const buffer = await Packer.toBuffer(doc);
fs.writeFileSync(outPath, buffer);
console.log("Wrote", outPath.pathname);
if (workflowImagePath) console.log("Embedded workflow image from", workflowImagePath);
else console.log("WARNING: workflow image not found — document generated without diagram");
