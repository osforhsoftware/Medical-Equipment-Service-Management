import { type Request, type Response, type NextFunction } from "express";
import { billingRepository } from "@/repositories/billing.repository";
import { success } from "@/utils/response";
import { domainService } from "@/services/domain.service";
import { billingService, type BillingQueueKey } from "@/services/billing.service";
import { AppError } from "@/middleware/errorHandler";
import { prisma } from "@/db/prisma";

function actor(req: Request) {
  return { userId: req.user!.userId, role: req.user!.role };
}

export class BillingController {
  async getQueue(req: Request, res: Response, next: NextFunction) {
    try {
      const queue = req.query.queue as BillingQueueKey | undefined;
      const data = await billingService.getQueue(req.tenantId!, queue);
      res.json(success("Billing queue fetched", data));
    } catch (err) { next(err); }
  }

  async getJobContext(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await billingService.getJobContext(req.tenantId!, req.params.jobId);
      res.json(success("Billing job context fetched", data));
    } catch (err) { next(err); }
  }

  async verifyJob(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await billingService.verifyJob(req.tenantId!, req.params.jobId, actor(req));
      res.json(success("Job billing verification recorded", data));
    } catch (err) { next(err); }
  }

  async submitForApproval(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await billingService.submitInvoiceForApproval(req.tenantId!, req.params.id, actor(req));
      res.json(success("Invoice submitted for approval", data));
    } catch (err) { next(err); }
  }

  async approveInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await billingService.approveInvoice(req.tenantId!, req.params.id, actor(req));
      res.json(success("Invoice approved", data));
    } catch (err) { next(err); }
  }

  async markSent(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await billingService.markInvoiceSent(req.tenantId!, req.params.id, actor(req));
      res.json(success("Invoice marked as sent", data));
    } catch (err) { next(err); }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await billingRepository.findAll(req.tenantId!, req.query.status as string);
      res.json(success("Invoices fetched successfully", data));
    } catch (err) { next(err); }
  }

  async getSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const groups = await billingRepository.getSummary(req.tenantId!);
      let total_invoices = 0, total_collected = 0, total_overdue = 0, total_pending = 0;

      groups.forEach(g => {
        total_invoices += g._count;
        const val = Number(g._sum.total ?? 0);
        if (g.status === "paid") total_collected += val;
        else if (g.status === "overdue") total_overdue += val;
        else if (g.status === "sent") total_pending += val;
      });

      res.json({
        total_invoices: String(total_invoices),
        total_collected: String(total_collected),
        total_overdue: String(total_overdue),
        total_pending: String(total_pending),
      });
    } catch (err) { next(err); }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await billingRepository.findById(req.params.id, req.tenantId!);
      res.json(success("Invoice fetched successfully", data));
    } catch (err) { next(err); }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.body.jobId || !req.body.dueAt) {
        throw new AppError("jobId and dueAt are required; invoice totals are derived server-side", 422);
      }
      const data = await domainService.createInvoiceFromJob(
        req.tenantId!,
        { userId: req.user!.userId, role: req.user!.role },
        {
          jobId: req.body.jobId,
          dueAt: new Date(req.body.dueAt),
          currency: String(req.body.currency ?? "INR"),
          additionalLines: req.body.additionalLines,
        },
      );
      res.status(201).json(success("Invoice created successfully", data));
    } catch (err) { next(err); }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      if ("status" in req.body) {
        throw new AppError("Use workflow endpoints to change invoice status", 409);
      }
      if (["amount", "tax", "total", "paidTotal", "balanceDue"].some((key) => key in req.body)) {
        throw new AppError("Invoice totals are calculated server-side from line items", 409);
      }
      const dueAt = req.body.dueAt
        ? new Date(String(req.body.dueAt).includes("T") ? req.body.dueAt : `${req.body.dueAt}T00:00:00.000Z`)
        : undefined;
      const result = await billingService.updateInvoice(req.tenantId!, req.params.id, actor(req), {
        dueAt,
        lineItems: req.body.lineItems,
      });
      res.json(success("Invoice updated successfully", result));
    } catch (err) { next(err); }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const invoice = await prisma.invoice.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId! },
        include: { payments: { take: 1 } },
      });
      if (!invoice) throw new AppError("Invoice not found", 404);
      if (invoice.status !== "draft" || invoice.payments.length) {
        throw new AppError("Only unpaid draft invoices can be deleted", 409);
      }
      await prisma.invoice.delete({ where: { id: invoice.id } });
      res.status(204).send();
    } catch (err) { next(err); }
  }
}

export const billingController = new BillingController();
