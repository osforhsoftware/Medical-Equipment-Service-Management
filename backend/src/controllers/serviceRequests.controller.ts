import { type Request, type Response, type NextFunction } from "express";
import { serviceRequestsService } from "@/services/serviceRequests.service";
import { success } from "@/utils/response";

export class ServiceRequestsController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = { branchId: req.query.branchId as string, status: req.query.status as string };
      const data = await serviceRequestsService.getAll(req.tenantId!, req.user!.userId, req.user!.role, filters);
      res.json(success("Service requests fetched successfully", data));
    } catch (err) { next(err); }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await serviceRequestsService.getById(req.params.id, req.tenantId!);
      res.json(success("Service request fetched successfully", data));
    } catch (err) { next(err); }
  }

  async getTimeline(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await serviceRequestsService.getTimeline(req.params.id, req.tenantId!);
      res.json(success("Timeline fetched successfully", data));
    } catch (err) { next(err); }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await serviceRequestsService.create(req.tenantId!, req.user!.userId, req.body);
      res.status(201).json(success("Service request created successfully", data));
    } catch (err) { next(err); }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await serviceRequestsService.update(req.params.id, req.tenantId!, req.user!.userId, req.body);
      res.json(success("Service request updated successfully", data));
    } catch (err) { next(err); }
  }

  async assign(req: Request, res: Response, next: NextFunction) {
    try {
      const { assignedTo, note } = req.body as { assignedTo: string; note?: string };
      const data = await serviceRequestsService.assign(req.params.id, req.tenantId!, req.user!.userId, assignedTo, note);
      res.json(success("Service request assigned successfully", data));
    } catch (err) { next(err); }
  }

  async workflow(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, note } = req.body as { status: string; note: string };
      const data = await serviceRequestsService.advanceWorkflow(req.params.id, req.tenantId!, req.user!.userId, status, note);
      res.json(success("Workflow advanced successfully", data));
    } catch (err) { next(err); }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await serviceRequestsService.delete(req.params.id, req.tenantId!);
      res.status(204).send();
    } catch (err) { next(err); }
  }
}

export const serviceRequestsController = new ServiceRequestsController();
