import { type Request, type Response, type NextFunction } from "express";
import { dashboardService } from "@/services/dashboard.service";
import { success } from "@/utils/response";

export class DashboardController {
  async getOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const branchId = req.query.branchId as string | undefined;
      const data = await dashboardService.getOverview(req.tenantId!, branchId);
      res.json(success("Dashboard fetched successfully", data));
    } catch (err) {
      next(err);
    }
  }
}

export const dashboardController = new DashboardController();
