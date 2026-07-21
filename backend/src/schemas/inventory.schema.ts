import { z } from "zod";

export const createInventorySchema = z.object({
  sku: z.string().min(2, "SKU is required").max(64),
  name: z.string().min(2, "Name is required").max(200),
  category: z.string().min(1, "Category is required").max(80),
  branchId: z.string().min(1, "Branch is required"),
  inStock: z.coerce.number().int().min(0).optional().default(0),
  reserved: z.coerce.number().int().min(0).optional().default(0),
  reorderLevel: z.coerce.number().int().min(0).optional().default(0),
  unitCost: z.coerce.number().min(0).optional().default(0),
  supplier: z.string().min(1, "Supplier is required").max(120),
});

export const updateInventorySchema = createInventorySchema.partial();
