import { z } from "zod";

export const convertSalesQuoteSchema = z.object({
  commissionRate: z.coerce.number().min(0).max(100).optional().default(0),
  notes: z.string().max(5000).optional().nullable(),
});

export const salesInvoiceSchema = z.object({
  dueAt: z.string().optional(),
  commissionRate: z.coerce.number().min(0).max(100).optional().default(0),
});
