import type { Prisma } from "@prisma/client";
import { prisma } from "@/db/prisma";
import { env } from "@/config/env";

/** Default admin + seed staff accounts preserved by `npm run db:clean`. */
export const DEFAULT_SYSTEM_USERNAMES = [
  "medical_equment",
  "coordinator1",
  "inspector1",
  "estimator1",
  "sales1",
  "engineer1",
  "engineer2",
  "inventory1",
  "billing1",
] as const;

export interface DatabaseCleanupSummary {
  tenantId: string;
  preservedUsers: number;
  removedUsers: number;
}

function assertCleanupAllowed(allowProduction = false): void {
  if (env.NODE_ENV === "production" && !allowProduction) {
    throw new Error("Database cleanup is disabled in production");
  }
}

async function deletePurchaseOrders(
  tx: Prisma.TransactionClient,
  purchaseOrderWhere: Prisma.PurchaseOrderWhereInput,
) {
  const purchaseOrderIds = (
    await tx.purchaseOrder.findMany({
      where: purchaseOrderWhere,
      select: { id: true },
    })
  ).map((order) => order.id);

  if (purchaseOrderIds.length === 0) return;

  await tx.stockPurchaseRequest.deleteMany({
    where: { purchaseOrderId: { in: purchaseOrderIds } },
  });
  await tx.purchaseReturnLine.deleteMany({
    where: { purchaseReturn: { purchaseOrderId: { in: purchaseOrderIds } } },
  });
  await tx.purchaseReturn.deleteMany({
    where: { purchaseOrderId: { in: purchaseOrderIds } },
  });
  await tx.purchaseReceiptLine.deleteMany({
    where: { receipt: { purchaseOrderId: { in: purchaseOrderIds } } },
  });
  await tx.purchaseReceipt.deleteMany({
    where: { purchaseOrderId: { in: purchaseOrderIds } },
  });
  await tx.purchaseOrder.deleteMany({
    where: { id: { in: purchaseOrderIds } },
  });
}

/** Removes inventory dependencies before inventory rows can be deleted safely. */
export async function deleteInventoryDependencies(
  tx: Prisma.TransactionClient,
  tenantId: string,
  options?: {
    inventoryItemIds?: string[];
    purchaseOrderWhere?: Prisma.PurchaseOrderWhereInput;
    stockTransferWhere?: Prisma.StockTransferWhereInput;
  },
) {
  const inventoryWhere: Prisma.InventoryItemWhereInput = {
    tenantId,
    ...(options?.inventoryItemIds ? { id: { in: options.inventoryItemIds } } : {}),
  };

  const inventoryIds =
    options?.inventoryItemIds ??
    (await tx.inventoryItem.findMany({ where: inventoryWhere, select: { id: true } })).map(
      (item) => item.id,
    );

  if (inventoryIds.length > 0) {
    await tx.stockMovement.deleteMany({
      where: { tenantId, inventoryItemId: { in: inventoryIds } },
    });
    await tx.stockReservation.deleteMany({
      where: { tenantId, inventoryItemId: { in: inventoryIds } },
    });
    await tx.stockPurchaseRequest.deleteMany({
      where: { tenantId, inventoryItemId: { in: inventoryIds } },
    });
    await tx.stockTransferLine.deleteMany({
      where: {
        tenantId,
        OR: [
          { sourceInventoryItemId: { in: inventoryIds } },
          { destinationInventoryItemId: { in: inventoryIds } },
        ],
      },
    });
  } else if (!options?.inventoryItemIds) {
    await tx.stockMovement.deleteMany({ where: { tenantId } });
    await tx.stockReservation.deleteMany({ where: { tenantId } });
    await tx.stockPurchaseRequest.deleteMany({ where: { tenantId } });
    await tx.stockTransferLine.deleteMany({ where: { tenantId } });
  }

  if (options?.stockTransferWhere) {
    await tx.stockTransfer.deleteMany({ where: options.stockTransferWhere });
  } else if (!options?.inventoryItemIds) {
    await tx.stockTransfer.deleteMany({ where: { tenantId } });
  }

  if (options?.purchaseOrderWhere) {
    await deletePurchaseOrders(tx, options.purchaseOrderWhere);
  } else if (!options?.inventoryItemIds) {
    await deletePurchaseOrders(tx, { tenantId });
  }

  await tx.inventoryItemImage.deleteMany({
    where: options?.inventoryItemIds
      ? { inventoryItemId: { in: inventoryIds } }
      : { inventoryItem: { tenantId } },
  });

  await tx.inventoryItem.deleteMany({ where: inventoryWhere });
}

