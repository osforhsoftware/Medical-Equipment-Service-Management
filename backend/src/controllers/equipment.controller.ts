import { type Request, type Response, type NextFunction } from "express";
import { equipmentService } from "@/services/equipment.service";
import { success } from "@/utils/response";

export class EquipmentController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = { branchId: req.query.branchId as string, customerId: req.query.customerId as string };
      const data = await equipmentService.getAll(req.tenantId!, filters);
      res.json(success("Equipment fetched successfully", data));
    } catch (err) { next(err); }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await equipmentService.getById(req.params.id, req.tenantId!);
      res.json(success("Equipment fetched successfully", data));
    } catch (err) { next(err); }
  }

  async getByTag(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await equipmentService.getByAssetTag(req.params.tag, req.tenantId!);
      res.json(success("Equipment fetched successfully", data));
    } catch (err) { next(err); }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await equipmentService.create(req.tenantId!, req.body);
      res.status(201).json(success("Equipment created successfully", data));
    } catch (err) { next(err); }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await equipmentService.update(req.params.id, req.tenantId!, req.body);
      res.json(success("Equipment updated successfully", data));
    } catch (err) { next(err); }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await equipmentService.delete(req.params.id, req.tenantId!);
      res.status(204).send();
    } catch (err) { next(err); }
  }
}

export const equipmentController = new EquipmentController();
