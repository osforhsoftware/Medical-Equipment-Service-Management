import { z } from "zod";

export const rfqLineSchema = z.object({
  description: z.string().trim().min(1, "Item description required"),
  quantity: z.coerce.number().positive("Quantity must be positive"),
  unitCostEstimate: z.coerce.number().min(0).optional().default(0),
});

export const createRfqSchema = z.object({
  supplierId: z.string().optional().nullable(),
  supplierName: z.string().trim().min(1, "Supplier name required"),
  dueDate: z.string().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  lines: z.array(rfqLineSchema).min(1, "At least one item line is required"),
});

export const updateRfqSchema = createRfqSchema.partial().extend({
  status: z.enum(["draft", "sent", "quoted", "closed", "cancelled"]).optional(),
});

export const supplierQuoteLineSchema = z.object({
  rfqLineIndex: z.coerce.number().int().min(0),
  description: z.string().optional(),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().min(0, "Unit price cannot be negative"),
  deliveryDays: z.coerce.number().min(0).optional().default(0),
  notes: z.string().optional(),
});

export const createSupplierQuoteSchema = z.object({
  rfqId: z.string().min(1, "RFQ ID required"),
  validUntil: z.string().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  lines: z.array(supplierQuoteLineSchema).min(1, "At least one quote line required"),
});
