import { z } from "zod";

export const createEstimateSchema = z
  .object({
    serviceRequestId: z.string().min(1).optional(),
    customerId: z.string().min(1).optional(),
    equipmentId: z.string().min(1).optional(),
    laborCost: z.coerce.number().min(0).optional().default(0),
    partsCost: z.coerce.number().min(0).optional().default(0),
    validUntil: z.string().min(1, "Valid until date is required"),
    status: z.enum(["draft", "sent", "pendingAdminApproval", "approved", "rejected", "revision"]).optional().default("draft"),
  })
  .superRefine((data, ctx) => {
    if (!data.serviceRequestId && !data.customerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a customer or a service ticket",
        path: ["customerId"],
      });
    }
  });

export const updateEstimateSchema = z.object({
  laborCost: z.coerce.number().min(0).optional(),
  partsCost: z.coerce.number().min(0).optional(),
  validUntil: z.string().optional(),
  status: z.enum(["draft", "sent", "pendingAdminApproval", "approved", "rejected", "revision"]).optional(),
});

export const estimateStatusSchema = z.enum(["draft", "sent", "approved", "rejected", "revision"]);
