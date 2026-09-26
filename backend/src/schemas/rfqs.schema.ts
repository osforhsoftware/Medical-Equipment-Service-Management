import { z } from "zod";

export const rfqLineSchema = z.object({
  description: z.string().trim().min(1, "Item description required"),
  quantity: z.coerce.number().positive("Quantity must be positive"),
  unitCostEstimate: z.coerce.number().min(0).optional().default(0),
  inventoryItemId: z.string().cuid().optional().nullable(),
  sku: z.string().trim().max(100).optional().nullable(),
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
  moq: z.coerce.number().positive("MOQ must be at least 1"),
  /** Lead time in days */
  deliveryDays: z.coerce.number().min(0, "Lead time cannot be negative"),
  notes: z.string().optional(),
});

export const createSupplierQuoteSchema = z.object({
  rfqId: z.string().min(1, "RFQ ID required"),
  currency: z.string().trim().min(1, "Currency required").max(10),
  warranty: z.string().trim().min(1, "Warranty required").max(500),
  incoterm: z.string().trim().min(1, "Incoterm required").max(100),
  shippingTerms: z.string().trim().min(1, "Shipping terms required").max(500),
  paymentTerms: z.string().trim().min(1, "Payment terms required").max(500),
  countryOfOrigin: z.string().trim().min(1, "Country of origin required").max(100),
  validUntil: z.string().min(1, "Validity of quotation required"),
  notes: z.string().max(5000).optional().nullable(),
  lines: z.array(supplierQuoteLineSchema).min(1, "At least one quote line required"),
});
