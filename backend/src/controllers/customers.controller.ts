import { type Request, type Response, type NextFunction } from "express";
import { customersService } from "@/services/customers.service";
import { parseCustomerListQuery, sendPaginatedList } from "@/utils/listQuery";
import { success } from "@/utils/response";

export class CustomersController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const query = parseCustomerListQuery(req);
      const { data, total } = await customersService.getPaginated(req.tenantId!, {
        status: query.status,
        type: query.type,
        search: query.search,
        skip: query.skip,
        take: query.take,
        orderBy: query.orderBy,
      });
      sendPaginatedList(res, "Customers fetched successfully", data, total, query.page, query.limit);
    } catch (err) { next(err); }
  }

  async previewReference(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await customersService.previewReference(req.tenantId!);
      res.json(success("Next customer reference", data));
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
      const data = await customersService.delete(req.params.id, req.tenantId!);
      res.json(success("Customer removed successfully", data));
    } catch (err) { next(err); }
  }

  async restore(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await customersService.restore(req.params.id, req.tenantId!);
      res.json(success("Customer restored successfully", data));
    } catch (err) { next(err); }
  }

  async listContacts(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await customersService.listContacts(req.params.id, req.tenantId!);
      res.json(success("Customer contacts fetched", data));
    } catch (err) { next(err); }
  }

  async createContact(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await customersService.createContact(req.params.id, req.tenantId!, req.body);
      res.status(201).json(success("Contact added", data));
    } catch (err) { next(err); }
  }

  async updateContact(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await customersService.updateContact(req.params.id, req.params.contactId, req.tenantId!, req.body);
      res.json(success("Contact updated", data));
    } catch (err) { next(err); }
  }

  async deleteContact(req: Request, res: Response, next: NextFunction) {
    try {
      await customersService.deleteContact(req.params.id, req.params.contactId, req.tenantId!);
      res.status(204).send();
    } catch (err) { next(err); }
  }
}

export const customersController = new CustomersController();
