import { type Request, type Response, type NextFunction } from "express";
import { taxonomyService } from "@/services/taxonomy.service";
import type { TaxonomyTypeName } from "@/config/taxonomyDefaults";
import { success } from "@/utils/response";

function queryFlag(value: unknown): boolean {
  return value === "true" || value === "1" || value === true;
}

export class TaxonomyController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const type = req.query.type as TaxonomyTypeName;
      const data = await taxonomyService.list(req.tenantId!, type, queryFlag(req.query.activeOnly));
      res.json(success("Taxonomy terms fetched successfully", data));
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await taxonomyService.create(req.tenantId!, req.body);
      res.status(201).json(success("Taxonomy term created successfully", data));
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await taxonomyService.update(req.params.id, req.tenantId!, req.body);
      res.json(success("Taxonomy term updated successfully", data));
    } catch (err) {
      next(err);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await taxonomyService.delete(req.params.id, req.tenantId!);
      if (result.deactivated) {
        res.json(success(
          `This term is used by ${result.usageCount} record${result.usageCount === 1 ? "" : "s"} and was deactivated instead of deleted.`,
          result,
        ));
        return;
      }
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
}

export const taxonomyController = new TaxonomyController();
