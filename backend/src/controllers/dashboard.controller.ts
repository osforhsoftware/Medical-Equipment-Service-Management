import { type Request, type Response, type NextFunction } from "express";
import { dashboardService } from "@/services/dashboard.service";
import { success } from "@/utils/response";

export class DashboardController {
  async getOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const from = typeof req.query.from === "string" ? req.query.from : undefined;
      const to = typeof req.query.to === "string" ? req.query.to : undefined;
      const data = await dashboardService.getOverview(
        req.tenantId!,
        req.user!.userId,
        req.user!.role,
        { from, to },
      );
      res.json(success("Dashboard fetched successfully", data));
    } catch (err) {
      next(err);
    }
  }
}

export const dashboardController = new DashboardController();
