import { type Request, type Response, type NextFunction } from "express";
import { inventoryService } from "@/services/inventory.service";
import { success } from "@/utils/response";

export class InventoryController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await inventoryService.getAll(req.tenantId!);
      res.json(success("Inventory fetched successfully", data));
    } catch (err) { next(err); }
  }

  async getLowStock(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await inventoryService.getLowStock(req.tenantId!);
      res.json(success("Low stock items fetched successfully", data));
    } catch (err) { next(err); }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await inventoryService.getById(req.params.id, req.tenantId!);
      res.json(success("Inventory item fetched successfully", data));
    } catch (err) { next(err); }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await inventoryService.create(req.tenantId!, req.body);
      res.status(201).json(success("Inventory item created successfully", data));
    } catch (err) { next(err); }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await inventoryService.update(req.params.id, req.tenantId!, req.body);
      res.json(success("Inventory item updated successfully", data));
    } catch (err) { next(err); }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await inventoryService.delete(req.params.id, req.tenantId!);
      res.status(204).send();
    } catch (err) { next(err); }
  }

  async adjust(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await inventoryService.adjustStock(
        req.params.id,
        req.tenantId!,
        req.user!.userId,
        req.body.quantityDelta,
        req.body.reason,
      );
      res.json(success("Stock adjusted successfully", data));
    } catch (err) { next(err); }
  }
}

export const inventoryController = new InventoryController();
