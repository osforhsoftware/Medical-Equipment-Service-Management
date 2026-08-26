import { z } from "zod";

export const convertSalesQuoteSchema = z.object({
  commissionRate: z.coerce.number().min(0).max(100).optional().default(0),
  notes: z.string().max(5000).optional().nullable(),
});

export const salesInvoiceSchema = z.object({
  dueAt: z.string().optional(),
  commissionRate: z.coerce.number().min(0).max(100).optional().default(0),
});

export const salesOrderLineSchema = z.object({
  inventoryItemId: z.string().min(1).optional().nullable(),
  catalogItemId: z.string().min(1).optional().nullable(),
  type: z.string().trim().max(40).optional(),
  description: z.string().trim().min(1, "Item name is required").max(240),
  sku: z.string().trim().max(80).optional().nullable(),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  unitPrice: z.coerce.number().min(0, "Sale price cannot be negative"),
  discount: z.coerce.number().min(0).optional().default(0),
  taxRate: z.coerce.number().min(0).max(100).optional().default(0),
});

export const upsertSalesOrderSchema = z.object({
  customerId: z.string().min(1, "Pick a customer"),
  notes: z.string().max(5000).optional().nullable(),
  lines: z.array(salesOrderLineSchema).min(1, "Add at least one sold item"),
});
