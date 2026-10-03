import { z } from "zod";
import { INVENTORY_ITEM_CLASSES } from "@/lib/inventoryItemClass";

const additionalFieldSchema = z.object({
  label: z.string().trim().min(1).max(80),
  value: z.string().trim().max(5000).default(""),
});

const inventoryFields = z.object({
  sku: z.string().trim().max(64).optional(),
  name: z.string().min(2, "Name is required").max(200),
  itemClass: z.enum(INVENTORY_ITEM_CLASSES).optional().default("spare_part"),
  category: z.string().max(80).optional(),
  subcategory: z.string().max(80).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  manufacturer: z.string().max(120).optional().default(""),
  compatibleModels: z.string().max(5000).optional().nullable(),
  branchId: z.string().min(1).optional(),
  inStock: z.coerce.number().int().min(0).optional().default(0),
  reorderLevel: z.coerce.number().int().min(0).optional().default(0),
  maxLevel: z.coerce.number().int().min(0).optional().default(0),
  binLocation: z.string().max(120).optional().default(""),
  trackBatches: z.coerce.boolean().optional().default(false),
  trackSerials: z.coerce.boolean().optional().default(false),
  unitCost: z.coerce.number().min(0).optional().default(0),
  sellingPrice: z.coerce.number().min(0).optional().default(0),
  deliveryCharge: z.coerce.number().min(0).optional().default(0),
  deliveryChargeType: z.enum(["flat", "perUnit"]).optional().default("flat"),
  unitOfMeasure: z.string().min(1).max(30).optional().default("pcs"),
  supplier: z.string().max(120).optional().default(""),
  supplierId: z.string().cuid().optional().nullable(),
  imageFileIds: z.array(z.string().cuid()).optional(),
  additionalFields: z.array(additionalFieldSchema).max(30).optional().nullable(),
});

function rejectInvertedStockLevels(
  data: { reorderLevel?: number; maxLevel?: number },
  ctx: z.RefinementCtx,
) {
  const minLevel = data.reorderLevel ?? 0;
  const maxLevel = data.maxLevel ?? 0;
  if (maxLevel > 0 && minLevel > maxLevel) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["maxLevel"],
      message: "Max level must be greater than or equal to min level.",
    });
  }
}

export const createInventorySchema = inventoryFields.superRefine(rejectInvertedStockLevels);

export const updateInventorySchema = inventoryFields.partial().superRefine(rejectInvertedStockLevels);

export const approvePartsRequestSchema = z.object({
  lines: z
    .array(
      z.object({
        lineId: z.string().min(1),
        qtyApproved: z.coerce.number().int().min(0),
      }),
    )
    .max(30)
    .optional(),
});

export const rejectPartsRequestSchema = z.object({
  reason: z.string().trim().max(2000).optional(),
});

export const issuePartsRequestSchema = z.object({
  lines: z
    .array(
      z.object({
        lineId: z.string().min(1),
        quantity: z.coerce.number().int().min(1),
        batchNumber: z.string().trim().max(191).optional().nullable(),
        serialNumbers: z.string().trim().max(191).optional().nullable(),
      }),
    )
    .max(30)
    .optional(),
});
