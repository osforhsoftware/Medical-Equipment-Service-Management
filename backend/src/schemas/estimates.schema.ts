import { z } from "zod";

export const createEstimateSchema = z.object({
  serviceRequestId: z.string().min(1, "Service request is required"),
  laborCost: z.coerce.number().min(0),
  partsCost: z.coerce.number().min(0),
  validUntil: z.string().min(1, "Valid until date is required"),
  status: z.enum(["draft", "sent", "approved", "rejected", "revision"]).optional().default("draft"),
});

export const updateEstimateSchema = z.object({
  laborCost: z.coerce.number().min(0).optional(),
  partsCost: z.coerce.number().min(0).optional(),
  validUntil: z.string().optional(),
  status: z.enum(["draft", "sent", "approved", "rejected", "revision"]).optional(),
});

export const estimateStatusSchema = z.enum(["draft", "sent", "approved", "rejected", "revision"]);
