import { Router } from "express";
import { auditLogsController } from "@/controllers/auditLogs.controller";
import { authenticate, requireRole } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenant";

const router = Router();
router.use(authenticate, resolveTenant);
router.use(requireRole("admin"));

router.get("/", auditLogsController.getAll);

export default router;
