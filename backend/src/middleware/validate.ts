import { type Request, type Response, type NextFunction } from "express";
import { type ZodSchema } from "zod";
import { failure } from "@/utils/response";

/**
 * Zod validation middleware factory.
 * Usage: router.post("/", validate(MyZodSchema), controller)
 */
export const validate =
  (schema: ZodSchema) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`);
      res.status(422).json({ ...failure("Validation failed"), errors });
      return;
    }
    req.body = result.data;
    next();
  };

/**
 * Query validation middleware factory.
 * Usage: router.get("/", validateQuery(MyZodSchema), controller)
 */
export const validateQuery =
  (schema: ZodSchema) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const errors = result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`);
      res.status(422).json({ ...failure("Query validation failed"), errors });
      return;
    }
    req.query = result.data;
    next();
  };
