import { Router } from "express";
import { authController } from "@/controllers/auth.controller";
import { authenticate } from "@/middleware/auth";
import { validate } from "@/middleware/validate";
import { loginSchema } from "@/schemas/auth.schema";

const router = Router();

router.post("/login", validate(loginSchema), authController.login);
router.post("/logout", authController.logout);

router.use(authenticate);
router.get("/me", authController.me);

export default router;
