import { type Request, type Response, type NextFunction } from "express";
import { failure } from "@/utils/response";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function clientKey(req: Request, prefix: string): string {
  const forwarded = req.headers["x-forwarded-for"];
  const ip =
    (typeof forwarded === "string" ? forwarded.split(",")[0]?.trim() : undefined) ||
    req.ip ||
    req.socket.remoteAddress ||
    "unknown";
  return `${prefix}:${ip}`;
}

/**
 * Simple in-memory rate limiter (single-process). Suitable for login / password-reset.
 * For multi-instance production, replace with Redis-backed limiting.
 */
export function rateLimit(options: {
  windowMs: number;
  max: number;
  prefix: string;
  message?: string;
}) {
  const { windowMs, max, prefix, message = "Too many requests. Please try again later." } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = clientKey(req, prefix);
    const now = Date.now();
    const existing = buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    existing.count += 1;
    if (existing.count > max) {
      const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSec));
      res.status(429).json(failure(message));
      return;
    }

    next();
  };
}

/** Test helper — clears buckets between tests. */
export function resetRateLimitBuckets(): void {
  buckets.clear();
}
