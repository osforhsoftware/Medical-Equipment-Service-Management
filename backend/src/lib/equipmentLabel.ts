import { prisma } from "@/db/prisma";

/** Same label stored on service tickets: "Name (Model)". */
export function equipmentTicketLabel(equipment: { name: string; model?: string | null }) {
  const name = equipment.name.trim();
  const model = equipment.model?.trim();
  return model ? `${name} (${model})` : name;
}

/** Copy the current equipment name onto tickets, jobs, estimates, and warranty claims. */
export async function syncEquipmentNameSnapshots(
  tenantId: string,
  equipmentId: string,
  equipment: { name: string; model?: string | null; assetTag?: string | null },
) {
  const label = equipmentTicketLabel(equipment);
  const name = equipment.name.trim();
  const assetTag = equipment.assetTag?.trim() ?? "";

  await prisma.$transaction([
    prisma.serviceRequestEquipment.updateMany({
      where: { equipmentId, serviceRequest: { tenantId } },
      data: { equipmentName: label, assetTag },
    }),
    prisma.serviceRequest.updateMany({
      where: { tenantId, equipmentId },
      data: { equipmentName: label },
    }),
    prisma.serviceJob.updateMany({
      where: { tenantId, equipmentId },
      data: { equipmentName: name },
    }),
    prisma.estimate.updateMany({
      where: { tenantId, equipmentId },
      data: { equipmentName: name },
    }),
    prisma.warrantyClaim.updateMany({
      where: { tenantId, equipmentId },
      data: { equipmentName: name },
    }),
  ]);

  const requests = await prisma.serviceRequest.findMany({
    where: { tenantId, equipmentId },
    select: { id: true },
  });
  const requestIds = requests.map((row) => row.id);
  if (!requestIds.length) return;

  await prisma.serviceJob.updateMany({
    where: { tenantId, equipmentId: null, serviceRequestId: { in: requestIds } },
    data: { equipmentName: name },
  });
  await prisma.estimate.updateMany({
    where: { tenantId, equipmentId: null, serviceRequestId: { in: requestIds } },
    data: { equipmentName: name },
  });
}
