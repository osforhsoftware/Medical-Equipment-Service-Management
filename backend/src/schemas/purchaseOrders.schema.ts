import { z } from "zod";

/** PO lifecycle: draft (create/review) → sent → partial → closed; cancelled anytime before closed. */
export const purchaseOrderStatuses = ["draft", "sent", "partial", "closed", "cancelled"] as const;
export type PurchaseOrderStatusValue = (typeof purchaseOrderStatuses)[number];

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
  /** Creates always start as draft; send via PUT status transition. */
  status: z.literal("draft").optional().default("draft"),
  ...landedCostFields,
});

export const updatePurchaseOrderSchema = createPurchaseOrderSchema
  .omit({ status: true })
  .partial()
  .extend({
    status: z.enum(["draft", "sent", "partial", "closed", "cancelled"]).optional(),
  });
