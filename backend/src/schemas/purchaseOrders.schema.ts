import { z } from "zod";

export const createPurchaseOrderSchema = z.object({
  supplier: z.string().min(1, "Supplier is required").max(120),
  items: z.coerce.number().int().min(1, "Items count is required"),
  total: z.coerce.number().min(0),
  expectedDate: z.string().min(1, "Expected date is required"),
  status: z.enum(["draft", "sent", "received", "partial", "cancelled"]).optional().default("draft"),
});

export const updatePurchaseOrderSchema = createPurchaseOrderSchema.partial();
