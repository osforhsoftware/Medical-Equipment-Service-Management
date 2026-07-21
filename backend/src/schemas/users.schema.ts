import { z } from "zod";

const userRoleSchema = z.enum([
  "admin",
  "coordinator",
  "inspector",
  "estimator",
  "engineer",
  "inventory",
  "billing",
  "customer",
]);

export const createUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(120),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(64)
    .regex(/^[a-zA-Z0-9._-]+$/, "Username may only contain letters, numbers, dots, underscores, and hyphens"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: userRoleSchema.default("coordinator"),
  phone: z.string().optional(),
  isActive: z.boolean().optional().default(true),
  branchId: z.string().optional(),
  avatarColor: z.string().optional(),
  customerId: z.string().optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  username: z
    .string()
    .min(3)
    .max(64)
    .regex(/^[a-zA-Z0-9._-]+$/)
    .optional(),
  email: z.string().email().optional(),
  role: userRoleSchema.optional(),
  phone: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  branchId: z.string().nullable().optional(),
  avatarColor: z.string().optional(),
  customerId: z.string().nullable().optional(),
  password: z.string().min(8).optional(),
});
