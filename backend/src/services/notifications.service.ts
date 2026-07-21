import { prisma } from "@/db/prisma";
import { notificationsRepository } from "@/repositories/notifications.repository";
import type { NotificationType } from "@prisma/client";

export class NotificationsService {
  async getAll(tenantId: string) {
    await this.syncOperationalAlerts(tenantId);
    return notificationsRepository.findAll(tenantId);
  }

  unreadCount(tenantId: string) {
    return notificationsRepository.unreadCount(tenantId);
  }

  create(tenantId: string, data: { type: NotificationType; title: string; body: string }) {
    return notificationsRepository.create(tenantId, data);
  }

  markRead(id: string, tenantId: string) {
    return notificationsRepository.markRead(id, tenantId);
  }

  markAllRead(tenantId: string) {
    return notificationsRepository.markAllRead(tenantId);
  }

  private async ensureUnreadNotification(
    tenantId: string,
    type: NotificationType,
    title: string,
    body: string,
  ) {
    const existing = await prisma.notification.findFirst({
      where: { tenantId, type, title, read: false },
    });
    if (!existing) {
      await notificationsRepository.create(tenantId, { type, title, body });
    }
  }

  async syncOperationalAlerts(tenantId: string) {
    const lowStockItems = await prisma.inventoryItem.findMany({
      where: { tenantId },
      select: { name: true, inStock: true, reorderLevel: true },
    });

    for (const item of lowStockItems.filter((i) => i.inStock <= i.reorderLevel)) {
      await this.ensureUnreadNotification(
        tenantId,
        "stock",
        `Low stock: ${item.name}`,
        `${item.name} below reorder level (${item.inStock}/${item.reorderLevel}).`,
      );
    }

    const expiringAmcs = await prisma.amcContract.findMany({
      where: {
        tenantId,
        OR: [
          { status: "expiring" },
          { status: "active", endDate: { lte: new Date(Date.now() + 30 * 86400000) } },
        ],
      },
      select: { reference: true, customerName: true, endDate: true },
    });

    for (const amc of expiringAmcs) {
      const days = Math.max(0, Math.ceil((amc.endDate.getTime() - Date.now()) / 86400000));
      await this.ensureUnreadNotification(
        tenantId,
        "amc",
        `AMC expiring: ${amc.reference}`,
        `${amc.reference} (${amc.customerName}) expires in ${days} days.`,
      );
    }
  }

  async notifyEstimateApproved(
    tenantId: string,
    reference: string,
    customerName: string,
    total: number,
  ) {
    await notificationsRepository.create(tenantId, {
      type: "approval",
      title: "Estimate approved",
      body: `${customerName} approved ${reference} (₹${Number(total).toLocaleString("en-IN")}).`,
    });
  }

  async notifyJobUpdated(tenantId: string, reference: string, status: string) {
    const label = status === "inProgress" ? "In Progress" : status.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
    await notificationsRepository.create(tenantId, {
      type: "job",
      title: "Job updated",
      body: `${reference} moved to ${label}.`,
    });
  }

  async notifyAssignment(tenantId: string, reference: string, staffName: string, equipmentName: string) {
    await notificationsRepository.create(tenantId, {
      type: "job",
      title: "Work assigned",
      body: `${reference} (${equipmentName}) has been assigned to ${staffName}.`,
    });
  }

  async notifyWorkflowAdvanced(tenantId: string, reference: string, status: string, actorName: string) {
    const label = status === "inProgress" ? "In Progress" : status.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
    await notificationsRepository.create(tenantId, {
      type: "system",
      title: "Workflow updated",
      body: `${reference} moved to ${label} by ${actorName}.`,
    });
  }
}

export const notificationsService = new NotificationsService();
