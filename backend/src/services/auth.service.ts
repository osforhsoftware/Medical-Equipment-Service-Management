import bcrypt from "bcryptjs";
import { authRepository } from "@/repositories/auth.repository";
import { toSafeUser } from "@/repositories/users.repository";
import { signToken } from "@/middleware/auth";
import { AppError } from "@/middleware/errorHandler";

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

    return { token, user: toSafeUser(user) };
  }

  async me(userId: string) {
    const user = await authRepository.findById(userId);
    if (!user) throw new AppError("User not found", 404);
    return toSafeUser(user);
  }
}

export const authService = new AuthService();
