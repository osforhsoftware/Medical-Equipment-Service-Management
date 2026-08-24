import { prisma } from "@/db/prisma";

type RefModel = "serviceRequest" | "estimate" | "serviceJob" | "purchaseOrder" | "stockTransfer" | "salesOrder";

export async function generateReference(tenantId: string, prefix: string, model: RefModel): Promise<string> {
  const year = new Date().getFullYear();
  let count = 0;

  switch (model) {
    case "serviceRequest":
      count = await prisma.serviceRequest.count({ where: { tenantId } });
      break;
    case "estimate":
      count = await prisma.estimate.count({ where: { tenantId } });
      break;
    case "serviceJob":
      count = await prisma.serviceJob.count({ where: { tenantId } });
      break;
    case "purchaseOrder":
      count = await prisma.purchaseOrder.count({ where: { tenantId } });
      break;
    case "stockTransfer":
      count = await prisma.stockTransfer.count({ where: { tenantId } });
      break;
    case "salesOrder":
      count = await prisma.salesOrder.count({ where: { tenantId } });
      break;
  }

  return `${prefix}-${year}-${String(count + 1).padStart(4, "0")}`;
}
