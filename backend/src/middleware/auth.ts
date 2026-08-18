import { type Request, type Response, type NextFunction } from "express";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "@/config/env";
import type { JwtPayload } from "@/types";
import { failure } from "@/utils/response";
import { AUTH_COOKIE_NAME } from "@/utils/authCookie";
import { prisma } from "@/db/prisma";
import { rolesFor, type ApiWritePermission } from "@/config/apiAccess";

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

/** JWT authentication — reads httpOnly cookie or Bearer header; rejects inactive users. */
export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json(failure("Authentication required"));
    return;
  }
  void (async () => {
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
      const user = await prisma.user.findFirst({
        where: { id: payload.userId, tenantId: payload.tenantId },
        select: { id: true, name: true, isActive: true, role: true, tenantId: true, email: true },
      });
      if (!user) {
        res.status(401).json(failure("Invalid or expired token"));
        return;
      }
      if (!user.isActive) {
        res.status(403).json(failure("This account is inactive"));
        return;
      }
      req.user = {
        userId: user.id,
        tenantId: user.tenantId,
        role: user.role,
        email: user.email,
        name: user.name,
      };
      req.tenantId = user.tenantId;
      next();
    } catch {
      res.status(401).json(failure("Invalid or expired token"));
    }
  })();
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
    try {
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
    } catch {
      res.status(403).json(failure("Insufficient permissions"));
    }
  };

/** Permission helper backed by the canonical API write-access matrix. */
export const requirePermission = (permission: ApiWritePermission) =>
  requireRole(...rolesFor(permission));

/** Prevent customer sessions from reaching staff-only API modules. */
export const requireStaff = requireRole(...STAFF_ROLES);
