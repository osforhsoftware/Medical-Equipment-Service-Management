import { z } from "zod";

export const createSalesEnquirySchema = z.object({
  customerName: z.string().trim().min(1, "Customer name is required").max(191),
  contactPerson: z.string().trim().max(191).optional().default(""),
  phone: z.string().trim().max(50).optional().default(""),
  email: z.string().trim().max(191).optional().default(""),
  productInterest: z.string().trim().min(1, "Product interest is required"),
  quantity: z.coerce.number().positive().optional().default(1),
  estimatedBudget: z.coerce.number().min(0).optional().nullable(),
  source: z.string().trim().max(50).optional().default("walk-in"),
  priority: z.enum(["low", "medium", "high"]).optional().default("medium"),
  status: z.enum(["open", "quoted", "converted", "lost"]).optional().default("open"),
  notes: z.string().max(5000).optional().nullable(),
  assignedTo: z.string().trim().max(191).optional().nullable(),
  followUpDate: z.string().optional().nullable(),
});

export const updateSalesEnquirySchema = createSalesEnquirySchema.partial();
