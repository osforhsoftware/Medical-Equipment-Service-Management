import { z } from "zod";

export const createInventorySchema = z.object({
  sku: z.string().trim().max(64).optional(),
  name: z.string().min(2, "Name is required").max(200),
  category: z.string().max(80).optional(),
  subcategory: z.string().max(80).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  branchId: z.string().min(1).optional(),
  inStock: z.coerce.number().int().min(0).optional().default(0),
  reorderLevel: z.coerce.number().int().min(0).optional().default(0),
  unitCost: z.coerce.number().min(0).optional().default(0),
  sellingPrice: z.coerce.number().min(0).optional().default(0),
  deliveryCharge: z.coerce.number().min(0).optional().default(0),
  deliveryChargeType: z.enum(["flat", "perUnit"]).optional().default("flat"),
  unitOfMeasure: z.string().min(1).max(30).optional().default("pcs"),
  supplier: z.string().max(120).optional().default(""),
  supplierId: z.string().cuid().optional().nullable(),
  imageFileIds: z.array(z.string().cuid()).optional(),
});

export const updateInventorySchema = createInventorySchema.partial();
