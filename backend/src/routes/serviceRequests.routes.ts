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

router.get("/", serviceRequestsController.getAll);
router.get("/:id/timeline", serviceRequestsController.getTimeline);
router.get("/:id", serviceRequestsController.getById);
router.post("/", validate(createServiceRequestSchema), serviceRequestsController.create);
router.put("/:id", validate(updateServiceRequestSchema), serviceRequestsController.update);
router.put("/:id/assign", requireRole("admin", "coordinator"), validate(assignServiceRequestSchema), serviceRequestsController.assign);
router.put("/:id/workflow", validate(workflowServiceRequestSchema), serviceRequestsController.workflow);
router.delete("/:id", serviceRequestsController.delete);

export default router;
