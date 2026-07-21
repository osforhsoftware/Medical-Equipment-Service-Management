import { type Request, type Response, type NextFunction } from "express";
import { branchesService } from "@/services/branches.service";
import { success } from "@/utils/response";

export class BranchesController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await branchesService.getAll(req.tenantId!);
      res.json(success("Branches fetched successfully", data));
    } catch (err) { next(err); }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await branchesService.getById(req.params.id, req.tenantId!);
      res.json(success("Branch fetched successfully", data));
    } catch (err) { next(err); }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await branchesService.create(req.tenantId!, req.body);
      res.status(201).json(success("Branch created successfully", data));
    } catch (err) { next(err); }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await branchesService.update(req.params.id, req.tenantId!, req.body);
      res.json(success("Branch updated successfully", data));
    } catch (err) { next(err); }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await branchesService.delete(req.params.id, req.tenantId!);
      res.status(204).send();
    } catch (err) { next(err); }
  }
}

export const branchesController = new BranchesController();
