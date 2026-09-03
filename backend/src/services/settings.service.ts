import { settingsRepository } from "@/repositories/settings.repository";
import { DEFAULT_RBAC_MATRIX } from "@/config/defaultRbac";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/db/prisma";
import { AppError } from "@/middleware/errorHandler";
import { ensureSystemRoles, findActiveStaffWithRole } from "@/utils/userRoles";

type UpdateSettingsData = {
  companyName?: string;
  logoFileId?: string | null;
  supportEmail?: string;
  defaultTaxRate?: number;
  amcRenewalReminders?: boolean;
  lowStockAlerts?: boolean;
  autoReserveOnApproval?: boolean;
  autoGenerateReport?: boolean;
  autoAssignInspectorOnCreate?: boolean;
  autoAssignCoordinatorAfterInspection?: boolean;
  autoAssignEstimatorAfterInspection?: boolean;
  autoAssignEngineerOnApproval?: boolean;
  defaultCoordinatorUserId?: string | null;
  defaultInspectorUserId?: string | null;
  defaultEstimatorUserId?: string | null;
  defaultEngineerUserId?: string | null;
  rbacMatrix?: Record<string, string[]>;
};

function ensureRole(matrix: Record<string, string[]>, module: string, role: string) {
  const roles = matrix[module] ?? [];
  if (!roles.includes(role)) matrix[module] = [...roles, role];
}

function normalizeRbac(raw: unknown): Record<string, string[]> {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_RBAC_MATRIX };
  const matrix = raw as Record<string, string[]>;
  const merged = { ...DEFAULT_RBAC_MATRIX };
  for (const key of Object.keys(DEFAULT_RBAC_MATRIX)) {
    if (Array.isArray(matrix[key])) merged[key] = matrix[key];
  }

  const estimates = merged.Estimates ?? [];
  const legacyEstimateRoles = ["admin", "coordinator", "estimator", "billing"];
  const isLegacyEstimates =
    estimates.length === legacyEstimateRoles.length &&
    legacyEstimateRoles.every((role) => estimates.includes(role));
  if (isLegacyEstimates) {
    merged.Estimates = [...DEFAULT_RBAC_MATRIX.Estimates];
  }

  const customers = merged.Customers ?? [];
  if (!customers.includes("estimator") && DEFAULT_RBAC_MATRIX.Customers.includes("estimator")) {
    merged.Customers = [...customers, "estimator"];
  }

  const salesModules = ["Dashboard", "Sales", "Customers", "Notifications", "Reports"] as const;
  for (const module of salesModules) {
    if (!DEFAULT_RBAC_MATRIX[module]?.includes("sales")) continue;
    const roles = merged[module] ?? [];
    if (roles.includes("sales")) continue;
    merged[module] = module === "Sales" ? [...roles.filter((role) => role !== "estimator"), "sales"] : [...roles, "sales"];
  }

  if (DEFAULT_RBAC_MATRIX.Billing.includes("estimator")) {
    ensureRole(merged, "Billing", "estimator");
  }

  return merged;
}

export class SettingsService {
  async get(tenantId: string) {
    await ensureSystemRoles(tenantId);
    const settings = await settingsRepository.ensureDefaults(tenantId);
    const companyName = await settingsRepository.getTenantName(tenantId);

    return {
      tenantId,
      companyName,
      logoFileId: settings.logoFileId,
      logoUrl: settings.logoFileId ? `/api/files/${settings.logoFileId}/download` : null,
      supportEmail: settings.supportEmail,
      defaultTaxRate: Number(settings.defaultTaxRate),
      amcRenewalReminders: settings.amcRenewalReminders,
      lowStockAlerts: settings.lowStockAlerts,
      autoReserveOnApproval: settings.autoReserveOnApproval,
      autoGenerateReport: settings.autoGenerateReport,
      autoAssignInspectorOnCreate: settings.autoAssignInspectorOnCreate,
      autoAssignCoordinatorAfterInspection: settings.autoAssignCoordinatorAfterInspection,
      autoAssignEstimatorAfterInspection: settings.autoAssignEstimatorAfterInspection,
      autoAssignEngineerOnApproval: settings.autoAssignEngineerOnApproval,
      defaultCoordinatorUserId: settings.defaultCoordinatorUserId,
      defaultInspectorUserId: settings.defaultInspectorUserId,
      defaultEstimatorUserId: settings.defaultEstimatorUserId,
      defaultEngineerUserId: settings.defaultEngineerUserId,
      rbacMatrix: normalizeRbac(settings.rbacMatrix),
    };
  }

