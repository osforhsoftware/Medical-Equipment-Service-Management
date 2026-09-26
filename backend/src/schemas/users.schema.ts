import { z } from "zod";
import { CUSTOMER_PORTAL_ENABLED } from "@/config/features";

const userRoleSchema = z.enum([
  "admin",
  "coordinator",
  "inspector",
  "estimator",
  "sales",
  "engineer",
  "inventory",
  "billing",
  "qa",
  "customer",
]);

const permissionLevelSchema = z.enum(["none", "read", "crud"]);

const userPermissionsSchema = z
  .object({
    mode: z.enum(["crud", "read"]).default("crud"),
    modules: z.record(z.string(), permissionLevelSchema).optional().default({}),
  })
  .optional();

function rejectCustomerPortalRole(roles: string[], ctx: z.RefinementCtx) {
  if (!CUSTOMER_PORTAL_ENABLED && roles.includes("customer")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Customer Portal is temporarily unavailable; customer role cannot be assigned.",
      path: ["roles"],
    });
  }
}

export const createUserSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters").max(120),
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(64)
      .regex(/^[a-zA-Z0-9._-]+$/, "Username may only contain letters, numbers, dots, underscores, and hyphens"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    role: userRoleSchema.default("coordinator"),
    roles: z.array(userRoleSchema).min(1).optional(),
    primaryRole: userRoleSchema.optional(),
    phone: z.string().optional(),
    isActive: z.boolean().optional().default(true),
    branchId: z.string().optional(),
    avatarColor: z.string().optional(),
    customerId: z.string().optional(),
    permissions: userPermissionsSchema,
  })
  .superRefine((data, ctx) => {
    const roles = data.roles ?? [data.role];
    if (data.primaryRole && !roles.includes(data.primaryRole)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Primary role must be one of the selected roles",
        path: ["primaryRole"],
      });
    }
    if (roles.includes("customer") && roles.length > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Customer portal users cannot hold additional staff roles",
        path: ["roles"],
      });
    }
    if (roles.includes("customer") && !data.customerId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Link this portal user to a customer record",
        path: ["customerId"],
      });
    }
    if (roles.includes("admin") && data.permissions?.mode === "read") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Administrator accounts cannot be set to read-only",
        path: ["permissions", "mode"],
      });
    }
    rejectCustomerPortalRole(roles, ctx);
  });

export const updateUserSchema = z
  .object({
    name: z.string().min(2).max(120).optional(),
    username: z
      .string()
      .min(3)
      .max(64)
      .regex(/^[a-zA-Z0-9._-]+$/)
      .optional(),
    email: z.string().email().optional(),
    role: userRoleSchema.optional(),
    roles: z.array(userRoleSchema).min(1).optional(),
    primaryRole: userRoleSchema.optional(),
    phone: z.string().nullable().optional(),
    isActive: z.boolean().optional(),
    branchId: z.string().nullable().optional(),
    avatarColor: z.string().optional(),
    customerId: z.string().nullable().optional(),
    password: z.string().min(8).optional(),
    permissions: userPermissionsSchema,
  })
  .superRefine((data, ctx) => {
    if (!data.roles?.length) {
      if (data.permissions?.mode === "read" && (data.role === "admin" || data.primaryRole === "admin")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Administrator accounts cannot be set to read-only",
          path: ["permissions", "mode"],
        });
      }
      return;
    }
    if (data.primaryRole && !data.roles.includes(data.primaryRole)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Primary role must be one of the selected roles",
        path: ["primaryRole"],
      });
    }
    if (data.roles.includes("customer") && data.roles.length > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Customer portal users cannot hold additional staff roles",
        path: ["roles"],
      });
    }
    if (data.roles.includes("customer") && data.customerId === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Link this portal user to a customer record",
        path: ["customerId"],
      });
    }
    if (data.roles.includes("admin") && data.permissions?.mode === "read") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Administrator accounts cannot be set to read-only",
        path: ["permissions", "mode"],
      });
    }
    rejectCustomerPortalRole(data.roles, ctx);
  });
