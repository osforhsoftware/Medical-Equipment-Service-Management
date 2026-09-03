import { z } from "zod";
import { RBAC_ROLES } from "@/config/defaultRbac";

const optionalStaffId = z.string().cuid().nullable().optional();

export const updateSettingsSchema = z.object({
  companyName: z.string().min(2).max(200).optional(),
  logoFileId: z.string().cuid().nullable().optional(),
  supportEmail: z.string().email().optional(),
  companyAddress: z.string().max(500).nullable().optional(),
  companyPhone: z.string().max(40).nullable().optional(),
  companyWebsite: z.string().max(200).nullable().optional(),
  defaultTaxRate: z.coerce.number().min(0).max(100).optional(),
  amcRenewalReminders: z.boolean().optional(),
  lowStockAlerts: z.boolean().optional(),
  autoReserveOnApproval: z.boolean().optional(),
  autoGenerateReport: z.boolean().optional(),
  autoAssignInspectorOnCreate: z.boolean().optional(),
  autoAssignCoordinatorAfterInspection: z.boolean().optional(),
  autoAssignEstimatorAfterInspection: z.boolean().optional(),
  autoAssignEngineerOnApproval: z.boolean().optional(),
  defaultCoordinatorUserId: optionalStaffId,
  defaultInspectorUserId: optionalStaffId,
  defaultEstimatorUserId: optionalStaffId,
  defaultEngineerUserId: optionalStaffId,
  rbacMatrix: z.record(z.string(), z.array(z.enum(RBAC_ROLES))).optional(),
});
