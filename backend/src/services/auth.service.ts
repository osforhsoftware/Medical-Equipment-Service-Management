import bcrypt from "bcryptjs";
import crypto from "crypto";
import { authRepository } from "@/repositories/auth.repository";
import { signToken } from "@/middleware/auth";
import { AppError } from "@/middleware/errorHandler";
import { prisma } from "@/db/prisma";
import { env } from "@/config/env";
import { enrichUserWithRoles } from "@/utils/userRoles";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export class AuthService {
  async login(username: string, password: string) {
    const user = await authRepository.findByLogin(username);
    if (!user) throw new AppError("Invalid username or password", 401);
    if (!user.isActive) throw new AppError("This account is inactive", 403);

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new AppError("Invalid username or password", 401);

    const token = signToken({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
    });

    return { token, user: await enrichUserWithRoles(user, user.tenantId) };
  }

  async me(userId: string) {
    const user = await authRepository.findById(userId);
    if (!user) throw new AppError("User not found", 404);
    if (!user.isActive) throw new AppError("This account is inactive", 403);
    return enrichUserWithRoles(user, user.tenantId);
  }

  /**
   * Always returns a generic success message to avoid account enumeration.
   * When SMTP is not configured, the raw token is returned only in non-production
   * so local/dev flows can complete without email.
   */
  async requestPasswordReset(email: string): Promise<{ message: string; resetToken?: string }> {
    const normalized = email.toLowerCase().trim();
    const user = await prisma.user.findFirst({
      where: { email: normalized, isActive: true },
    });

    const generic = {
      message: "If an account exists for that email, a reset link has been sent.",
    };

    if (!user) return generic;

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    // Email delivery is Phase-later; log in development for manual testing.
    if (env.NODE_ENV !== "production") {
      console.info(`[password-reset] token for ${user.email}: ${rawToken}`);
      return { ...generic, resetToken: rawToken };
    }

    return generic;
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = hashToken(token);
    const record = await prisma.passwordResetToken.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
      include: { user: true },
    });
    if (!record || !record.user.isActive) {
      throw new AppError("Invalid or expired reset token", 400);
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      prisma.passwordResetToken.updateMany({
        where: { userId: record.userId, usedAt: null, id: { not: record.id } },
        data: { usedAt: new Date() },
      }),
    ]);
  }
}

export const authService = new AuthService();
