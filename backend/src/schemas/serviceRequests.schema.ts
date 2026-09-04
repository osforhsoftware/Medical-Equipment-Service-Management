import { z } from "zod";

export const TICKET_STATUS_VALUES = [
  "new",
  "inspection",
  "estimate",
  "pending_approval",
  "assigned_engineer",
  "change_pending_approval",
  "pending_final_approval",
  "pending_invoice",
  "invoiced",
  "closed",
  // Legacy values kept for backward compatibility
  "approval",
  "inProgress",
  "completed",
  "finished",
] as const;

export const createServiceRequestSchema = z
  .object({
    customerId: z.string().min(1, "Customer is required"),
    equipmentId: z.string().optional(),
    equipmentIds: z.array(z.string()).optional(),
    type: z.preprocess(
      (value) => (value === "" || value == null ? undefined : value),
      z.enum(["Repair", "Maintenance", "Calibration", "Inspection", "Installation", "Other"]).optional(),
    ),
    typeOther: z.string().trim().max(100).optional().nullable(),
    priority: z.enum(["low", "medium", "high", "critical"]),
    description: z.string().trim().max(500).optional().default(""),
    assignedTo: z.string().min(1).optional(),
    assignedName: z.string().optional(),
    /** Create intake only supports Inspection Technician → Inspection flow. */
    role: z.literal("inspector").optional(),
    slaDue: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "Other" && !data.typeOther?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["typeOther"],
        message: "Please specify the service type",
      });
    }
    if (data.role && data.role !== "inspector") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["role"],
        message: "On create, only an Inspection Technician can be assigned",
      });
    }
  });

export const updateServiceRequestSchema = z.object({
  status: z.enum(TICKET_STATUS_VALUES).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  type: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.enum(["Repair", "Maintenance", "Calibration", "Inspection", "Installation", "Other"]).optional().nullable(),
  ),
  typeOther: z.string().trim().max(100).optional().nullable(),
  assignedTo: z.string().nullable().optional(),
  assignedName: z.string().nullable().optional(),
  description: z.string().trim().max(500).optional(),
  timelineNote: z.string().trim().max(1000).optional(),
}).superRefine((data, ctx) => {
  if (data.type === "Other" && !data.typeOther?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["typeOther"],
      message: "Please specify the service type",
    });
  }
});

export const assignServiceRequestSchema = z.object({
  assignedTo: z.string().min(1, "Staff user ID is required"),
  role: z.enum(["coordinator", "inspector", "estimator", "engineer", "inventory", "billing"]).optional(),
  note: z.string().trim().max(500).optional(),
});

export const workflowServiceRequestSchema = z.object({
  status: z.enum(TICKET_STATUS_VALUES),
  note: z.string().trim().min(1, "Note is required").max(1000),
});

export const reopenServiceRequestSchema = z.object({
  status: z.enum([
    "new",
    "inspection",
    "estimate",
    "pending_approval",
    "assigned_engineer",
    "change_pending_approval",
    "pending_final_approval",
    "pending_invoice",
    "invoiced",
    "approval",
    "inProgress",
    "completed",
  ]),
  note: z.string().trim().min(1, "Reopen reason is required").max(1000),
});

export const approveEstimateSchema = z.object({
  estimateId: z.string().cuid(),
  engineerId: z.string().cuid().optional(),
  scheduledFor: z.coerce.date().optional(),
  note: z.string().trim().max(5000).optional(),
});

export const rejectEstimateSchema = z.object({
  estimateId: z.string().cuid(),
  reason: z.string().trim().min(1, "Rejection reason is required").max(5000),
  target: z.enum(["estimate", "inspection"]),
});

export const submitChangeRequestSchema = z.object({
  description: z.string().trim().min(1).max(5000),
  items: z.array(z.record(z.unknown())).default([]),
  jobId: z.string().cuid().optional(),
});

export const decideChangeRequestSchema = z.object({
  approved: z.boolean(),
  note: z.string().trim().max(5000).optional(),
});

export const finalApprovalSchema = z.object({
  note: z.string().trim().max(5000).optional(),
  currency: z.string().length(3).optional(),
  dueAt: z.coerce.date().optional(),
});

export const rejectFinalApprovalSchema = z.object({
  reason: z.string().trim().min(1, "Rejection reason is required").max(5000),
});

export const closeTicketSchema = z.object({
  note: z.string().trim().max(5000).optional(),
});

export const inspectionReportSchema = z.object({
  findings: z.string().trim().default(""),
  recommendation: z.string().trim().default(""),
  severity: z.enum(["low", "medium", "high", "critical"]),
  attachmentFileIds: z.array(z.string().cuid()).optional(),
  attachments: z
    .array(
      z.object({
        fileId: z.string().cuid(),
        caption: z.string().trim().max(500).optional(),
      }),
    )
    .optional(),
  recommendedParts: z
    .array(
      z.object({
        inventoryItemId: z.string().cuid(),
        quantity: z.coerce.number().positive(),
        title: z.string().trim().max(200).optional(),
        description: z.string().trim().max(5000).optional(),
        priority: z.enum(["low", "medium", "high", "critical"]).optional(),
      }),
    )
    .optional(),
  submit: z.boolean().optional(),
});
