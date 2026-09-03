import { z } from "zod";

const serviceTypes = ["Repair", "Maintenance", "Calibration", "Inspection", "Installation", "Other"] as const;

export const createJobSchema = z
  .object({
    serviceRequestId: z.string().trim().optional(),
    customerId: z.string().trim().optional(),
    equipmentId: z.string().trim().optional(),
    type: z.enum(serviceTypes).optional(),
    typeOther: z.string().trim().max(100).optional().nullable(),
    engineerId: z.string().min(1, "Engineer is required"),
    scheduledFor: z.string().min(1, "Scheduled date is required"),
    status: z.enum(["scheduled", "inProgress", "partsPending", "review", "completed"]).optional().default("scheduled"),
    progress: z.coerce.number().min(0).max(100).optional().default(0),
  })
  .superRefine((data, ctx) => {
    if (data.serviceRequestId) return;
    if (!data.customerId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["customerId"], message: "Select a customer" });
    }
    if (!data.equipmentId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["equipmentId"], message: "Select equipment" });
    }
    if (!data.type) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["type"], message: "Select a service type" });
    }
    if (data.type === "Other" && !data.typeOther) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["typeOther"], message: "Please specify the service type" });
    }
  });

export const updateJobSchema = z.object({
  engineerId: z.string().min(1).optional(),
  scheduledFor: z.string().optional(),
  status: z.enum(["scheduled", "inProgress", "partsPending", "review", "completed"]).optional(),
  progress: z.coerce.number().min(0).max(100).optional(),
});
