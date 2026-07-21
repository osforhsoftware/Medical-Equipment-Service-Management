import { z } from "zod";

export const customerTypeSchema = z.enum([
  "Hospital",
  "Clinic",
  "DiagnosticLab",
  "Research",
  "Dental",
]);

export const createCustomerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(200),
  type: customerTypeSchema,
  contactPerson: z.string().min(2, "Contact person is required").max(120),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(5, "Phone number is required").max(30),
  city: z.string().min(2, "City is required").max(100),
  branchId: z.string().min(1, "Branch is required"),
  status: z.enum(["active", "inactive"]).optional().default("active"),
});

export const updateCustomerSchema = createCustomerSchema.partial();
