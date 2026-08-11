import { z } from "zod";

export const invoiceLineUpdateSchema = z.object({
  id: z.string().cuid().optional(),
  type: z.string().min(1).max(64).optional(),
  description: z.string().min(1, "Description is required").max(500),
  quantity: z.coerce.number().positive("Quantity must be greater than zero"),
  unitPrice: z.coerce.number().min(0),
  taxRate: z.coerce.number().min(0).max(100).optional().default(0),
  discount: z.coerce.number().min(0).optional().default(0),
});

export const updateInvoiceSchema = z.object({
  dueAt: z.string().min(1).optional(),
  lineItems: z.array(invoiceLineUpdateSchema).min(1, "At least one line item is required").optional(),
}).refine((data) => data.dueAt || data.lineItems?.length, {
  message: "Provide a due date and/or line items to update",
});
