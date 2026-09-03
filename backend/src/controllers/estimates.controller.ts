import { type Request, type Response, type NextFunction } from "express";
import { estimatesService } from "@/services/estimates.service";
import { parseEstimateListQuery, sendPaginatedList } from "@/utils/listQuery";
import { success } from "@/utils/response";
import { userHasAnyRoleKey } from "@/utils/userRoles";

export class EstimatesController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const query = parseEstimateListQuery(req);
      const isEstimatorOnly = await userHasAnyRoleKey(
        req.user!.userId,
        req.tenantId!,
        req.user!.role,
        ["estimator"],
      );
      const isBroadViewer = await userHasAnyRoleKey(
        req.user!.userId,
        req.tenantId!,
        req.user!.role,
        ["admin", "coordinator"],
      );
      const { data, total } = await estimatesService.getPaginated(req.tenantId!, {
        status: query.status,
        estimatorId: isEstimatorOnly && !isBroadViewer ? req.user!.userId : undefined,
        search: query.search,
        customerId: query.customerId,
        createdFrom: query.createdFrom,
        createdTo: query.createdTo,
        kind: query.kind === "sales" || query.kind === "service"
          ? query.kind
          : isEstimatorOnly && !isBroadViewer
            ? "service"
            : req.user!.role === "sales"
              ? "sales"
              : undefined,
        skip: query.skip,
        take: query.take,
        orderBy: query.orderBy,
      });
      sendPaginatedList(res, "Estimates fetched successfully", data, total, query.page, query.limit);
    } catch (err) { next(err); }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await estimatesService.getById(req.params.id, req.tenantId!);
      res.json(success("Estimate fetched successfully", data));
    } catch (err) { next(err); }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await estimatesService.create(req.tenantId!, req.user!.userId, req.user!.role, req.body);
      res.status(201).json(success("Estimate created successfully", data));
    } catch (err) { next(err); }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await estimatesService.update(req.params.id, req.tenantId!, req.body);
      res.json(success("Estimate updated successfully", data));
    } catch (err) { next(err); }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await estimatesService.delete(req.params.id, req.tenantId!);
      res.status(204).send();
    } catch (err) { next(err); }
  }
}

export const estimatesController = new EstimatesController();
