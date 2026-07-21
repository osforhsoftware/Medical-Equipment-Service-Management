import { Router } from "express";
import { inspectionsController } from "@/controllers/inspections.controller";
import { authenticate, requireRole } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenant";

const router = Router();
router.use(authenticate, resolveTenant);

router.get("/:requestId", inspectionsController.get);
router.post("/:requestId", requireRole("admin", "coordinator", "inspector"), inspectionsController.createOrUpdate);

export default router;
