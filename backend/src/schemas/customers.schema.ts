import { z } from "zod";

const phonePattern = /^[+]?[\d\s().-]{7,20}$/;

const additionalFieldSchema = z.object({
  label: z.string().trim().min(1, "Field label is required").max(80),
  value: z.string().trim().max(5000).default(""),
});

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
  paymentTerms: z.string().trim().max(120).optional().nullable(),
  creditLimit: z
    .union([z.number(), z.string(), z.null()])
    .optional()
    .nullable()
    .transform((value, ctx) => {
      if (value === null || value === undefined || value === "") return null;
      const n = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(n) || n < 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Credit limit must be a non-negative number" });
        return z.NEVER;
      }
      return Math.round(n * 100) / 100;
    }),
  priceCategory: z.string().trim().max(100).optional().nullable(),
  deliveryAddress: z.string().trim().max(500).optional().nullable(),
  additionalFields: z.array(additionalFieldSchema).max(30).optional().nullable(),
  branchId: z.string().min(1).optional(),
  status: z.enum(["active", "inactive"]).optional().default("active"),
};

export const createCustomerSchema = z.object(customerFields);

export const updateCustomerSchema = z.object(customerFields).partial();

export type CustomerAdditionalField = z.infer<typeof additionalFieldSchema>;
