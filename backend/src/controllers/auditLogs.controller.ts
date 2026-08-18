import { type Request, type Response, type NextFunction } from "express";
import { auditLogsRepository } from "@/repositories/auditLogs.repository";
import { auditLogsService } from "@/services/auditLogs.service";
import { sendPaginatedList } from "@/utils/listQuery";
import { parsePaginationQuery, parseSearchQuery } from "@/utils/pagination";

export class AuditLogsController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = parsePaginationQuery(req.query);
      const search = parseSearchQuery(req.query);
      const role = typeof req.query.role === "string" && req.query.role !== "all" ? req.query.role : undefined;

      const { data, total } = await auditLogsRepository.findAll(req.tenantId!, page, limit, search, role);
      const enriched = await auditLogsService.enrichLogs(data, req.tenantId!);

      sendPaginatedList(res, "Audit logs fetched successfully", enriched, total, page, limit);
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