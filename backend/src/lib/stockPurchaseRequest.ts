import type { Prisma, PrismaClient } from "@prisma/client";

type Db = Prisma.TransactionClient | PrismaClient;

export type StockPurchaseRequestInput = {
  tenantId: string;
  inventoryItemId: string;
  quantity: number;
  requestedBy: string;
  serviceRequestId?: string | null;
  jobId?: string | null;
  note?: string | null;
};

function openWhere(input: Pick<StockPurchaseRequestInput, "tenantId" | "inventoryItemId" | "jobId" | "serviceRequestId">) {
  return {
    tenantId: input.tenantId,
    inventoryItemId: input.inventoryItemId,
    status: "open",
    purchaseOrderId: null,
    ...(input.jobId
      ? { jobId: input.jobId }
      : { jobId: null, serviceRequestId: input.serviceRequestId ?? null }),
  };
}

export async function upsertOpenStockPurchaseRequest(db: Db, input: StockPurchaseRequestInput) {
  const quantity = Math.max(0, Math.ceil(Number(input.quantity) || 0));
  const where = openWhere(input);

  if (quantity <= 0) {
    await db.stockPurchaseRequest.deleteMany({ where });
    return { request: null, created: false };
  }

  const existing = await db.stockPurchaseRequest.findFirst({
    where,
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    const request = await db.stockPurchaseRequest.update({
      where: { id: existing.id },
      data: {
        quantity,
        requestedBy: input.requestedBy,
        note: input.note ?? existing.note,
        serviceRequestId: input.serviceRequestId ?? existing.serviceRequestId,
        jobId: input.jobId ?? existing.jobId,
      },
      include: { inventoryItem: true },
    });
    return { request, created: false };
  }

  const request = await db.stockPurchaseRequest.create({
    data: {
      tenantId: input.tenantId,
      inventoryItemId: input.inventoryItemId,
      quantity,
      requestedBy: input.requestedBy,
      serviceRequestId: input.serviceRequestId ?? null,
      jobId: input.jobId ?? null,
      note: input.note,
    },
    include: { inventoryItem: true },
  });
  return { request, created: true };
}

export async function cancelOpenStockPurchaseRequest(
  db: Db,
  input: Pick<StockPurchaseRequestInput, "tenantId" | "inventoryItemId" | "jobId" | "serviceRequestId">,
) {
  await db.stockPurchaseRequest.deleteMany({ where: openWhere(input) });
}

export async function notifyStockPurchaseRequest(
  db: Db,
  tenantId: string,
  body: string,
  roles: string[] = ["inventory", "admin", "coordinator"],
) {
  if (!roles.length) return;
  await db.notification.createMany({
    data: roles.map((recipientRole) => ({
      tenantId,
      type: "stock",
      title: "Stock purchase request",
      body,
      recipientRole,
    })),
  });
}

export async function syncJobExtraStockRequest(
  db: Db,
  params: {
    tenantId: string;
    actorId: string;
    jobId: string;
    serviceRequestId?: string | null;
    jobReference?: string | null;
    inventoryItemId?: string | null;
    previousInventoryItemId?: string | null;
    note?: string | null;
  },
) {
  if (
    params.previousInventoryItemId &&
    params.previousInventoryItemId !== params.inventoryItemId
  ) {
    await syncJobExtraStockRequest(db, {
      ...params,
      inventoryItemId: params.previousInventoryItemId,
      previousInventoryItemId: null,
    });
  }

  if (!params.inventoryItemId) return null;

  const item = await db.inventoryItem.findFirst({
    where: { id: params.inventoryItemId, tenantId: params.tenantId },
  });
  if (!item) return null;

  const extras = await db.jobExtra.findMany({
    where: {
      tenantId: params.tenantId,
      jobId: params.jobId,
      inventoryItemId: params.inventoryItemId,
      status: { in: ["pending", "approved"] },
    },
  });
  const quantity = extras.reduce(
    (sum, extra) => sum + Math.max(0, Math.ceil(Number(extra.quantity) || 0)),
    0,
  );

  const { request, created } = await upsertOpenStockPurchaseRequest(db, {
    tenantId: params.tenantId,
    inventoryItemId: item.id,
    quantity,
    requestedBy: params.actorId,
    serviceRequestId: params.serviceRequestId,
    jobId: params.jobId,
    note:
      params.note?.trim() ||
      `Requested ${quantity} × ${item.name} for ${params.jobReference ?? "job"}`,
  });

  if (created && request) {
    await notifyStockPurchaseRequest(
      db,
      params.tenantId,
      `${quantity} × ${item.name} (${item.sku}) requested for ${params.jobReference ?? "job"}`,
    );
  }

  return request;
}
