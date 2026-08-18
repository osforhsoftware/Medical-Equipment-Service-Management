import { type Request, type Response, type NextFunction } from "express";
import { serviceRequestsService } from "@/services/serviceRequests.service";
import { serviceTicketWorkflowService } from "@/services/serviceTicketWorkflow.service";
import { parseServiceRequestListQuery, sendPaginatedList } from "@/utils/listQuery";
import { success } from "@/utils/response";

export class ServiceRequestsController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const query = parseServiceRequestListQuery(req);
      const { data, total } = await serviceRequestsService.getPaginated(
        req.tenantId!,
        req.user!.userId,
        req.user!.role,
        {
          status: query.status,
          statuses: query.statuses,
          priority: query.priority,
          assignee: query.assignee,
          overdue: query.overdue,
          search: query.search,
          skip: query.skip,
          take: query.take,
          orderBy: query.orderBy,
        },
      );
      sendPaginatedList(res, "Service requests fetched successfully", data, total, query.page, query.limit);
    } catch (err) { next(err); }
  }

  async getStatusCounts(req: Request, res: Response, next: NextFunction) {
    try {
      const statusesRaw = String(req.query.statuses ?? "new,inspection,estimate,approval,inProgress,completed");
      const statuses = statusesRaw.split(",").map((s) => s.trim()).filter(Boolean);
      const counts = await serviceRequestsService.getStatusCounts(
        req.tenantId!,
        req.user!.userId,
        req.user!.role,
        statuses,
        {
          overdue: req.query.overdue === "true",
          priority: req.query.priority as string | undefined,
          assignee: req.query.assignee as string | undefined,
          search: req.query.search as string | undefined,
        },
      );
      res.json(success("Status counts fetched successfully", counts));
    } catch (err) { next(err); }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await serviceRequestsService.getById(
        req.params.id,
        req.tenantId!,
        req.user!.userId,
        req.user!.role,
      );
      res.json(success("Service request fetched successfully", data));
    } catch (err) { next(err); }
  }

  async getTimeline(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await serviceRequestsService.getTimeline(
        req.params.id,
        req.tenantId!,
        req.user!.userId,
        req.user!.role,
      );
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
      const data = await serviceRequestsService.update(
        req.params.id,
        req.tenantId!,
        req.user!.userId,
        req.user!.role,
        req.body,
      );
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
      const data = await serviceRequestsService.advanceWorkflow(
        req.params.id,
        req.tenantId!,
        req.user!.userId,
        req.user!.role,
        status,
        note,
      );
      res.json(success("Workflow advanced successfully", data));
    } catch (err) { next(err); }
  }

  async reopen(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, note } = req.body as { status: string; note: string };
      const data = await serviceRequestsService.reopen(
        req.params.id,
        req.tenantId!,
        req.user!.userId,
        req.user!.role,
        status,
        note,
      );
      res.json(success("Ticket reopened successfully", data));
    } catch (err) { next(err); }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await serviceRequestsService.delete(req.params.id, req.tenantId!);
      res.status(204).send();
    } catch (err) { next(err); }
  }

  async approveEstimate(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await serviceTicketWorkflowService.approveEstimate(
        req.params.id,
        req.tenantId!,
        req.user!.userId,
        req.user!.role,
        req.body,
      );
      res.json(success("Estimate approved", data));
    } catch (err) { next(err); }
  }

  async rejectEstimate(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await serviceTicketWorkflowService.rejectEstimate(
        req.params.id,
        req.tenantId!,
        req.user!.userId,
        req.user!.role,
        req.body,
      );
      res.json(success("Estimate rejected", data));
    } catch (err) { next(err); }
  }

  async submitChangeRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await serviceTicketWorkflowService.submitChangeRequest(
        req.params.id,
        req.tenantId!,
        req.user!.userId,
        req.user!.role,
        req.body,
      );
      res.status(201).json(success("Change request submitted", data));
    } catch (err) { next(err); }
  }

  async decideChangeRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await serviceTicketWorkflowService.decideChangeRequest(
        req.params.id,
        req.params.changeRequestId,
        req.tenantId!,
        req.user!.userId,
        req.user!.role,
        req.body,
      );
      res.json(success("Change request decision recorded", data));
    } catch (err) { next(err); }
  }

  async finalApproval(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await serviceTicketWorkflowService.finalApproval(
        req.params.id,
        req.tenantId!,
        req.user!.userId,
        req.user!.role,
        req.body,
      );
      res.json(success("Final approval granted and invoice generated", data));
    } catch (err) { next(err); }
  }

  async rejectFinalApproval(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await serviceTicketWorkflowService.rejectFinalApproval(
        req.params.id,
        req.tenantId!,
        req.user!.userId,
        req.user!.role,
        req.body,
      );
      res.json(success("Final approval rejected", data));
    } catch (err) { next(err); }
  }

  async closeTicket(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await serviceTicketWorkflowService.closeTicket(
        req.params.id,
        req.tenantId!,
        req.user!.userId,
        req.user!.role,
        req.body?.note,
      );
      res.json(success("Ticket closed", data));
    } catch (err) { next(err); }
  }
}

export const serviceRequestsController = new ServiceRequestsController();