async function deleteJobs(tx: Prisma.TransactionClient, tenantId: string, jobIds: string[]) {
  if (jobIds.length === 0) return;

  await tx.serviceTicketChangeRequest.deleteMany({ where: { jobId: { in: jobIds } } });
  await tx.jobActivity.deleteMany({ where: { jobId: { in: jobIds } } });
  await tx.jobStockDeduction.deleteMany({ where: { jobId: { in: jobIds } } });
  await tx.jobSignature.deleteMany({ where: { jobId: { in: jobIds } } });
  await tx.jobPartsRequest.deleteMany({ where: { jobId: { in: jobIds } } });
  await tx.jobPhoto.deleteMany({ where: { jobId: { in: jobIds } } });
  await tx.jobWorkLog.deleteMany({ where: { jobId: { in: jobIds } } });
  await tx.jobAssignment.deleteMany({ where: { jobId: { in: jobIds } } });
  await tx.jobExtra.deleteMany({ where: { jobId: { in: jobIds } } });
  await tx.serviceJob.deleteMany({ where: { id: { in: jobIds } } });
}

async function deleteServiceRequests(
  tx: Prisma.TransactionClient,
  tenantId: string,
  requestIds: string[],
) {
  if (requestIds.length === 0) return;

  await tx.serviceTicketChangeRequest.deleteMany({
    where: { serviceRequestId: { in: requestIds } },
  });
  await tx.timelineEvent.deleteMany({ where: { requestId: { in: requestIds } } });
  await tx.inspectionReport.deleteMany({ where: { serviceRequestId: { in: requestIds } } });
  await tx.serviceRequestEquipment.deleteMany({
    where: { serviceRequestId: { in: requestIds } },
  });
  await tx.serviceRequest.deleteMany({ where: { id: { in: requestIds } } });
}

export async function cleanTenantBusinessData(
  tenantId: string,
  options?: { allowProduction?: boolean; keepAllStaff?: boolean },
): Promise<DatabaseCleanupSummary> {
  assertCleanupAllowed(Boolean(options?.allowProduction));

  const keepAllStaff = Boolean(options?.keepAllStaff);
  const preservedUsernames = [...DEFAULT_SYSTEM_USERNAMES];
  const usersToRemove = keepAllStaff
    ? await prisma.user.findMany({
        where: { tenantId, role: "customer" },
        select: { id: true },
      })
    : await prisma.user.findMany({
        where: { tenantId, username: { notIn: preservedUsernames } },
        select: { id: true },
      });
  const removeUserIds = usersToRemove.map((user) => user.id);

  await prisma.$transaction(
    async (tx) => {
      const tenantWhere = { tenantId };

      const notificationIds = (
        await tx.notification.findMany({ where: tenantWhere, select: { id: true } })
      ).map((notification) => notification.id);
      if (notificationIds.length > 0) {
        await tx.notificationRead.deleteMany({
          where: { notificationId: { in: notificationIds } },
        });
      }
      await tx.notification.deleteMany({ where: tenantWhere });

      await tx.commission.deleteMany({ where: tenantWhere });
      await tx.referral.deleteMany({ where: tenantWhere });
      await tx.projectExpense.deleteMany({ where: tenantWhere });
      await tx.document.deleteMany({ where: tenantWhere });

      await tx.invoicePayment.deleteMany({ where: tenantWhere });
      await tx.invoice.deleteMany({ where: tenantWhere });
      await tx.salesOrder.deleteMany({ where: tenantWhere });

      const jobIds = (
        await tx.serviceJob.findMany({ where: tenantWhere, select: { id: true } })
      ).map((job) => job.id);
      await deleteJobs(tx, tenantId, jobIds);

      await tx.estimate.deleteMany({ where: tenantWhere });

      const requestIds = (
        await tx.serviceRequest.findMany({ where: tenantWhere, select: { id: true } })
      ).map((request) => request.id);
      await deleteServiceRequests(tx, tenantId, requestIds);

      await deleteInventoryDependencies(tx, tenantId);

      await tx.qrScan.deleteMany({ where: tenantWhere });
      await tx.equipment.deleteMany({ where: tenantWhere });
      await tx.customer.deleteMany({ where: tenantWhere });
      await tx.supplier.deleteMany({ where: tenantWhere });
      await tx.amcContract.deleteMany({ where: tenantWhere });

      await tx.officeAssetMaintenance.deleteMany({ where: tenantWhere });
      await tx.officeAsset.deleteMany({ where: tenantWhere });
      await tx.auditLog.deleteMany({ where: tenantWhere });

      const settings = await tx.tenantSettings.findUnique({
        where: { tenantId },
        select: { logoFileId: true },
      });
      await tx.storedFile.deleteMany({
        where: {
          tenantId,
          ...(settings?.logoFileId ? { id: { not: settings.logoFileId } } : {}),
        },
      });

      if (removeUserIds.length > 0) {
        await tx.passwordResetToken.deleteMany({ where: { userId: { in: removeUserIds } } });
        await tx.userRoleAssignment.deleteMany({ where: { userId: { in: removeUserIds } } });
        await tx.user.deleteMany({ where: { id: { in: removeUserIds } } });
      }

      await tx.user.updateMany({
        where: { tenantId, customerId: { not: null } },
        data: { customerId: null },
      });
    },
    { timeout: 120_000 },
  );

  const preservedUsers = keepAllStaff
    ? await prisma.user.count({ where: { tenantId, role: { not: "customer" } } })
    : await prisma.user.count({
        where: { tenantId, username: { in: preservedUsernames } },
      });

  return {
    tenantId,
    preservedUsers,
    removedUsers: removeUserIds.length,
  };
}
