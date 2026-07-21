import { type Request, type Response, type NextFunction } from "express";
import { stockTransfersService } from "@/services/stockTransfers.service";
import { success } from "@/utils/response";

export class StockTransfersController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await stockTransfersService.getAll(req.tenantId!);
      res.json(success("Stock transfers fetched successfully", data));
    } catch (err) { next(err); }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await stockTransfersService.getById(req.params.id, req.tenantId!);
      res.json(success("Stock transfer fetched successfully", data));
    } catch (err) { next(err); }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await stockTransfersService.create(req.tenantId!, req.body);
      res.status(201).json(success("Stock transfer created successfully", data));
    } catch (err) { next(err); }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await stockTransfersService.update(req.params.id, req.tenantId!, req.body);
      res.json(success("Stock transfer updated successfully", data));
    } catch (err) { next(err); }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await stockTransfersService.delete(req.params.id, req.tenantId!);
      res.status(204).send();
    } catch (err) { next(err); }
  }
}

export const stockTransfersController = new StockTransfersController();
