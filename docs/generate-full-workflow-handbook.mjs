/**
 * MESMS Complete Client User Guide (colourful DOCX)
 * Run: node docs/generate-full-workflow-handbook.mjs
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
const OUT = path.resolve(__dirname, "MESMS_COMPLETE_CLIENT_USER_GUIDE.docx");

const workflowImageCandidates = [
  path.resolve(__dirname, "mems-service-workflow-repair-qa-delivery.png"),
];
const workflowImagePath = workflowImageCandidates.find((p) => fs.existsSync(p));
const workflowImageBuffer = workflowImagePath ? fs.readFileSync(workflowImagePath) : null;

const NAVY = "0F172A";
const TEAL = "0D9488";
const ACCENT = "0284C7";
const LIGHT = "F8FAFC";
const SOFT = "E2E8F0";
const GREEN = "1F6B3A";
const AMBER = "8A5A00";
const RED = "8B2E2E";
const MUTED = "5A6A7A";
const WHITE = "FFFFFF";
const BLUE = "1A4A8A";
const VIOLET = "5B21B6";
const INDIGO = "3730A3";
const EMERALD = "047857";

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
    fontSize = 17,
  } = opts;
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill },
    margins: { top: 70, bottom: 70, left: 100, right: 100 },
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

function headerCell(text, width = 2200, fill = NAVY) {
  return cell(text, { bold: true, fill, color: WHITE, width, align: AlignmentType.LEFT, fontSize: 16 });
}

function rolePill(role, width = 1400) {
  const map = {
    Admin: { fill: "1A1A2E", color: WHITE },
    Coordinator: { fill: "0F4C75", color: WHITE },
    Inspector: { fill: "F59E0B", color: "1A1A1A" },
    Estimator: { fill: "7C3AED", color: WHITE },
    Engineer: { fill: "0D9488", color: WHITE },
    Inventory: { fill: "2563EB", color: WHITE },
    Billing: { fill: "059669", color: WHITE },
    Sales: { fill: "DB2777", color: WHITE },
    Customer: { fill: "64748B", color: WHITE },
    Yes: { fill: "E6F4EA", color: GREEN },
    No: { fill: "FCE8E8", color: RED },
    Optional: { fill: "FFF4DF", color: AMBER },
    Required: { fill: "E8F1FF", color: BLUE },
    View: { fill: SOFT, color: MUTED },
    Update: { fill: "DCFCE7", color: EMERALD },
    Create: { fill: "DBEAFE", color: BLUE },
    Approve: { fill: "F3E8FF", color: VIOLET },
  };
  const s = map[role] || { fill: SOFT, color: NAVY };
  return cell(role, { bold: true, fill: s.fill, color: s.color, width, align: AlignmentType.CENTER, fontSize: 15 });
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

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text, bold: true, color: ACCENT, size: 21, font: "Calibri" })],
  });
}

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120, line: 276 },
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
    spacing: { after: 70, line: 276 },
    children: [new TextRun({ text, color: "243447", size: 19, font: "Calibri" })],
  });
}

function step(text) {
  return new Paragraph({
    numbering: { reference: "steps", level: 0 },
    spacing: { after: 70, line: 276 },
    children: [new TextRun({ text, color: "243447", size: 19, font: "Calibri" })],
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
            margins: { top: 120, bottom: 120, left: 180, right: 180 },
            children: [
              new Paragraph({
                spacing: { after: 50 },
                children: [new TextRun({ text: title, bold: true, color: titleColor, size: 19, font: "Calibri" })],
              }),
              new Paragraph({
                spacing: { after: 0, line: 276 },
                children: [new TextRun({ text: body, color: "243447", size: 18, font: "Calibri" })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function spacer(after = 140) {
  return new Paragraph({ spacing: { after }, children: [] });
}

function simpleTable(headers, rows, widths) {
  const w = widths || headers.map(() => Math.floor(9360 / headers.length));
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: w,
    rows: [
      new TableRow({
        children: headers.map((h, i) => headerCell(h, w[i], i === 0 ? NAVY : TEAL)),
      }),
      ...rows.map((row, ri) =>
        new TableRow({
          children: row.map((c, ci) =>
            cell(c, {
              width: w[ci],
              fill: ri % 2 === 0 ? WHITE : LIGHT,
              fontSize: 16,
              bold: ci === 0,
            }),
          ),
        }),
      ),
    ],
  });
}

function stageBanner(num, title, color, subtitle) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [900, 8460],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: noBorders,
            width: { size: 900, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: color },
            margins: { top: 100, bottom: 100, left: 80, right: 80 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: String(num), bold: true, color: WHITE, size: 28, font: "Calibri" })],
              }),
            ],
          }),
          new TableCell({
            borders: noBorders,
            width: { size: 8460, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: LIGHT },
            margins: { top: 100, bottom: 100, left: 160, right: 160 },
            children: [
              new Paragraph({
                spacing: { after: 20 },
                children: [new TextRun({ text: title, bold: true, color: NAVY, size: 22, font: "Calibri" })],
              }),
              new Paragraph({
                children: [new TextRun({ text: subtitle, color: MUTED, size: 17, font: "Calibri" })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
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
              spacing: { after: 100 },
              children: [
                new TextRun({ text: "MESMS  ·  Medical Equipment Service Management", bold: true, color: NAVY, size: 15, font: "Calibri" }),
                new TextRun({ text: "     |     Complete Client User Guide", color: MUTED, size: 15, font: "Calibri" }),
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
                new TextRun({ text: "Client user guide  ·  Page ", color: MUTED, size: 14, font: "Calibri" }),
                new TextRun({ children: [PageNumber.CURRENT], color: MUTED, size: 14, font: "Calibri" }),
                new TextRun({ text: " of ", color: MUTED, size: 14, font: "Calibri" }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], color: MUTED, size: 14, font: "Calibri" }),
              ],
            }),
          ],
        }),
      },
      children: [
        // ===== COVER =====
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
                  margins: { top: 400, bottom: 400, left: 360, right: 360 },
                  children: [
                    new Paragraph({
                      spacing: { after: 120 },
                      children: [new TextRun({ text: "MESMS", bold: true, color: "5EEAD4", size: 56, font: "Calibri" })],
                    }),
                    new Paragraph({
                      spacing: { after: 200 },
                      children: [
                        new TextRun({
                          text: "Complete Client User Guide",
                          bold: true,
                          color: WHITE,
                          size: 32,
                          font: "Calibri",
                        }),
                      ],
                    }),
                    new Paragraph({
                      spacing: { after: 80 },
                      children: [
                        new TextRun({
                          text: "Features · pages · permissions · workflows · mobile use · administration",
                          color: "A8C5D8",
                          size: 20,
                          font: "Calibri",
                        }),
                      ],
                    }),
                    new Paragraph({
                      children: [
                        new TextRun({ text: "Audience:  ", color: "5EEAD4", size: 18, font: "Calibri", bold: true }),
                        new TextRun({
                          text: "Clients · Owners · Administrators · Coordinators · All staff roles",
                          color: WHITE,
                          size: 18,
                          font: "Calibri",
                        }),
                      ],
                    }),
                    new Paragraph({
                      spacing: { before: 80 },
                      children: [
                        new TextRun({ text: "Updated:  ", color: "5EEAD4", size: 18, font: "Calibri", bold: true }),
                        new TextRun({ text: "22 September 2026  ·  Verified against the current application", color: WHITE, size: 18, font: "Calibri" }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
        spacer(200),
        callout(
          "How to use this handbook",
          "Start with Sections 1–2 for orientation, Section 5 for permissions, and Section 6 for every page. Use the arrow workflows for training, then give each employee the daily playbook for their role.",
          "E0F2F1",
          TEAL,
        ),
        spacer(160),

        // ===== CONTENTS =====
        h1("Contents"),
        bullet("1. What MESMS does & login areas"),
        bullet("2. Complete service workflow (ticket → job → invoice)"),
        bullet("3. Fields & statuses at each stage"),
        bullet("4. Work assignment (required vs optional) — which pages"),
        bullet("5. Roles, module permissions & action rights"),
        bullet("6. Page-by-page actions (full list)"),
        bullet("7. Sales, inventory, billing workflows"),
        bullet("8. Roles & daily playbooks"),
        bullet("9. Mobile use & customer portal status"),
        bullet("10. Setup, onboarding, support & glossary"),

        // ===== 1 =====
        h1("1. What MESMS does & login areas"),
        p("MESMS runs a medical-equipment service company in one place: customer and equipment records, service tickets, inspections, estimates, field jobs, product sales, inventory, purchasing, billing, reporting, and administration."),
        simpleTable(
          ["Area", "Business purpose"],
          [
            ["Service", "Repair / maintenance: inspect → quote → approve → Repair → QA → Delivery → invoice"],
            ["Sales", "Product / spare counter sales: order → deliver stock → invoice"],
            ["Supply chain", "Inventory, suppliers, POs, transfers, returns, ledger"],
            ["Admin", "Users, settings, auto-assign, RBAC menus, audit, master data"],
          ],
          [2800, 6560],
        ),
        spacer(120),
        simpleTable(
          ["Login", "Path", "Who"],
          [
            ["Staff app", "/app", "All staff roles"],
            ["Customer portal", "/portal", "Future use — currently disabled"],
          ],
          [2400, 2800, 4160],
        ),
        spacer(100),
        callout(
          "Rule",
          "Staff use /app. The Customer Portal is currently disabled: /portal redirects to login and customer-role sign-in is rejected. One person may hold several staff roles; the primary role sets the dashboard layout.",
          "FFF4DF",
          AMBER,
        ),

        // ===== 2 =====
        h1("2. Complete service workflow"),
        p("Nobody skips a stage. Create Request may optionally assign an Inspection Technician only — not engineer or estimator. Later stages use Assign / Reassign, estimate approval, or auto-assign."),
        spacer(80),
        stageBanner(1, "NEW TICKET (Intake)", BLUE, "Page: Service Tickets → Create Request  ·  Owner: Coordinator / Admin"),
        spacer(60),
        stageBanner(2, "INSPECTION", "B45309", "Page: Inspections / Ticket  ·  Owner: assigned Inspector"),
        spacer(60),
        stageBanner(3, "ESTIMATE", VIOLET, "Page: Estimates / Builder  ·  Owner: Estimate Staff"),
        spacer(60),
        stageBanner(4, "PENDING APPROVAL", ACCENT, "Page: Estimate detail / Ticket  ·  Owner: Admin / Coordinator"),
        spacer(60),
        stageBanner(5, "ASSIGNED ENGINEER → JOB", TEAL, "Page: Service Jobs  ·  Repair → QA → Delivery"),
        spacer(60),
        stageBanner(6, "BILLING → CLOSED", EMERALD, "Page: Billing  ·  Owner: Billing / Admin"),
        spacer(140),

        h2("2.1 Ticket status chain (canonical)"),
        p("new → inspection → estimate → pending_approval → assigned_engineer ↔ change_pending_approval → pending_final_approval → pending_invoice → invoiced → closed", { bold: true, size: 18 }),
        spacer(80),
        simpleTable(
          ["From", "To", "Who may move"],
          [
            ["new", "inspection", "Admin, Coordinator, Inspector"],
            ["inspection", "estimate", "Admin, Coordinator, Inspector (submit report)"],
            ["estimate", "pending_approval", "Admin, Coordinator, Estimator (send estimate)"],
            ["pending_approval", "assigned_engineer", "Admin, Coordinator (approve + engineer)"],
            ["assigned_engineer", "change_pending / final approval", "Admin, Coordinator, Engineer"],
            ["pending_final_approval", "pending_invoice", "Admin, Billing (confirm work)"],
            ["pending_invoice", "invoiced", "Admin, Billing"],
            ["invoiced", "closed", "Admin, Coordinator, Billing"],
          ],
          [2200, 3200, 3960],
        ),
        spacer(120),

        h2("2.2 Job workflow (after estimate approved)"),
        p("Inside the Service Job, work follows three field stages before billing:"),
        bullet("Repair — engineer field work, parts, work report, photos"),
        bullet("QA — coordinator/admin quality check (pass → Delivery; fail → back to Repair)"),
        bullet("Delivery — confirm handoff to customer → job Completed → Billing"),
        spacer(80),
        ...(workflowImageBuffer
          ? [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 120 },
                children: [
                  new ImageRun({
                    type: "png",
                    data: workflowImageBuffer,
                    transformation: { width: 540, height: 280 },
                    altText: { title: "Job workflow", description: "Repair QA Delivery", name: "workflow" },
                  }),
                ],
              }),
            ]
          : []),
        simpleTable(
          ["Job status", "Stage", "Meaning"],
          [
            ["scheduled", "Repair", "Engineer has the job; not started"],
            ["inProgress", "Repair", "Work underway"],
            ["partsPending", "Repair", "Blocked waiting for parts"],
            ["review", "QA", "Work submitted; waiting coordinator/admin QA"],
            ["delivery", "Delivery", "QA passed; confirm customer handoff"],
            ["completed", "Done", "Job finished; ready for billing"],
          ],
          [2200, 1800, 5360],
        ),
        spacer(100),
        callout(
          "Change request loop",
          "If the approved estimate is not enough, the engineer requests extra products/equipment. Ticket → change_pending_approval. Admin/Coordinator approve or reject → back to assigned_engineer. Then engineer continues Repair → QA → Delivery.",
          "F3E8FF",
          VIOLET,
        ),

        // ===== 3 =====
        h1("3. Fields & statuses at each stage"),
        h2("3.1 Create Request fields"),
        simpleTable(
          ["Field", "Required?", "Notes"],
          [
            ["Customer", "Required", "Must exist first (Customers)"],
            ["Equipment (1 or more)", "Required", "Registered to that customer"],
            ["Type", "Required", "Repair / Maintenance / Calibration / Inspection / Installation / Other"],
            ["Priority", "Required", "low / medium / high / critical"],
            ["Description", "Required", "Problem / request text"],
            ["Inspection Technician", "Optional", "Only role assignable at create; blank OK if auto-assign on"],
          ],
          [2800, 1600, 4960],
        ),
        spacer(120),
        h2("3.2 Assignment fields stored on ticket"),
        simpleTable(
          ["Field", "When set", "Page"],
          [
            ["Assigned person (current)", "Any assign / reassign", "Ticket detail → Assign / Reassign"],
            ["Assigned inspector", "Create or assign", "Create Request / Assign"],
            ["Assigned estimator", "After inspection / assign", "Assign estimate staff / auto-assign"],
            ["Assigned engineer", "Estimate approval", "Approve estimate (+ optional schedule)"],
          ],
          [2600, 3000, 3760],
        ),
        spacer(120),
        h2("3.3 Inspection report fields"),
        bullet("Severity, findings, recommendation"),
        bullet("Photos / attachments"),
        bullet("Submit → ticket moves to Estimate; coordinator notified"),
        spacer(80),
        h2("3.4 Estimate fields"),
        bullet("Labor lines (catalog) + parts lines (inventory)"),
        bullet("Draft → Send for approval → pending_approval"),
        bullet("Approve: pick engineer + optional schedule → job created"),
        bullet("Reject: back to Estimate or Inspection with reason"),
        spacer(80),
        h2("3.5 Job detail fields (Repair / QA / Delivery)"),
        simpleTable(
          ["Block", "Fields / actions", "Who updates"],
          [
            ["Registration", "Type, engineer, schedule, optional notes", "Admin, Coordinator, Engineer"],
            ["Work report", "Work performed, testing, calibration, recommendation, photos", "Engineer (Admin)"],
            ["Parts / stock", "Deduct inventory; shortage / SPR path", "Engineer"],
            ["Extras request", "Additional product / equipment lines", "Engineer → Admin/Coord review"],
            ["QA stage", "Pass/fail, notes, checked by/at", "Admin, Coordinator"],
            ["Delivery stage", "Method, received by, note, delivered at", "Admin, Coordinator"],
          ],
          [2200, 4200, 2960],
        ),

        // ===== 4 =====
        h1("4. Work assignment — which pages"),
        callout(
          "Who can assign",
          "Only Administrator and Service Coordinator may Assign / Reassign staff on tickets. Engineers, inspectors, and estimators receive work — they do not reassign the ticket to others.",
          "E8F1FF",
          BLUE,
        ),
        spacer(120),
        h2("4.1 Assignment moments"),
        simpleTable(
          ["When", "What you assign", "Page", "Optional?"],
          [
            ["Create Request", "Inspection Technician only", "Service Tickets → Create", "Optional"],
            ["Ticket open", "Any staff role (inspector, estimator, engineer, inventory, billing, coordinator)", "Ticket detail → Assign / Reassign", "As needed"],
            ["Ready to quote", "Estimate staff", "Ticket → Assign estimate staff", "Optional if auto-assign"],
            ["Approve estimate", "Service Engineer + schedule", "Estimate detail / Ticket review", "Engineer required; schedule optional"],
            ["Auto-assignment", "Defaults from Settings", "Settings → Service auto-assignment", "Switches optional"],
            ["Projects staffing", "Lead / staff on a job", "Projects → job", "Optional staffing view"],
          ],
          [2000, 2800, 2800, 1760],
        ),
        spacer(120),
        h2("4.2 Auto-assignment switches (Admin → Settings)"),
        simpleTable(
          ["Switch", "When it fires", "Result"],
          [
            ["Auto-assign inspection technician", "New ticket, nobody assigned", "Default inspector set"],
            ["Route coordinator after inspection", "Inspection submitted", "Coordinator notified / may become assignee"],
            ["Auto-assign estimate staff after inspection", "Inspection submitted", "Estimator assigned; ticket in Estimate"],
            ["Auto-assign engineer on estimate approval", "Approved without picking engineer", "Default engineer used"],
          ],
          [3200, 3000, 3160],
        ),
        spacer(100),
        callout(
          "Recommended setup",
          "Set defaults for Coordinator, Inspector, Estimator, Engineer. Turn ON auto-inspector and auto-estimator. Leave engineer auto-assign OFF unless one engineer always takes every job.",
          "E6F4EA",
          GREEN,
        ),
        spacer(120),
        h2("4.3 Where each role finds assigned work"),
        simpleTable(
          ["Role", "Primary pages"],
          [
            ["Inspection Technician", "Dashboard · Inspections · Mobile Inspect"],
            ["Estimate Staff", "Estimates · tickets in Estimate stage"],
            ["Service Engineer", "Service Jobs · Job detail · Mobile Jobs"],
            ["Coordinator", "Full ticket/job queues · approvals · QA · Delivery confirm"],
            ["Inventory", "Stock purchase requests · sales to deliver · Inventory"],
            ["Billing", "Billing queues · completed jobs"],
            ["Sales", "Sales desk"],
          ],
          [2800, 6560],
        ),

        // ===== 5 =====
        h1("5. Roles, module permissions & action rights"),
        p("MESMS uses three access layers: the tenant RBAC matrix controls which modules appear; staff roles control protected actions; and a per-user permission set can hide modules or make the whole account read-only."),
        spacer(80),
        h2("5.1 Default module visibility"),
        simpleTable(
          ["Navigation module", "Roles with default access"],
          [
            ["Dashboard", "All eight staff roles"],
            ["Sales", "Admin, Sales, Billing, Inventory"],
            ["Sales Enquiries", "Admin, Sales, Coordinator, Billing"],
            ["Customers", "Admin, Coordinator, Estimator, Sales, Billing"],
            ["Equipment", "Admin, Coordinator, Inspector, Engineer, Inventory"],
            ["Service Tickets", "Admin, Coordinator, Inspector, Estimator, Engineer, Sales"],
            ["Inspections", "Admin, Coordinator, Inspector"],
            ["Estimates", "Admin, Coordinator, Estimator, Billing"],
            ["Service Jobs", "Admin, Coordinator, Engineer"],
            ["Projects", "Admin, Coordinator"],
            ["Service Catalog", "Admin, Coordinator, Estimator"],
            ["Warranty Claims", "Admin, Coordinator, Inspector, Estimator, Engineer, Sales"],
            ["Inventory Items / Stock Purchase Requests", "Admin, Inventory, Engineer"],
            ["Suppliers / Purchase Orders / Returns / Ledger", "Admin, Inventory"],
            ["Supplier RFQs", "Admin, Inventory, Coordinator, Billing"],
            ["Billing / Expenses & Commissions", "Admin, Billing"],
            ["Reports", "Admin, Billing, Coordinator"],
            ["Notifications", "All eight staff roles"],
            ["QR Tracking", "Admin, Coordinator, Inspector, Engineer, Inventory"],
            ["Audit Logs / Users / Office Assets / Settings", "Admin"],
            ["Master Data", "Admin, Coordinator"],
          ],
          [3800, 5560],
        ),
        spacer(100),
        callout(
          "How administrators change access",
          "Open Settings → RBAC — Module Access Matrix. A module grant controls menu and route visibility; it does not override protected action roles. In Users, Permission set = Read blocks every save/change request. A per-module value of None hides that module for the selected user.",
          "E8F1FF",
          BLUE,
        ),
        spacer(120),
        h2("5.2 Action rights (API / product rules)"),
        simpleTable(
          ["Action", "Who may do it"],
          [
            ["Users, Settings, RBAC, demo seed, audit", "Administrator"],
            ["Create / edit customers", "Admin, Coordinator, Estimator, Sales"],
            ["Create / edit equipment", "Admin, Coordinator, Inventory"],
            ["Create tickets, assign, reopen, delete", "Admin, Coordinator"],
            ["Write / submit inspection reports", "Admin, Coordinator, Inspector"],
            ["Build / send estimates", "Admin, Coordinator, Estimator"],
            ["Approve / reject estimates; pick engineer", "Admin, Coordinator (+ portal customer decision if enabled)"],
            ["Update jobs; work report; stock deduct", "Admin, Coordinator, Engineer"],
            ["QA pass/fail; Delivery confirm; complete job", "Admin, Coordinator"],
            ["Inventory write, POs, transfers, returns", "Admin, Inventory"],
            ["Force stock adjustment", "Administrator only"],
            ["Record product sale", "Admin, Sales"],
            ["Deliver sale (stock out)", "Admin, Inventory"],
            ["Sale invoice / payment", "Admin, Billing, Sales"],
            ["Service invoices", "Admin, Billing"],
            ["Master data page", "Admin, Coordinator"],
            ["Upload files / notifications", "All staff roles"],
          ],
          [4200, 5160],
        ),
        spacer(120),
        h2("5.3 Page update cheat-sheet"),
        p("Update = create, edit, submit, approve, or status change on that page. View = read-only for that role."),
        spacer(60),
        simpleTable(
          ["Page", "Admin", "Coord", "Insp", "Est", "Eng", "Inv", "Bill", "Sales"],
          [
            ["Dashboard", "View", "View", "View", "View", "View", "View", "View", "View"],
            ["Customers", "Update", "Update", "—", "Update", "—", "—", "View", "Update"],
            ["Equipment", "Update", "Update", "View", "—", "View", "Update", "—", "—"],
            ["Service Tickets", "Update", "Update", "View*", "View*", "View*", "—", "—", "View"],
            ["Inspections", "Update", "Update", "Update", "—", "—", "—", "—", "—"],
            ["Estimates", "Approve", "Approve", "—", "Update", "—", "—", "View", "—"],
            ["Service Jobs", "Update", "Approve", "—", "—", "Update", "—", "—", "—"],
            ["Projects", "Update", "Update", "—", "—", "—", "—", "—", "—"],
            ["Inventory / PO / SPR", "Update", "—", "—", "—", "View*", "Update", "—", "—"],
            ["Sales", "Update", "—", "—", "—", "—", "Deliver", "Bill", "Update"],
            ["Billing", "Update", "—", "—", "—", "—", "—", "Update", "—"],
            ["Reports", "View", "View", "—", "—", "—", "—", "View", "—"],
            ["Users / Settings / Audit", "Update", "—", "—", "—", "—", "—", "—", "—"],
            ["Master Data", "Update", "Update", "—", "—", "—", "—", "—", "—"],
          ],
          [2000, 920, 920, 820, 820, 820, 920, 920, 920],
        ),
        spacer(80),
        p("* Read-only accounts are enforced by the server for all changes, although some pages may still display an action button before the request is refused. Inspectors, estimators, and engineers mainly act on assigned work.", { muted: true, italics: true, size: 17 }),

        // ===== 6 =====
        h1("6. Page-by-page actions (full list)"),
        p("Every staff screen: path, purpose, and all actions you can perform."),

        h2("6.1 Dashboard  ·  /app"),
        bullet("View role KPIs, work-status pipeline, personal queue, charts, shortcuts, and alerts"),
        bullet("Admin/Coordinator: quick Create ticket"),
        bullet("Jump to assigned inspections, estimates, jobs, billing"),

        h2("6.2 Sales & Sales Enquiries"),
        bullet("Sales /app/sales — KPIs, sold items, reports, recent sales, top products, and New sale"),
        bullet("Sales order detail — lines, delivery, packing, invoice, payment, and print actions"),
        bullet("Sales Enquiries /app/sales-enquiries — leads, priority, follow-up, status, notes, create/edit, and conversion reference"),
        bullet("Enquiry statuses: Open → Quoted → Converted, or Lost"),
        bullet("Who manages enquiries: Admin, Sales, Coordinator"),

        h2("6.3 Customers  ·  /app/customers"),
        bullet("Search / filter by type & status"),
        bullet("Add Customer (name, type, contact, address, additional fields, status, notes)"),
        bullet("Open Customer Detail: overview, commercial terms, equipment, tickets, jobs, estimates, invoices"),
        bullet("Shortcuts: new sale / service estimate from customer"),
        bullet("Who updates: Admin, Coordinator, Estimator, Sales"),

        h2("6.4 Equipment  ·  /app/equipment"),
        bullet("Search / filter by condition, customer, category"),
        bullet("Add / Edit: asset tag, model, manufacturer, category, serial, customer, branch, location, install date, warranty, AMC, condition, current status"),
        bullet("Detail tabs: overview, service history, and QR scan activity"),
        bullet("Who updates: Admin, Coordinator, Inventory"),

        h2("6.5 Service Tickets  ·  /app/service-tickets"),
        bullet("Board, Table, and Calendar views; saved views, stage filters, overdue filter, and Excel export"),
        bullet("Create Request (fields in §3.1) — optional Inspection Technician"),
        bullet("Ticket detail actions:"),
        bullet("  — View workflow stepper + timeline"),
        bullet("  — Assign / Reassign staff (Admin/Coordinator)"),
        bullet("  — Assign estimate staff when ready to quote"),
        bullet("  — Open / start inspection"),
        bullet("  — Open / build estimate; Review estimate & assign engineer"),
        bullet("  — Confirm completed work (after job QA/Delivery)"),
        bullet("  — Reopen to earlier stage (Admin/Coordinator)"),

        h2("6.6 Inspections  ·  /app/inspections"),
        bullet("Queue = work to do; History = filed reports"),
        bullet("Start inspection → severity, findings, recommendation, photos"),
        bullet("Submit report → ticket → Estimate"),
        bullet("Printable / shareable report view"),
        bullet("Who updates: Admin, Coordinator, assigned Inspector"),

        h2("6.7 Estimates  ·  /app/estimates"),
        bullet("KPI chips; tickets awaiting estimate"),
        bullet("Builder: labor + parts from catalog/inventory → draft → send for approval"),
        bullet("Detail: preview/print; Approve + engineer + schedule; Reject / revision"),
        bullet("Who builds: Admin, Coordinator, Estimator  ·  Who approves job: Admin, Coordinator"),

        h2("6.8 Service Jobs  ·  /app/jobs  (KEY STAFF UPDATE PAGE)"),
        callout(
          "Staff engineer updates here",
          "Engineers update job status, work report, photos, parts, and extras. Coordinators/Admins run QA and Delivery confirmation. This is the main page where field staff update day-to-day work.",
          "CCFBF1",
          TEAL,
        ),
        spacer(80),
        bullet("Board by status; open Job Detail"),
        bullet("Repair: start job, update status (in progress / parts pending), write work report, upload photos, deduct stock, request extras"),
        bullet("Submit for QA → status review"),
        bullet("QA (Admin/Coordinator): Pass → Delivery · Fail → back to Repair"),
        bullet("Delivery (Admin/Coordinator): method, received by, note → Complete job → Continue to billing"),
        bullet("Optional update: registration fields (type, engineer, schedule) without wiping linked history"),
        bullet("Who updates Repair: Engineer (+ Admin)  ·  Who QA/Delivery: Admin, Coordinator"),

        h2("6.9 Projects  ·  /app/projects"),
        bullet("Coordinator project lens over the same Service Jobs data, with status filters and spreadsheet export"),
        bullet("Detail tabs: Overview, Repair/QA/Delivery, Work, Parts, Activity, and Team"),
        bullet("Available by default to Administrator and Coordinator; it is not a separate multi-ticket entity"),

        h2("6.10 Service Catalog & Warranty Claims"),
        bullet("Add/edit standard services (code, name, category, price, active) for estimates"),
        bullet("Who writes: Admin, Coordinator"),
        bullet("Warranty Claims /app/warranty-claims — warranty eligibility, physical damage, component coverage, inspection notes, review, and decision"),
        bullet("Claim statuses: Pending → Under review → Approved / Rejected; decisions may be Approved, Rejected, or Partial"),

        h2("6.11 Inventory & supply chain"),
        bullet("Inventory /app/inventory — spare parts and consumables, quantity, reserved stock, reorder level, bin, cost, price, images; Administrator force adjust"),
        bullet("Stock Purchase Requests — shortage reason and approval; convert to PO"),
        bullet("Suppliers — vendor register, category, rating, contact, and open orders"),
        bullet("Supplier RFQs — draft/send RFQ, compare supplier quote lines, delivery days, and close/cancel"),
        bullet("Purchase Orders — create, receive partially or fully, landed costs, receipts, and returns"),
        bullet("Purchase Returns — return received stock to a supplier"),
        bullet("Stock Ledger — auditable reserve, release, consume, receipt, return, and transfer movements"),
        bullet("Stock Transfer screens exist in the code, but are not currently registered in the live app navigation/router; do not use until enabled"),
        bullet("Who updates: Admin, Inventory Manager"),

        h2("6.12 Billing & Finance  ·  /app/billing"),
        bullet("Queues: Ready → Verification → Draft → Waiting approval → Sent → Partial/Pending → Paid → Overdue → Closed"),
        bullet("Job billing: build final invoice from completed job"),
        bullet("Invoice: edit draft → submit → approve → send → payments (partial OK) → PDF/print"),
        bullet("Expenses & Commissions /app/finance-operations"),
        bullet("Who updates: Admin, Billing"),

        h2("6.13 Reports · Notifications · QR"),
        bullet("Reports — date-ranged revenue, activity, jobs, product/spare/consumable/service mix, salesperson, customer, and top sellers"),
        bullet("Notifications — in-app alerts; mark read (all staff)"),
        bullet("QR Tracking — camera or manual asset tag → equipment detail and scan history"),

        h2("6.14 Administration"),
        bullet("Users — multi-role accounts, primary role, active/inactive, global read-only, and per-module access (Admin)"),
        bullet("Settings — org, logo, tax, invoice branding, automation, auto-assignment, RBAC matrix"),
        bullet("Master Data — equipment category/condition, customer type, inventory category/subcategory, and expense category"),
        bullet("Office Assets — internal company assets (Admin)"),
        bullet("Audit Logs — who did what (Admin)"),

        // ===== 7 =====
        h1("7. Sales, inventory & billing workflows"),
        h2("7.1 Product sales (not a service ticket)"),
        p("Customer → New sale → Order → Deliver (stock out) → Sale invoice → Payment"),
        bullet("Do not raise a service estimate for a counter sale"),
        spacer(80),
        h2("7.2 Inventory buy path"),
        p("Shortage / SPR → Convert to PO → Receive (partial OK) → Stock available"),
        bullet("Optional: Transfer · Purchase return · Ledger · Admin force adjust"),
        spacer(80),
        h2("7.3 Service invoice path"),
        p("Job Completed (after Delivery) → Billing → Generate draft → approve → send → payments → Paid → Close ticket"),

        // ===== 8 =====
        h1("8. Roles & daily playbooks"),
        simpleTable(
          ["Role key", "Display name", "Responsible for"],
          [
            ["admin", "Administrator", "Setup, users, permissions, approvals, audit, full oversight"],
            ["coordinator", "Service Coordinator", "Intake, assignment, estimate & job approvals, QA, Delivery"],
            ["inspector", "Inspection Technician", "Site inspection, findings, photos, submit report"],
            ["estimator", "Estimate Staff", "Service quotation from inspection → send for approval"],
            ["sales", "Sales Staff", "Product sales desk, customers, sale invoices"],
            ["engineer", "Service Engineer", "Approved field job, parts, evidence, work report"],
            ["inventory", "Inventory Manager", "Stock, POs, transfers, sale delivery"],
            ["billing", "Billing Staff", "Service & sale invoices, expenses, commissions, reports"],
            ["customer", "Customer Portal (future)", "Portal code exists, but login and routes are currently disabled"],
          ],
          [1600, 2600, 5160],
        ),
        spacer(120),
        h2("8.1 Daily playbooks"),
        h3("Coordinator — every day"),
        step("Dashboard: new tickets, approvals, overdue SLA"),
        step("Create tickets; assign inspectors at intake (optional)"),
        step("After inspections, keep estimators busy"),
        step("Approve estimates; pick engineers"),
        step("QA pass/fail; confirm Delivery; confirm completed work for Billing"),
        h3("Inspection Technician"),
        step("Open Inspections / Assigned"),
        step("Start → findings, photos, recommendation → Submit"),
        step("QR Scan when you need asset history"),
        h3("Estimate Staff"),
        step("Estimates queue → build from inspection + catalog"),
        step("Send for approval; revise if rejected"),
        h3("Service Engineer"),
        step("My Jobs → Start → work report / photos / parts"),
        step("Request extras if needed → Submit for QA"),
        step("If QA fails, continue repair and resubmit"),
        h3("Inventory Manager"),
        step("Purchase requests + low stock"),
        step("POs / receive / transfers / ledger"),
        step("Deliver sales waiting fulfilment"),
        h3("Billing Staff"),
        step("Service invoices from completed jobs"),
        step("Sale invoices and payments"),
        step("Expenses, commissions, reports"),
        h3("Sales Staff"),
        step("Sales → New sale"),
        step("Follow order until delivered and invoiced"),
        h3("Administrator — first week"),
        step("Settings: company, tax, logo, invoice footer"),
        step("Users: one account per person with correct roles"),
        step("Auto-assign defaults + switches"),
        step("Master Data + Service Catalog + opening inventory"),
        step("Walk one sample ticket New → Closed with the team"),

        // ===== 9 =====
        h1("9. Mobile use & customer portal status"),
        h2("9.1 Mobile tabs (typical)"),
        simpleTable(
          ["Role", "Tabs"],
          [
            ["Admin", "Home, Jobs, Alerts, Billing, Profile"],
            ["Coordinator", "Home, Jobs, Tickets, Alerts, Profile"],
            ["Inspector", "Home, Inspect, Scan, Alerts, Profile"],
            ["Estimator", "Home, Estimates, Tickets, Alerts, Profile"],
            ["Engineer", "Home, Jobs, Scan, Alerts, Profile"],
            ["Inventory", "Home, Stock, Scan, Alerts, Profile"],
            ["Billing", "Home, Billing, Sales, Alerts, Profile"],
            ["Sales", "Home, Sales, Tickets, Alerts, Profile"],
          ],
          [2800, 6560],
        ),
        spacer(100),
        h2("9.2 Mobile working tips"),
        bullet("The phone layout uses up to five role-based tabs and a Profile menu for additional permitted modules"),
        bullet("Inspector and Engineer screens are optimized for assigned field work, evidence, stock use, and QR scanning"),
        bullet("Admin/Coordinator can use the floating action button on Home/Jobs to open the ticket workflow"),
        bullet("Pull down on supported mobile lists to refresh current assignments"),
        spacer(100),
        h2("9.3 Customer portal  ·  /portal  (DISABLED)"),
        callout(
          "Current release status",
          "The Customer Portal is implemented for future use but is switched off in both frontend and backend. /portal redirects to login, customer-role login is rejected, and the Customer role is hidden from user setup. Do not promise portal access to a client until it is formally enabled and tested.",
          "FCE8E8",
          RED,
        ),
        spacer(80),
        bullet("Future portal pages: Overview, My Equipment, Estimates, Estimate Preview, and Service History"),
        bullet("When enabled, portal users are restricted to their linked customer organization"),

        // ===== 10 =====
        h1("10. Setup, onboarding, support & glossary"),
        h2("10.1 Administrator onboarding checklist"),
        step("Settings → Organization: company identity, address, contact, logo, and default tax"),
        step("Master Data: add the categories and conditions used by your operation"),
        step("Service Catalog: add standard labour and service charges"),
        step("Inventory: load opening spare-part and consumable balances"),
        step("Users: create one account per person; assign only required roles and choose the primary role"),
        step("Settings → Service auto-assignment: select default staff and enable only the required switches"),
        step("Settings → RBAC matrix: review module visibility; keep sensitive Administration pages with Admin"),
        step("Run one training ticket from New → Inspection → Estimate → Job → Billing → Closed"),
        step("Remove demo data and change training passwords before entering live customer data"),
        spacer(100),
        h2("10.2 Creating a user"),
        bullet("Users → Add user → enter name, username, email/phone, and a password of at least eight characters"),
        bullet("Select one or more staff roles; the primary role controls the default dashboard and mobile navigation"),
        bullet("Use Permission set = Read for a view-only account; use module None to hide an allowed module for that user"),
        bullet("Deactivate an account to block login without deleting historical ownership"),
        bullet("Administrator accounts cannot be read-only; Customer cannot be combined with staff roles"),
        spacer(100),
        h2("10.3 Support routing"),
        simpleTable(
          ["Need", "Contact / owner"],
          [
            ["Login, password, role, module visibility", "Administrator"],
            ["Wrong assignment or ticket stage", "Service Coordinator"],
            ["Inspection content", "Inspection Technician / Coordinator"],
            ["Estimate pricing or revision", "Estimate Staff / Coordinator"],
            ["Repair progress or evidence", "Assigned Service Engineer"],
            ["Stock shortage, PO, receipt, return", "Inventory Manager"],
            ["Invoice, payment, expense, commission", "Billing Staff"],
            ["Product sale or enquiry", "Sales Staff"],
          ],
          [4200, 5160],
        ),
        spacer(100),
        h2("10.4 Glossary"),
        simpleTable(
          ["Term", "Meaning"],
          [
            ["Ticket / Service request", "One unit of service work from intake to close"],
            ["Assignment", "Linking ticket/job to a named person"],
            ["Inspection flow", "New → Inspector → report → Estimate"],
            ["Estimate", "Service quotation for a ticket"],
            ["Job", "Field work after estimate approval"],
            ["Repair / QA / Delivery", "Three stages inside a Service Job"],
            ["Change request", "Extra products/work after approval"],
            ["SLA", "Target due date on the ticket"],
            ["SPR", "Stock purchase request"],
            ["RBAC", "Which roles see which menus"],
            ["Primary role", "Dashboard layout when user has several roles"],
            ["Portal", "Future customer login area; disabled in the current release"],
            ["Read-only", "Per-user permission mode that blocks all create/update/delete requests"],
            ["Additional fields", "Client-specific label/value details stored with selected records"],
          ],
          [2800, 6560],
        ),
        spacer(160),
        callout(
          "End of handbook",
          "This guide describes MESMS as currently delivered, including the live role matrix and the disabled Customer Portal. Regenerate it after product changes with: node docs/generate-full-workflow-handbook.mjs",
          NAVY,
          "5EEAD4",
        ),
      ],
    },
  ],
});

const buffer = await Packer.toBuffer(doc);
fs.writeFileSync(OUT, buffer);
console.log("Wrote", OUT);
