import { z } from "zod";
import { RBAC_ROLES } from "@/config/defaultRbac";

export const updateSettingsSchema = z.object({
  companyName: z.string().min(2).max(200).optional(),
  supportEmail: z.string().email().optional(),
  defaultTaxRate: z.coerce.number().min(0).max(100).optional(),
  amcRenewalReminders: z.boolean().optional(),
  lowStockAlerts: z.boolean().optional(),
  autoReserveOnApproval: z.boolean().optional(),
  autoGenerateReport: z.boolean().optional(),
  rbacMatrix: z.record(z.string(), z.array(z.enum(RBAC_ROLES))).optional(),
});
