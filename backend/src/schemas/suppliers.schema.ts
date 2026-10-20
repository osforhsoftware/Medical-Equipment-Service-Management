import { z } from "zod";

const supplierFields = {
  name: z.string().trim().min(2).max(200),
  contact: z.string().trim().max(120).optional().default(""),
  email: z.string().trim().max(254).optional().default(""),
  phone: z.string().trim().max(30).optional().default(""),
  category: z.string().trim().max(100).optional().default(""),
  currency: z.string().trim().max(8).optional(),
  paymentTerms: z.string().trim().max(120).optional().nullable(),
  deliveryLeadDays: z.coerce.number().int().min(0).optional().nullable(),
  rating: z.coerce.number().min(0).max(5).optional(),
};

export const createSupplierSchema = z.object(supplierFields);
export const updateSupplierSchema = z.object(supplierFields).partial();
