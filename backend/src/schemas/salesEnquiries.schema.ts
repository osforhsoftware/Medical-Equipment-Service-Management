import { z } from "zod";

export const enquiryInterestLineSchema = z
  .object({
    source: z.enum(["inventory", "custom"]),
    inventoryItemId: z.string().trim().min(1).nullable().optional(),
    description: z.string().trim().max(500).optional().default(""),
    sku: z.string().trim().max(100).nullable().optional(),
    quantity: z.coerce.number().positive("Quantity must be greater than 0"),
    unitPrice: z.coerce.number().min(0).optional().default(0),
  })
  .superRefine((line, ctx) => {
    if (line.source === "inventory" && !line.inventoryItemId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select an inventory product",
        path: ["inventoryItemId"],
      });
    }
    if (line.source === "custom" && !line.description.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Custom product name is required",
        path: ["description"],
      });
    }
  });

const salesEnquiryFields = z.object({
  customerName: z.string().trim().min(1, "Customer name is required").max(191),
  contactPerson: z.string().trim().max(191).optional().default(""),
  phone: z.string().trim().max(50).optional().default(""),
  email: z.string().trim().max(191).optional().default(""),
  productInterest: z.string().trim().max(5000).optional(),
  interestLines: z.array(enquiryInterestLineSchema).max(40).optional(),
  quantity: z.coerce.number().positive().optional().default(1),
  estimatedBudget: z.coerce.number().min(0).optional().nullable(),
  source: z.string().trim().max(50).optional().default("walk-in"),
  priority: z.enum(["low", "medium", "high"]).optional().default("medium"),
  status: z.enum(["open", "quoted", "converted", "lost"]).optional().default("open"),
  notes: z.string().max(5000).optional().nullable(),
  assignedTo: z.string().trim().max(191).optional().nullable(),
  followUpDate: z.string().optional().nullable(),
});

export const createSalesEnquirySchema = salesEnquiryFields.superRefine((value, ctx) => {
  const lines = value.interestLines ?? [];
  if (lines.length === 0 && !value.productInterest?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Add at least one product",
      path: ["interestLines"],
    });
  }
});

export const updateSalesEnquirySchema = salesEnquiryFields.partial().superRefine((value, ctx) => {
  if (value.interestLines && value.interestLines.length === 0 && !value.productInterest?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Add at least one product",
      path: ["interestLines"],
    });
  }
});
