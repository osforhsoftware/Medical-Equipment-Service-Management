import { z } from "zod";
import { INVOICE_LINE_TYPES } from "@/utils/invoiceCharges";

export const invoiceLineTypeSchema = z.enum(INVOICE_LINE_TYPES);

export const invoiceLineUpdateSchema = z.object({
  id: z.string().cuid().optional(),
  type: invoiceLineTypeSchema.optional(),
  description: z.string().min(1, "Description is required").max(500),
  quantity: z.coerce.number().positive("Quantity must be greater than zero"),
  unitPrice: z.coerce.number().min(0),
  taxRate: z.coerce.number().min(0).max(100).optional().default(0),
  discount: z.coerce.number().min(0).optional().default(0),
  catalogItemId: z.string().cuid().nullable().optional(),
});

export const updateInvoiceSchema = z.object({
  dueAt: z.string().min(1).optional(),
  lineItems: z.array(invoiceLineUpdateSchema).min(1, "At least one line item is required").optional(),
}).refine((data) => data.dueAt || data.lineItems?.length, {
  message: "Provide a due date and/or line items to update",
});

export const createInvoiceSchema = z.object({
  jobId: z.string().cuid(),
  dueAt: z.string().min(1),
  currency: z.string().trim().length(3).optional().default("INR"),
  additionalLines: z.array(invoiceLineUpdateSchema).optional(),
});
