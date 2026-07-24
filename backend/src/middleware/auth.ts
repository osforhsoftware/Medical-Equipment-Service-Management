import { type Request, type Response, type NextFunction } from "express";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "@/config/env";
import type { JwtPayload } from "@/types";
import { failure } from "@/utils/response";
import { AUTH_COOKIE_NAME } from "@/utils/authCookie";
import { prisma } from "@/db/prisma";

export const STAFF_ROLES = [
  "admin",
  "coordinator",
  "inspector",
  "estimator",
  "engineer",
  "inventory",
  "billing",
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

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

/** Role guard — every protected API action must declare its allowed roles. */
export const requireRole = (...roles: readonly string[]) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(403).json(failure("Insufficient permissions"));
      return;
    }
    if (roles.includes(req.user.role)) {
      next();
      return;
    }
    const assignment = await prisma.userRoleAssignment.findFirst({
      where: {
        tenantId: req.user.tenantId,
        userId: req.user.userId,
        role: { key: { in: [...roles] } },
      },
    });
    if (!assignment) {
      res.status(403).json(failure("Insufficient permissions"));
      return;
    }
    next();
  };

/** Prevent customer sessions from reaching staff-only API modules. */
export const requireStaff = requireRole(...STAFF_ROLES);
