import { type Request, type Response, type NextFunction } from "express";
import { notificationsService } from "@/services/notifications.service";
import { success } from "@/utils/response";

export class NotificationsController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await notificationsService.getAll(req.tenantId!);
      res.json(success("Notifications fetched successfully", data));
    } catch (err) { next(err); }
  }

  async getUnreadCount(req: Request, res: Response, next: NextFunction) {
    try {
      const count = await notificationsService.unreadCount(req.tenantId!);
      res.json(success("Unread count fetched", { count }));
    } catch (err) { next(err); }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await notificationsService.create(req.tenantId!, req.body);
      res.status(201).json(success("Notification created successfully", data));
    } catch (err) { next(err); }
  }

  async markRead(req: Request, res: Response, next: NextFunction) {
    try {
      await notificationsService.markRead(req.params.id, req.tenantId!);
      res.status(204).send();
    } catch (err) { next(err); }
  }

  async markAllRead(req: Request, res: Response, next: NextFunction) {
    try {
      await notificationsService.markAllRead(req.tenantId!);
      res.status(204).send();
    } catch (err) { next(err); }
  }
}

export const notificationsController = new NotificationsController();
