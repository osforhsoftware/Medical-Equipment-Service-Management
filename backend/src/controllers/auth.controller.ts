import { type Request, type Response, type NextFunction } from "express";
import { authService } from "@/services/auth.service";
import { success } from "@/utils/response";
import { clearAuthCookie, setAuthCookie } from "@/utils/authCookie";

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { username, password } = req.body;
      const result = await authService.login(username, password);
      setAuthCookie(res, result.token);
      res.json(success("Login successful", { user: result.user }));
    } catch (err) {
      next(err);
    }
  }

  async logout(_req: Request, res: Response) {
    clearAuthCookie(res);
    res.json(success("Logged out successfully", null));
  }

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await authService.me(req.user!.userId);
      res.json(success("User fetched successfully", user));
    } catch (err) {
      next(err);
    }
  }

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.requestPasswordReset(req.body.email);
      res.json(success(result.message, envSafePayload(result)));
    } catch (err) {
      next(err);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, password } = req.body as { token: string; password: string };
      await authService.resetPassword(token, password);
      res.json(success("Password has been reset. You can now sign in.", null));
    } catch (err) {
      next(err);
    }
  }
}

function envSafePayload(result: { message: string; resetToken?: string }) {
  if (result.resetToken) return { resetToken: result.resetToken };
  return null;
}

export const authController = new AuthController();
