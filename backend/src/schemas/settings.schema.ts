import { z } from "zod";
import { RBAC_ROLES } from "@/config/defaultRbac";
import { isValidAssetTagPrefix, normalizeAssetTagPrefix } from "@/lib/assetTag";

const optionalStaffId = z.string().cuid().nullable().optional();

export const updateSettingsSchema = z.object({
  companyName: z.string().min(2).max(200).optional(),
  assetTagPrefix: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .transform((value, ctx) => {
      const prefix = normalizeAssetTagPrefix(value);
      if (!isValidAssetTagPrefix(prefix)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Use 2–20 letters, numbers, and hyphens.",
        });
        return z.NEVER;
      }
      return prefix;
    })
    .optional(),
  logoFileId: z.string().cuid().nullable().optional(),
  supportEmail: z.string().email().optional(),
  companyAddress: z.string().max(500).nullable().optional(),
  companyPhone: z.string().max(40).nullable().optional(),
  companyWebsite: z.string().max(200).nullable().optional(),
  defaultTaxRate: z.coerce.number().min(0).max(100).optional(),
  marginMode: z.enum(["on", "fixed", "off"]).optional(),
  minMarginPct: z.coerce.number().min(0).max(100).optional(),
  amcRenewalReminders: z.boolean().optional(),
  lowStockAlerts: z.boolean().optional(),
  autoReserveOnApproval: z.boolean().optional(),
  autoGenerateReport: z.boolean().optional(),
  autoAssignInspectorOnCreate: z.boolean().optional(),
  autoAssignCoordinatorAfterInspection: z.boolean().optional(),
  autoAssignEstimatorAfterInspection: z.boolean().optional(),
  autoAssignEngineerOnApproval: z.boolean().optional(),
  skipApprovals: z.boolean().optional(),
  guidedSetupFlow: z.boolean().optional(),
  defaultCoordinatorUserId: optionalStaffId,
  defaultInspectorUserId: optionalStaffId,
  defaultEstimatorUserId: optionalStaffId,
  defaultEngineerUserId: optionalStaffId,
  qaChecklistDefaults: z
    .array(z.string().trim().min(1).max(200))
    .max(30)
    .optional(),
  rbacMatrix: z.record(z.string(), z.array(z.enum(RBAC_ROLES))).optional(),
  masterCurrency: z.enum(["INR", "AED"]).optional(),
  exchangeRates: z.record(z.string(), z.coerce.number().positive()).optional(),
});
