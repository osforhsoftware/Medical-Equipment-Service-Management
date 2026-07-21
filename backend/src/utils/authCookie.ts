import type { CookieOptions, Response } from "express";
import { env } from "@/config/env";

export const AUTH_COOKIE_NAME = "mesms_token";

function parseExpiresInMs(expiresIn: string): number {
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

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "strict" : "lax",
    path: "/",
    maxAge: parseExpiresInMs(env.JWT_EXPIRES_IN),
  };
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE_NAME, token, cookieOptions());
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "strict" : "lax",
    path: "/",
  });
}
