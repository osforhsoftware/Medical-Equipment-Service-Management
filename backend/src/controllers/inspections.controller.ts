import { type Request, type Response, type NextFunction } from "express";
import { inspectionsService } from "@/services/inspections.service";
import { success } from "@/utils/response";

export class InspectionsController {
  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await inspectionsService.getByRequestId(
        req.params.requestId,
        req.tenantId!,
        req.user!.userId,
        req.user!.role,
      );
      res.json(success("Inspection report fetched", data));
    } catch (err) { next(err); }
  }

  async createOrUpdate(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await inspectionsService.createOrUpdate(
        req.params.requestId,
        req.tenantId!,
        req.user!.userId,
        req.user!.role,
        req.body,
      );
      res.json(success("Inspection report saved", data));
    } catch (err) { next(err); }
  }
}

export const inspectionsController = new InspectionsController();