  async update(tenantId: string, data: UpdateSettingsData) {
    await settingsRepository.ensureDefaults(tenantId);

    if (data.companyName) {
      await settingsRepository.updateTenantName(tenantId, data.companyName);
    }

    const updatePayload: Prisma.TenantSettingsUpdateInput = {};
    if (data.logoFileId !== undefined) {
      if (data.logoFileId === null) {
        updatePayload.logoFile = { disconnect: true };
      } else {
        const logo = await prisma.storedFile.findFirst({
          where: {
            id: data.logoFileId,
            tenantId,
            mimeType: { in: ["image/jpeg", "image/png", "image/webp"] },
          },
        });
        if (!logo) throw new AppError("Uploaded logo image not found", 404);
        updatePayload.logoFile = { connect: { id: logo.id } };
      }
    }
    if (data.supportEmail !== undefined) updatePayload.supportEmail = data.supportEmail;
    if (data.defaultTaxRate !== undefined) updatePayload.defaultTaxRate = data.defaultTaxRate;
    if (data.amcRenewalReminders !== undefined) updatePayload.amcRenewalReminders = data.amcRenewalReminders;
    if (data.lowStockAlerts !== undefined) updatePayload.lowStockAlerts = data.lowStockAlerts;
    if (data.autoReserveOnApproval !== undefined) updatePayload.autoReserveOnApproval = data.autoReserveOnApproval;
    if (data.autoGenerateReport !== undefined) updatePayload.autoGenerateReport = data.autoGenerateReport;
    if (data.autoAssignInspectorOnCreate !== undefined) updatePayload.autoAssignInspectorOnCreate = data.autoAssignInspectorOnCreate;
    if (data.autoAssignCoordinatorAfterInspection !== undefined) {
      updatePayload.autoAssignCoordinatorAfterInspection = data.autoAssignCoordinatorAfterInspection;
    }
    if (data.autoAssignEstimatorAfterInspection !== undefined) {
      updatePayload.autoAssignEstimatorAfterInspection = data.autoAssignEstimatorAfterInspection;
    }
    if (data.autoAssignEngineerOnApproval !== undefined) updatePayload.autoAssignEngineerOnApproval = data.autoAssignEngineerOnApproval;

    const resolveStaffDefault = async (userId: string | null | undefined, role: string, label: string) => {
      if (userId === undefined) return undefined;
      if (userId === null) return null;
      const staff = await findActiveStaffWithRole(tenantId, userId, role);
      if (!staff) throw new AppError(`Select an active ${label} for auto-assignment`, 400);
      return staff.id;
    };

    const defaultCoordinatorUserId = await resolveStaffDefault(data.defaultCoordinatorUserId, "coordinator", "service coordinator");
    const defaultInspectorUserId = await resolveStaffDefault(data.defaultInspectorUserId, "inspector", "inspection technician");
    const defaultEstimatorUserId = await resolveStaffDefault(data.defaultEstimatorUserId, "estimator", "estimate staff");
    const defaultEngineerUserId = await resolveStaffDefault(data.defaultEngineerUserId, "engineer", "service engineer");
    if (defaultCoordinatorUserId !== undefined) updatePayload.defaultCoordinatorUserId = defaultCoordinatorUserId;
    if (defaultInspectorUserId !== undefined) updatePayload.defaultInspectorUserId = defaultInspectorUserId;
    if (defaultEstimatorUserId !== undefined) updatePayload.defaultEstimatorUserId = defaultEstimatorUserId;
    if (defaultEngineerUserId !== undefined) updatePayload.defaultEngineerUserId = defaultEngineerUserId;

    if (data.rbacMatrix !== undefined) updatePayload.rbacMatrix = data.rbacMatrix as Prisma.InputJsonValue;

    if (Object.keys(updatePayload).length > 0) {
      await settingsRepository.update(tenantId, updatePayload);
    }

    return this.get(tenantId);
  }
}

export const settingsService = new SettingsService();
