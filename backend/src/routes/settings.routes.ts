import { Router } from "express";
import { settingsController } from "@/controllers/settings.controller";
import { authenticate, requireRole } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenant";
import { validate } from "@/middleware/validate";
import { updateSettingsSchema } from "@/schemas/settings.schema";

const router = Router();

router.use(authenticate, resolveTenant);

router.get("/", settingsController.get);
router.put("/", requireRole("admin"), validate(updateSettingsSchema), settingsController.update);

router.get("/demo-seed", requireRole("admin"), settingsController.getDemoSeedStatus);
router.post("/demo-seed", requireRole("admin"), settingsController.seedDemo);
router.delete("/demo-seed", requireRole("admin"), settingsController.removeDemo);

export default router;
