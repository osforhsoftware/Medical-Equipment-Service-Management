import { type Request, type Response, type NextFunction } from "express";
import { failure } from "@/utils/response";

/**
 * Tenant middleware — ensures every request has a tenantId from the JWT.
 * Must be used AFTER authenticate middleware.
 */
export const resolveTenant = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user?.tenantId) {
    res.status(401).json(failure("Tenant context missing"));
    return;
  }
  req.tenantId = req.user.tenantId;
  next();
};
