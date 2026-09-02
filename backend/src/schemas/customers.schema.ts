import { z } from "zod";

const phonePattern = /^[+]?[\d\s().-]{7,20}$/;

const customerFields = {
  name: z.string().min(2, "Name must be at least 2 characters").max(200),
  type: z.string().trim().max(100).optional().default(""),
  typeOther: z.string().trim().max(100).optional().nullable(),
  contactPerson: z.string().min(2, "Contact person is required").max(120),
  email: z
    .string()
    .trim()
    .max(254)
    .refine((value) => !value || z.string().email().safeParse(value).success, "Invalid email address")
    .optional(),
  phone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .default("")
    .refine((value) => !value || phonePattern.test(value), "Invalid phone number"),
  address: z.string().trim().max(300).optional().default(""),
  city: z.string().trim().max(100).optional().default(""),
  country: z.string().trim().max(100).optional().default(""),
  licenseGst: z.string().trim().max(100).optional().nullable(),
  note: z.string().trim().max(5000).optional().nullable(),
  branchId: z.string().min(1).optional(),
  status: z.enum(["active", "inactive"]).optional().default("active"),
};

export const createCustomerSchema = z.object(customerFields);

export const updateCustomerSchema = z.object(customerFields).partial();
