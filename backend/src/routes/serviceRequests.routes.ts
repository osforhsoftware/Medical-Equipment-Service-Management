import { Router } from "express";
import { serviceRequestsController } from "@/controllers/serviceRequests.controller";
import { authenticate, requirePermission, requireRole } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenant";
import { validate } from "@/middleware/validate";
import {
  createServiceRequestSchema,
  updateServiceRequestSchema,
  assignServiceRequestSchema,
  workflowServiceRequestSchema,
  reopenServiceRequestSchema,
} from "@/schemas/serviceRequests.schema";

const router = Router();
router.use(authenticate, resolveTenant);

const canRead = requireRole(
  "admin",
  "coordinator",
  "inspector",
  "estimator",
  "engineer",
  "inventory",
  "billing",
);

router.get("/", canRead, serviceRequestsController.getAll);
router.get("/:id/timeline", canRead, serviceRequestsController.getTimeline);
router.get("/:id", canRead, serviceRequestsController.getById);
router.post("/", requirePermission("tickets.create"), validate(createServiceRequestSchema), serviceRequestsController.create);
router.put("/:id", requirePermission("tickets.update"), validate(updateServiceRequestSchema), serviceRequestsController.update);
router.put("/:id/assign", requirePermission("tickets.assign"), validate(assignServiceRequestSchema), serviceRequestsController.assign);
router.put("/:id/workflow", requirePermission("tickets.workflow"), validate(workflowServiceRequestSchema), serviceRequestsController.workflow);
router.put("/:id/reopen", requirePermission("tickets.reopen"), validate(reopenServiceRequestSchema), serviceRequestsController.reopen);
router.delete("/:id", requirePermission("tickets.delete"), serviceRequestsController.delete);

export default router;
