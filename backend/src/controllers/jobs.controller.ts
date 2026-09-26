import { type Request, type Response, type NextFunction } from "express";
import { jobsService } from "@/services/jobs.service";
import { parseJobListQuery, sendPaginatedList } from "@/utils/listQuery";
import { parseCompletedScope } from "@/lib/ticketBoardArchive";
import { success } from "@/utils/response";

export class JobsController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const query = parseJobListQuery(req);
      const { data, total } = await jobsService.getPaginated(
        req.tenantId!,
        req.user!.userId,
        req.user!.role,
        {
          status: query.status,
          search: query.search,
          scheduledFrom: query.scheduledFrom,
          scheduledTo: query.scheduledTo,
          overdue: query.overdue || undefined,
          engineerId: query.assignee || undefined,
          qaScope: query.qaScope,
          completedScope: parseCompletedScope(query.completedScope),
          customerId: query.customerId,
          skip: query.skip,
          take: query.take,
          orderBy: query.orderBy,
        },
      );
      sendPaginatedList(res, "Jobs fetched successfully", data, total, query.page, query.limit);
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
      const data = await jobsService.create(req.tenantId!, req.body, req.user!.userId);
      res.status(201).json(success("Job created successfully", data));
    } catch (err) { next(err); }
  }

  async createRework(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await jobsService.createRework(req.tenantId!, req.params.id, req.user!.userId, req.body?.note);
      res.status(201).json(success("Rework job created", data));
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

  async saveWorkReport(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await jobsService.saveWorkReport(
        req.params.id,
        req.tenantId!,
        req.user!.userId,
        req.user!.role,
        req.body,
      );
      res.json(success("Work report saved", data));
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
        req.body.lines ?? [],
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
        {
          lineId: req.body.lineId,
          batchNumber: req.body.batchNumber,
          serialNumbers: req.body.serialNumbers,
        },
      );
      res.status(201).json(success("Stock deducted successfully", data));
    } catch (err) { next(err); }
  }

  async returnStock(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await jobsService.returnStock(
        req.params.id,
        req.tenantId!,
        req.user!.userId,
        req.user!.role,
        req.body.inventoryItemId,
        req.body.quantity,
        {
          disposition: req.body.disposition,
          lineId: req.body.lineId,
          batchNumber: req.body.batchNumber,
          serialNumbers: req.body.serialNumbers,
        },
      );
      res.status(201).json(success(
        req.body.disposition === "scrap" ? "Unused parts scrapped" : "Unused parts returned",
        data,
      ));
    } catch (err) { next(err); }
  }

  async addActivity(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await jobsService.addActivity(
        req.params.id,
        req.tenantId!,
        req.body,
        req.user!.userId,
        req.user!.role,
      );
      res.status(201).json(success("Job activity logged", data));
    } catch (err) { next(err); }
  }

  async getActivities(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await jobsService.getActivities(
        req.params.id,
        req.tenantId!,
        req.user!.userId,
        req.user!.role,
      );
      res.json(success("Job activities fetched", data));
    } catch (err) { next(err); }
  }
}

export const jobsController = new JobsController();
