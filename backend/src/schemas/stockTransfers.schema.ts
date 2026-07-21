import { z } from "zod";

export const createStockTransferSchema = z.object({
  fromBranch: z.string().min(1, "From branch is required").max(120),
  toBranch: z.string().min(1, "To branch is required").max(120),
  items: z.coerce.number().int().min(1, "Items count is required"),
  status: z.enum(["pending", "inTransit", "received"]).optional().default("pending"),
});

export const updateStockTransferSchema = createStockTransferSchema.partial();
