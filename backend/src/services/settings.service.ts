import { settingsRepository } from "@/repositories/settings.repository";
import { DEFAULT_RBAC_MATRIX } from "@/config/defaultRbac";
import type { Prisma } from "@prisma/client";

type UpdateSettingsData = {
  companyName?: string;
  supportEmail?: string;
  defaultTaxRate?: number;
  amcRenewalReminders?: boolean;
  lowStockAlerts?: boolean;
  autoReserveOnApproval?: boolean;
  autoGenerateReport?: boolean;
  rbacMatrix?: Record<string, string[]>;
};

function normalizeRbac(raw: unknown): Record<string, string[]> {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_RBAC_MATRIX };
  const matrix = raw as Record<string, string[]>;
  const merged = { ...DEFAULT_RBAC_MATRIX };
  for (const key of Object.keys(DEFAULT_RBAC_MATRIX)) {
    if (Array.isArray(matrix[key])) merged[key] = matrix[key];
  }
  return merged;
}

export class SettingsService {
  async get(tenantId: string) {
    const settings = await settingsRepository.ensureDefaults(tenantId);
    const companyName = await settingsRepository.getTenantName(tenantId);

    return {
      tenantId,
      companyName,
      supportEmail: settings.supportEmail,
      defaultTaxRate: Number(settings.defaultTaxRate),
      amcRenewalReminders: settings.amcRenewalReminders,
      lowStockAlerts: settings.lowStockAlerts,
      autoReserveOnApproval: settings.autoReserveOnApproval,
      autoGenerateReport: settings.autoGenerateReport,
      rbacMatrix: normalizeRbac(settings.rbacMatrix),
    };
  }

  async update(tenantId: string, data: UpdateSettingsData) {
    await settingsRepository.ensureDefaults(tenantId);

    if (data.companyName) {
      await settingsRepository.updateTenantName(tenantId, data.companyName);
    }

    const updatePayload: Prisma.TenantSettingsUpdateInput = {};
    if (data.supportEmail !== undefined) updatePayload.supportEmail = data.supportEmail;
    if (data.defaultTaxRate !== undefined) updatePayload.defaultTaxRate = data.defaultTaxRate;
    if (data.amcRenewalReminders !== undefined) updatePayload.amcRenewalReminders = data.amcRenewalReminders;
    if (data.lowStockAlerts !== undefined) updatePayload.lowStockAlerts = data.lowStockAlerts;
    if (data.autoReserveOnApproval !== undefined) updatePayload.autoReserveOnApproval = data.autoReserveOnApproval;
    if (data.autoGenerateReport !== undefined) updatePayload.autoGenerateReport = data.autoGenerateReport;
    if (data.rbacMatrix !== undefined) updatePayload.rbacMatrix = data.rbacMatrix as Prisma.InputJsonValue;

    if (Object.keys(updatePayload).length > 0) {
      await settingsRepository.update(tenantId, updatePayload);
    }

    return this.get(tenantId);
  }
}

export const settingsService = new SettingsService();
