import { z } from "zod";

const landedCostFields = {
  freightCost: z.coerce.number().min(0).optional().nullable(),
  customsCost: z.coerce.number().min(0).optional().nullable(),
  insuranceCost: z.coerce.number().min(0).optional().nullable(),
};

export const createPurchaseOrderSchema = z.object({
  supplier: z.string().min(1, "Supplier is required").max(120),
  supplierReference: z.string().trim().max(120).optional().nullable(),
  currency: z.string().trim().min(3).max(10).optional().default("INR"),
  items: z.coerce.number().int().min(1, "Items count is required"),
  total: z.coerce.number().min(0),
  expectedDate: z.string().min(1, "Expected date is required"),
  status: z.enum(["draft", "sent", "received", "partial", "cancelled"]).optional().default("draft"),
  ...landedCostFields,
});

export const updatePurchaseOrderSchema = createPurchaseOrderSchema.partial();
