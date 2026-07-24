import { Router } from "express";
import { notificationsController } from "@/controllers/notifications.controller";
import { authenticate, requireRole, requireStaff } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenant";

const router = Router();
router.use(authenticate, resolveTenant);
router.use(requireStaff);

router.get("/", notificationsController.getAll);
router.get("/unread-count", notificationsController.getUnreadCount);
router.post("/", requireRole("admin", "coordinator"), notificationsController.create);
router.put("/read-all", notificationsController.markAllRead);
router.put("/:id/read", notificationsController.markRead);

export default router;
