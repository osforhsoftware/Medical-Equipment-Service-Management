import { type Request, type Response, type NextFunction } from "express";
import { inventoryService } from "@/services/inventory.service";
import { jobPartsService } from "@/services/jobParts.service";
import { parseInventoryListQuery, sendPaginatedList } from "@/utils/listQuery";
import { success } from "@/utils/response";

export class InventoryController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const query = parseInventoryListQuery(req);
      const { data, total } = await inventoryService.getPaginated(req.tenantId!, {
        category: query.category,
        itemClass: query.itemClass,
        stockStatus: query.stockStatus,
        supplierId: query.supplierId,
        status: query.status,
        search: query.search,
        skip: query.skip,
        take: query.take,
        orderBy: query.orderBy,
      });
      sendPaginatedList(res, "Inventory fetched successfully", data, total, query.page, query.limit);
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
      const data = await inventoryService.delete(req.params.id, req.tenantId!);
      res.json(success("Inventory item moved to trash", data));
    } catch (err) { next(err); }
  }

  async restore(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await inventoryService.restore(req.params.id, req.tenantId!);
      res.json(success("Inventory item restored successfully", data));
    } catch (err) { next(err); }
  }

  async listPartsRequests(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await jobPartsService.list(req.tenantId!, typeof req.query.status === "string" ? req.query.status : undefined);
      res.json(success("Parts requests fetched", data));
    } catch (err) { next(err); }
  }

  async approvePartsRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await jobPartsService.approve(req.params.requestId, req.tenantId!, req.user!.userId, req.body.lines);
      res.json(success("Parts request approved", data));
    } catch (err) { next(err); }
  }

  async rejectPartsRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await jobPartsService.reject(req.params.requestId, req.tenantId!, req.user!.userId, req.body.reason);
      res.json(success("Parts request rejected", data));
    } catch (err) { next(err); }
  }

  async issuePartsRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await jobPartsService.issue(req.params.requestId, req.tenantId!, req.user!.userId, req.body.lines);
      res.status(201).json(success("Parts issued", data));
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
