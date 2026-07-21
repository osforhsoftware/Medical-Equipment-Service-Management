import { type Request, type Response, type NextFunction } from "express";
import { jobsService } from "@/services/jobs.service";
import { success } from "@/utils/response";

export class JobsController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await jobsService.getAll(
        req.tenantId!,
        req.user!.userId,
        req.user!.role,
        req.query.status as string,
      );
      res.json(success("Jobs fetched successfully", data));
    } catch (err) { next(err); }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await jobsService.getById(
        req.params.id,
        req.tenantId!,
        req.user!.userId,
        req.user!.role,
      );
      res.json(success("Job fetched successfully", data));
    } catch (err) { next(err); }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await jobsService.create(req.tenantId!, req.body);
      res.status(201).json(success("Job created successfully", data));
    } catch (err) { next(err); }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await jobsService.update(
        req.params.id,
        req.tenantId!,
        req.body,
        req.user!.userId,
        req.user!.role,
      );
      res.json(success("Job updated successfully", data));
    } catch (err) { next(err); }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await jobsService.delete(req.params.id, req.tenantId!);
      res.status(204).send();
    } catch (err) { next(err); }
  }

  async uploadPhotos(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await jobsService.uploadPhotos(
        req.params.id,
        req.tenantId!,
        req.user!.userId,
        req.user!.role,
        req.body.photos,
      );
      res.status(201).json(success("Photos uploaded successfully", data));
    } catch (err) { next(err); }
  }

  async requestParts(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await jobsService.requestParts(
        req.params.id,
        req.tenantId!,
        req.user!.userId,
        req.user!.role,
        req.body.notes,
      );
      res.status(201).json(success("Parts request submitted", data));
    } catch (err) { next(err); }
  }

  async captureSignature(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await jobsService.captureSignature(
        req.params.id,
        req.tenantId!,
        req.user!.userId,
        req.user!.role,
        req.body,
      );
      res.status(201).json(success("Signature captured", data));
    } catch (err) { next(err); }
  }

  async deductStock(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await jobsService.deductStock(
        req.params.id,
        req.tenantId!,
        req.user!.userId,
        req.user!.role,
        req.body.inventoryItemId,
        req.body.quantity,
      );
      res.status(201).json(success("Stock deducted successfully", data));
    } catch (err) { next(err); }
  }

  async getActivities(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await jobsService.getActivities(req.params.id, req.tenantId!);
      res.json(success("Job activities fetched", data));
    } catch (err) { next(err); }
  }
}

export const jobsController = new JobsController();
