import { type Request, type Response, type NextFunction } from "express";
import { billingRepository } from "@/repositories/billing.repository";
import { success } from "@/utils/response";
import { domainService } from "@/services/domain.service";
import { AppError } from "@/middleware/errorHandler";
import { prisma } from "@/db/prisma";

export class BillingController {
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
          currency: String(req.body.currency ?? "USD"),
        },
      );
      res.status(201).json(success("Invoice created successfully", data));
    } catch (err) { next(err); }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      if (["amount", "tax", "total", "paidTotal", "balanceDue", "lineItems"].some((key) => key in req.body)) {
        throw new AppError("Authoritative invoice financial fields cannot be edited", 409);
      }
      const allowed: Record<string, unknown> = {};
      if (req.body.status) allowed.status = req.body.status;
      if (req.body.dueAt) allowed.dueAt = new Date(req.body.dueAt);
      const result = await billingRepository.update(req.params.id, req.tenantId!, allowed as never);
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
