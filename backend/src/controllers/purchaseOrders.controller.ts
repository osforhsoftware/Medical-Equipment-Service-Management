import { type Request, type Response, type NextFunction } from "express";
import { purchaseOrdersService } from "@/services/purchaseOrders.service";
import { success } from "@/utils/response";

export class PurchaseOrdersController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await purchaseOrdersService.getAll(req.tenantId!, req.query.status as string);
      res.json(success("Purchase orders fetched successfully", data));
    } catch (err) { next(err); }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await purchaseOrdersService.getById(req.params.id, req.tenantId!);
      res.json(success("Purchase order fetched successfully", data));
    } catch (err) { next(err); }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await purchaseOrdersService.create(req.tenantId!, req.body);
      res.status(201).json(success("Purchase order created successfully", data));
    } catch (err) { next(err); }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await purchaseOrdersService.update(req.params.id, req.tenantId!, req.body);
      res.json(success("Purchase order updated successfully", data));
    } catch (err) { next(err); }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await purchaseOrdersService.delete(req.params.id, req.tenantId!);
      res.status(204).send();
    } catch (err) { next(err); }
  }
}

export const purchaseOrdersController = new PurchaseOrdersController();
