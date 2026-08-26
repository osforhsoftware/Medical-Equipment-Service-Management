import { type Request, type Response, type NextFunction } from "express";
import { salesService } from "@/services/sales.service";
import { success } from "@/utils/response";

function actor(req: Request) {
  return { userId: req.user!.userId, name: req.user!.name, role: req.user!.role };
}

export class SalesController {
  async getDesk(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await salesService.getDesk(req.tenantId!);
      res.json(success("Sales desk fetched successfully", data));
    } catch (err) {
      next(err);
    }
  }

  async listOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await salesService.listOrders(req.tenantId!);
      res.json(success("Sales orders fetched successfully", data));
    } catch (err) {
      next(err);
    }
  }

  async getOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await salesService.getOrder(req.tenantId!, req.params.id);
      res.json(success("Sales order fetched successfully", data));
    } catch (err) {
      next(err);
    }
  }

  async convertQuote(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await salesService.convertQuote(req.tenantId!, req.params.estimateId, actor(req), req.body);
      res.status(201).json(success("Sales order created successfully", data));
    } catch (err) {
      next(err);
    }
  }

  async createOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await salesService.createOrder(req.tenantId!, actor(req), req.body);
      res.status(201).json(success("Sale recorded successfully", data));
    } catch (err) {
      next(err);
    }
  }

  async updateOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await salesService.updateOrder(req.tenantId!, req.params.id, req.body);
      res.json(success("Sale updated successfully", data));
    } catch (err) {
      next(err);
    }
  }

  async deliver(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await salesService.deliver(req.tenantId!, req.params.id, req.user!.userId);
      res.json(success("Sales order delivered and stock deducted", data));
    } catch (err) {
      next(err);
    }
  }

  async createInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await salesService.createInvoice(req.tenantId!, req.params.id, req.body);
      res.status(201).json(success("Invoice created from sales order", data));
    } catch (err) {
      next(err);
    }
  }

  async getReports(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await salesService.getReports(req.tenantId!);
      res.json(success("Sales reports fetched successfully", data));
    } catch (err) {
      next(err);
    }
  }
}

export const salesController = new SalesController();
