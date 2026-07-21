import { Router } from "express";
import { auditLogsController } from "@/controllers/auditLogs.controller";
import { authenticate } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenant";

const router = Router();
router.use(authenticate, resolveTenant);

router.get("/", auditLogsController.getAll);
router.post("/", auditLogsController.create);

export default router;
