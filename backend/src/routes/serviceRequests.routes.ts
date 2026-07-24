import { Router } from "express";
import { serviceRequestsController } from "@/controllers/serviceRequests.controller";
import { authenticate, requireRole } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenant";
import { validate } from "@/middleware/validate";
import {
  createServiceRequestSchema,
  updateServiceRequestSchema,
  assignServiceRequestSchema,
  workflowServiceRequestSchema,
} from "@/schemas/serviceRequests.schema";

const router = Router();
router.use(authenticate, resolveTenant);

const canRead = requireRole("admin", "coordinator", "inspector", "estimator", "engineer", "inventory", "billing");

router.get("/", canRead, serviceRequestsController.getAll);
router.get("/:id/timeline", canRead, serviceRequestsController.getTimeline);
router.get("/:id", canRead, serviceRequestsController.getById);
router.post("/", requireRole("admin", "coordinator"), validate(createServiceRequestSchema), serviceRequestsController.create);
router.put("/:id", canRead, validate(updateServiceRequestSchema), serviceRequestsController.update);
router.put("/:id/assign", requireRole("admin", "coordinator"), validate(assignServiceRequestSchema), serviceRequestsController.assign);
router.put("/:id/workflow", canRead, validate(workflowServiceRequestSchema), serviceRequestsController.workflow);
router.delete("/:id", requireRole("admin"), serviceRequestsController.delete);

export default router;
