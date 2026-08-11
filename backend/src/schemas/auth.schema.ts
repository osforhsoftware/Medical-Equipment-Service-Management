import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required").max(64),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("A valid email is required").max(254),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(32, "Reset token is required").max(128),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});
