import { prisma } from "@/db/prisma";

export type JobWorkbenchScopeLine = {
  description: string;
  quantity: number;
  type: string;
};

export type JobWorkbenchEquipment = {
  assetTag: string | null;
  model: string | null;
  serialNumber: string | null;
  location: string | null;
};

export type JobWorkbenchContext = {
  complaint: string | null;
  inspectionDiagnosis: string | null;
  approvedRepairScope: JobWorkbenchScopeLine[];
  priority: string | null;
  targetDate: string | null;
  customerRestrictions: string | null;
  equipment: JobWorkbenchEquipment | null;
};

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function loadJobWorkbenchContext(
  tenantId: string,
  job: {
    serviceRequestId?: string | null;
    estimateId?: string | null;
    customerId?: string | null;
    equipmentId?: string | null;
  },
): Promise<JobWorkbenchContext> {
  const [ticket, estimate, customer, equipment] = await Promise.all([
    job.serviceRequestId
      ? prisma.serviceRequest.findFirst({
          where: { id: job.serviceRequestId, tenantId },
          select: {
            description: true,
            priority: true,
            slaDue: true,
            inspectionReport: {
              select: {
                findings: true,
                recommendation: true,
                technicianRemarks: true,
              },
            },
          },
        })
      : Promise.resolve(null),
    job.estimateId
      ? prisma.estimate.findFirst({
          where: { id: job.estimateId, tenantId },
          select: {
            status: true,
            notes: true,
            lineItems: {
              orderBy: { createdAt: "asc" },
              select: { description: true, quantity: true, type: true, revisionId: true },
            },
          },
        })
      : Promise.resolve(null),
    job.customerId
      ? prisma.customer.findFirst({
          where: { id: job.customerId, tenantId },
        })
      : Promise.resolve(null),
    job.equipmentId
      ? prisma.equipment.findFirst({
          where: { id: job.equipmentId, tenantId },
          select: { assetTag: true, model: true, serialNumber: true, location: true },
        })
      : Promise.resolve(null),
  ]);

  const inspection = ticket?.inspectionReport;
  const diagnosisParts = [
    trimOrNull(inspection?.findings),
    inspection?.recommendation ? `Recommendation: ${inspection.recommendation.trim()}` : null,
    inspection?.technicianRemarks ? `Remarks: ${inspection.technicianRemarks.trim()}` : null,
  ].filter(Boolean);

  const approved =
    estimate && ["approved", "converted"].includes(estimate.status)
      ? estimate
      : null;
  const currentLines =
    approved?.lineItems.filter((line) => !line.revisionId) ?? [];
  const scopeLines = currentLines.length ? currentLines : (approved?.lineItems ?? []);

  return {
    complaint: trimOrNull(ticket?.description),
    inspectionDiagnosis: diagnosisParts.length ? diagnosisParts.join("\n") : null,
    approvedRepairScope: scopeLines.map((line) => ({
      description: line.description,
      quantity: Number(line.quantity) || 0,
      type: line.type,
    })),
    priority: ticket?.priority ?? null,
    targetDate: ticket?.slaDue ? ticket.slaDue.toISOString() : null,
    customerRestrictions:
      trimOrNull((customer as { restrictions?: string | null } | null)?.restrictions) ??
      trimOrNull(customer?.note),
    equipment: equipment
      ? {
          assetTag: trimOrNull(equipment.assetTag),
          model: trimOrNull(equipment.model),
          serialNumber: trimOrNull(equipment.serialNumber),
          location: trimOrNull(equipment.location),
        }
      : null,
  };
}

export function summarizeStockDeductions(
  deductions: { id: string; inventoryItemId: string; itemName: string; sku: string; quantity: number; deductedBy: string; createdAt: Date }[],
  movements: { inventoryItemId: string; type: string; quantity: number }[],
) {
  const returnedByItem = new Map<string, number>();
  for (const movement of movements) {
    if (movement.type !== "return" && movement.type !== "scrap") continue;
    returnedByItem.set(
      movement.inventoryItemId,
      (returnedByItem.get(movement.inventoryItemId) ?? 0) + Math.abs(movement.quantity),
    );
  }

  const grouped = new Map<string, (typeof deductions)[number]>();
  for (const deduction of deductions) {
    const existing = grouped.get(deduction.inventoryItemId);
    if (existing) {
      existing.quantity += deduction.quantity;
    } else {
      grouped.set(deduction.inventoryItemId, { ...deduction });
    }
  }

  return [...grouped.values()].map((deduction) => {
    const returned = returnedByItem.get(deduction.inventoryItemId) ?? 0;
    return {
      ...deduction,
      returnedQuantity: returned,
      returnableQuantity: Math.max(0, deduction.quantity - returned),
    };
  });
}
