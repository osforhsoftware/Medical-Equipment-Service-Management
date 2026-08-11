import { z } from "zod";

const customerFields = {
  name: z.string().min(2, "Name must be at least 2 characters").max(200),
  type: z.string().trim().min(1, "Type is required").max(100),
  typeOther: z.string().trim().max(100).optional().nullable(),
  contactPerson: z.string().min(2, "Contact person is required").max(120),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(5, "Phone number is required").max(30),
  address: z.string().trim().min(2, "Site address is required").max(300),
  city: z.string().min(2, "City is required").max(100),
  country: z.string().trim().min(2, "Country is required").max(100),
  licenseGst: z.string().trim().max(100).optional().nullable(),
  branchId: z.string().min(1).optional(),
  status: z.enum(["active", "inactive"]).optional().default("active"),
};

function refineCustomerType<T extends { type?: string }>(data: T, ctx: z.RefinementCtx) {
  if (data.type?.trim() === "Other") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["type"],
      message: "Please add and select a customer type",
    });
  }
}

export const createCustomerSchema = z.object(customerFields).superRefine(refineCustomerType);

export const updateCustomerSchema = z
  .object(customerFields)
  .partial()
  .superRefine(refineCustomerType);
