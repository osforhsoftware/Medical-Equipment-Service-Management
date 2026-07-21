import { type Request, type Response, type NextFunction } from "express";
import { billingRepository } from "@/repositories/billing.repository";
import { success } from "@/utils/response";

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
      const { amount, tax, ...rest } = req.body;
      const total = (Number(amount) || 0) + (Number(tax) || 0);
      const data = await billingRepository.create(req.tenantId!, { ...rest, amount, tax, total } as never);
      res.status(201).json(success("Invoice created successfully", data));
    } catch (err) { next(err); }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { amount, tax, ...rest } = req.body;
      const data: Record<string, unknown> = { ...rest };
      if (amount != null || tax != null) {
        const existing = await billingRepository.findById(req.params.id, req.tenantId!);
        if (existing) {
          data.amount = amount ?? existing.amount;
          data.tax = tax ?? existing.tax;
          data.total = Number(data.amount) + Number(data.tax);
        }
      }
      const result = await billingRepository.update(req.params.id, req.tenantId!, data as never);
      res.json(success("Invoice updated successfully", result));
    } catch (err) { next(err); }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await billingRepository.delete(req.params.id, req.tenantId!);
      res.status(204).send();
    } catch (err) { next(err); }
  }
}

export const billingController = new BillingController();
