import { Router } from "express";
import { dashboardController } from "@/controllers/dashboard.controller";
import { authenticate, requireStaff } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenant";

const router = Router();
router.use(authenticate, resolveTenant);
router.use(requireStaff);

router.get("/", dashboardController.getOverview);

export default router;
