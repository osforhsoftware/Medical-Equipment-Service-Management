import { type Request, type Response, type NextFunction } from "express";
import { settingsService } from "@/services/settings.service";
import { seedService } from "@/services/seed.service";
import { success } from "@/utils/response";

export class SettingsController {
  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await settingsService.get(req.tenantId!);
      res.json(success("Settings fetched successfully", data));
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await settingsService.update(req.tenantId!, req.body);
      res.json(success("Settings updated successfully", data));
    } catch (err) {
      next(err);
    }
  }

  async getDemoSeedStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await seedService.getStatus(req.tenantId!);
      res.json(success("Demo seed status fetched", data));
    } catch (err) {
      next(err);
    }
  }

  async seedDemo(req: Request, res: Response, next: NextFunction) {
    try {
      const actorName = req.user?.email ?? "Administrator";
      const data = await seedService.seedDemo(req.tenantId!, actorName);
      res.json(success("Demo data seeded successfully", data));
    } catch (err) {
      next(err);
    }
  }

  async removeDemo(req: Request, res: Response, next: NextFunction) {
    try {
      const actorName = req.user?.email ?? "Administrator";
      const data = await seedService.removeDemo(req.tenantId!, actorName);
      res.json(success("Demo data removed successfully", data));
    } catch (err) {
      next(err);
    }
  }
}

export const settingsController = new SettingsController();
