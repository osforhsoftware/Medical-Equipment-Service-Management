import { prisma } from "@/db/prisma";
import type { Notification, Prisma } from "@prisma/client";

export class NotificationsRepository {
  async findAll(tenantId: string): Promise<Notification[]> {
    return prisma.notification.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } });
  }

  async unreadCount(tenantId: string): Promise<number> {
    return prisma.notification.count({ where: { tenantId, read: false } });
  }

  async create(tenantId: string, data: Omit<Prisma.NotificationUncheckedCreateInput, "tenantId">): Promise<Notification> {
    return prisma.notification.create({ data: { ...data, tenantId } });
  }

  async markRead(id: string, tenantId: string): Promise<void> {
    await prisma.notification.updateMany({ where: { id, tenantId }, data: { read: true } });
  }

  async markAllRead(tenantId: string): Promise<void> {
    await prisma.notification.updateMany({ where: { tenantId }, data: { read: true } });
  }
}

export const notificationsRepository = new NotificationsRepository();
