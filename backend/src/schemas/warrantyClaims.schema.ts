import { z } from "zod";

const emptyToNull = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? null : value;

export const createWarrantyClaimSchema = z.object({
  equipmentId: z.string().min(1, "Equipment is required"),
  equipmentName: z.string().trim().min(1, "Equipment name required"),
  customerId: z.preprocess(emptyToNull, z.string().optional().nullable()),
  customerName: z.string().trim().min(1, "Customer name required"),
  serviceRequestId: z.preprocess(emptyToNull, z.string().optional().nullable()),
  underWarranty: z.boolean().optional().default(false),
  isPhysicalDamage: z.boolean().optional().default(false),
  componentCovered: z.boolean().optional().default(false),
  inspectorNotes: z.preprocess(emptyToNull, z.string().max(5000).optional().nullable()),
});

export const updateWarrantyClaimSchema = createWarrantyClaimSchema.partial().extend({
  claimDecision: z.enum(["approved", "rejected", "partial"]).optional().nullable(),
  decisionNotes: z.string().max(5000).optional().nullable(),
  status: z.enum(["pending", "under_review", "approved", "rejected"]).optional(),
});

export const decideWarrantyClaimSchema = z.object({
  claimDecision: z.enum(["approved", "rejected", "partial"]),
  decisionNotes: z.string().max(5000).optional().nullable(),
  status: z.enum(["approved", "rejected"]),
});
