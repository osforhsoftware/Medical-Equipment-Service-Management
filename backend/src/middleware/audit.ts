import type { NextFunction, Request, Response } from "express";
import { prisma } from "@/db/prisma";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Records successful authenticated mutations after the response is committed. */
export function auditMutation(req: Request, res: Response, next: NextFunction) {
  if (!MUTATING_METHODS.has(req.method)) {
    next();
    return;
  }
  res.once("finish", () => {
    if (!req.user || !req.tenantId || res.statusCode >= 400 || req.originalUrl.startsWith("/api/auth/")) return;
    const path = req.originalUrl.split("?")[0];
    void prisma.auditLog.create({
      data: {
        tenantId: req.tenantId,
        actor: req.user.userId,
        role: req.user.role,
        action: `${req.method} ${path}`,
        entity: path.split("/").filter(Boolean).slice(1, 3).join(":") || "unknown",
        ip: req.ip || req.socket.remoteAddress || "unknown",
      },
    }).catch((error) => {
      console.error("Failed to write audit log", error);
    });
  });
  next();
}
