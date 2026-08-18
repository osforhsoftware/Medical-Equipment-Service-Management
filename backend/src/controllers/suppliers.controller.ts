import { type Request, type Response, type NextFunction } from "express";
import { suppliersService } from "@/services/suppliers.service";
import { parseSupplierListQuery, sendPaginatedList } from "@/utils/listQuery";
import { success } from "@/utils/response";

export class SuppliersController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const query = parseSupplierListQuery(req);
      const { data, total } = await suppliersService.getPaginated(req.tenantId!, {
        search: query.search,
        skip: query.skip,
        take: query.take,
        orderBy: query.orderBy,
      });
      sendPaginatedList(res, "Suppliers fetched successfully", data, total, query.page, query.limit);
    } catch (err) { next(err); }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await suppliersService.getById(req.params.id, req.tenantId!);
      res.json(success("Supplier fetched successfully", data));
    } catch (err) { next(err); }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await suppliersService.create(req.tenantId!, req.body);
      res.status(201).json(success("Supplier created successfully", data));
    } catch (err) { next(err); }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await suppliersService.update(req.params.id, req.tenantId!, req.body);
      res.json(success("Supplier updated successfully", data));
    } catch (err) { next(err); }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await suppliersService.delete(req.params.id, req.tenantId!);
      res.status(204).send();
    } catch (err) { next(err); }
  }
}

export const suppliersController = new SuppliersController();
