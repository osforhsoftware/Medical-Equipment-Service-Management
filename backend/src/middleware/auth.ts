import { type Request, type Response, type NextFunction } from "express";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "@/config/env";
import type { JwtPayload } from "@/types";
import { failure } from "@/utils/response";
import { AUTH_COOKIE_NAME } from "@/utils/authCookie";

function extractToken(req: Request): string | null {
  const cookieToken = req.cookies?.[AUTH_COOKIE_NAME];
  if (typeof cookieToken === "string" && cookieToken.length > 0) {
    return cookieToken;
  }

  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    return header.slice(7);
  }

  return null;
}

/** JWT authentication — reads httpOnly cookie or Bearer header */
export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json(failure("Authentication required"));
    return;
  }
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = payload;
    req.tenantId = payload.tenantId;
    next();
  } catch {
    res.status(401).json(failure("Invalid or expired token"));
  }
};

/** Sign a JWT for a user */
export const signToken = (payload: JwtPayload): string =>
  jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"] });

/** Role guard — restrict endpoint to specific roles */
export const requireRole = (...roles: string[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json(failure("Insufficient permissions"));
      return;
    }
    next();
  };
