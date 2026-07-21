import { type Request, type Response, type NextFunction } from "express";
import { auditLogsRepository } from "@/repositories/auditLogs.repository";

export class AuditLogsController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Math.max(1, parseInt(req.query.page as string ?? "1"));
      const limit = Math.min(100, parseInt(req.query.limit as string ?? "50"));

      const { data, total } = await auditLogsRepository.findAll(req.tenantId!, page, limit);

      res.json({
        success: true,
        message: "Audit logs fetched successfully",
        data,
        meta: { total, page, limit },
      });
    } catch (err) { next(err); }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { action, entity } = req.body;
      const data = await auditLogsRepository.create({
        tenantId: req.tenantId!,
        actor: req.user!.email,
        role: req.user!.role,
        action,
        entity,
        ip: req.ip ?? "unknown",
      });
      res.status(201).json({ success: true, message: "Audit log created", data });
    } catch (err) { next(err); }
  }
}

export const auditLogsController = new AuditLogsController();
