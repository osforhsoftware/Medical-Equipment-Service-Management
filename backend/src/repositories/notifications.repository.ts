import { prisma } from "@/db/prisma";
import type { Notification, Prisma } from "@prisma/client";

export class NotificationsRepository {
  private visibleWhere(tenantId: string, userId: string, roles: string[]): Prisma.NotificationWhereInput {
    return {
      tenantId,
      OR: [
        { recipientUserId: userId },
        { recipientRole: { in: roles } },
        { recipientUserId: null, recipientRole: null },
      ],
    };
  }

  async findAll(tenantId: string, userId: string, roles: string[]) {
    const notifications = await prisma.notification.findMany({
      where: this.visibleWhere(tenantId, userId, roles),
      include: { reads: { where: { userId }, select: { readAt: true } } },
      orderBy: { createdAt: "desc" },
    });
    return notifications.map(({ reads, ...notification }) => ({
      ...notification,
      read: notification.read || reads.length > 0,
      readAt: reads[0]?.readAt ?? null,
    }));
  }

  async unreadCount(tenantId: string, userId: string, roles: string[]): Promise<number> {
    return prisma.notification.count({
      where: {
        ...this.visibleWhere(tenantId, userId, roles),
        read: false,
        reads: { none: { userId } },
      },
    });
  }

  async create(tenantId: string, data: Omit<Prisma.NotificationUncheckedCreateInput, "tenantId">): Promise<Notification> {
    return prisma.notification.create({ data: { ...data, tenantId } });
  }

  async markRead(id: string, tenantId: string, userId: string, roles: string[]): Promise<void> {
    const notification = await prisma.notification.findFirst({
      where: { id, ...this.visibleWhere(tenantId, userId, roles) },
      select: { id: true },
    });
    if (!notification) return;
    await prisma.notificationRead.upsert({
      where: { notificationId_userId: { notificationId: id, userId } },
      create: { notificationId: id, userId },
      update: { readAt: new Date() },
    });
  }

  async markAllRead(tenantId: string, userId: string, roles: string[]): Promise<void> {
    const notifications = await prisma.notification.findMany({
      where: this.visibleWhere(tenantId, userId, roles),
      select: { id: true },
    });
    await prisma.notificationRead.createMany({
      data: notifications.map(({ id }) => ({ notificationId: id, userId })),
      skipDuplicates: true,
    });
  }
}

export const notificationsRepository = new NotificationsRepository();
