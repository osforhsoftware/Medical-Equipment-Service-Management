import type { CookieOptions, Request, Response } from "express";
import { env } from "@/config/env";

export const AUTH_COOKIE_NAME = "mesms_token";

export function parseExpiresInMs(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)([smhd])$/i);
  if (!match) return 8 * 60 * 60 * 1000;
  const num = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return num * (multipliers[unit] ?? 3_600_000);
}

export function authTtlMs(): number {
  return parseExpiresInMs(env.JWT_EXPIRES_IN);
}

/**
 * Mark the cookie Secure only when this request is actually HTTPS.
 * Using NODE_ENV=production alone drops the cookie on HTTP (nginx :80),
 * which looks like an instant "session expired" right after login.
 */
function isSecureRequest(req: Request): boolean {
  const forwarded = req.headers["x-forwarded-proto"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]?.trim().toLowerCase() === "https";
  }
  return req.secure === true;
}

function cookieOptions(req: Request): CookieOptions {
  const maxAge = authTtlMs();
  return {
    httpOnly: true,
    secure: isSecureRequest(req),
    sameSite: "lax",
    path: "/",
    maxAge,
  };
}

export function setAuthCookie(req: Request, res: Response, token: string): void {
  res.cookie(AUTH_COOKIE_NAME, token, cookieOptions(req));
}

export function clearAuthCookie(res: Response): void {
  const base = {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
  };
  // Clear both variants so a leftover Secure/non-Secure cookie cannot linger.
  res.clearCookie(AUTH_COOKIE_NAME, { ...base, secure: false });
  res.clearCookie(AUTH_COOKIE_NAME, { ...base, secure: true });
}
