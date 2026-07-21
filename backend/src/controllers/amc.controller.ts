import { type Request, type Response, type NextFunction } from "express";
import { amcService } from "@/services/amc.service";
import { success } from "@/utils/response";

export class AmcController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await amcService.getAll(req.tenantId!, req.query.status as string);
      res.json(success("AMC contracts fetched successfully", data));
    } catch (err) { next(err); }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await amcService.getById(req.params.id, req.tenantId!);
      res.json(success("AMC contract fetched successfully", data));
    } catch (err) { next(err); }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await amcService.create(req.tenantId!, req.body);
      res.status(201).json(success("AMC contract created successfully", data));
    } catch (err) { next(err); }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await amcService.update(req.params.id, req.tenantId!, req.body);
      res.json(success("AMC contract updated successfully", data));
    } catch (err) { next(err); }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await amcService.delete(req.params.id, req.tenantId!);
      res.status(204).send();
    } catch (err) { next(err); }
  }
}

export const amcController = new AmcController();
