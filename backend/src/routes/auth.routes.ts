import { Router } from "express";
import { authController } from "@/controllers/auth.controller";
import { authenticate } from "@/middleware/auth";
import { rateLimit } from "@/middleware/rateLimit";
import { validate } from "@/middleware/validate";
import { forgotPasswordSchema, loginSchema, resetPasswordSchema } from "@/schemas/auth.schema";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  prefix: "login",
  message: "Too many login attempts. Please try again in a few minutes.",
});

const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  prefix: "password-reset",
  message: "Too many password reset attempts. Please try again later.",
});

router.post("/login", loginLimiter, validate(loginSchema), authController.login);
router.post("/logout", authController.logout);
router.post("/forgot-password", resetLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post("/reset-password", resetLimiter, validate(resetPasswordSchema), authController.resetPassword);

router.use(authenticate);
router.get("/me", authController.me);
router.post("/refresh", authController.refresh);

export default router;
