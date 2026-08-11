import { type Request, type Response, type NextFunction } from "express";
import { customersService } from "@/services/customers.service";
import { success } from "@/utils/response";

export class CustomersController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await customersService.getAll(req.tenantId!);
      res.json(success("Customers fetched successfully", data));
    } catch (err) { next(err); }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await customersService.getById(req.params.id, req.tenantId!);
      res.json(success("Customer fetched successfully", data));
    } catch (err) { next(err); }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await customersService.create(req.tenantId!, req.body);
      res.status(201).json(success("Customer created successfully", data));
    } catch (err) { next(err); }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await customersService.update(req.params.id, req.tenantId!, req.body);
      res.json(success("Customer updated successfully", data));
    } catch (err) { next(err); }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await customersService.delete(req.params.id, req.tenantId!);
      res.status(204).send();
    } catch (err) { next(err); }
  }
}

export const customersController = new CustomersController();
