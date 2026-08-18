import { Router } from "express";
import { inspectionsController } from "@/controllers/inspections.controller";
import { authenticate, requireRole } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenant";
import { validate } from "@/middleware/validate";
import { inspectionReportSchema } from "@/schemas/serviceRequests.schema";

const router = Router();
router.use(authenticate, resolveTenant);

router.get("/:requestId", requireRole("admin", "coordinator", "inspector"), inspectionsController.get);
router.post(
  "/:requestId",
  requireRole("admin", "coordinator", "inspector"),
  validate(inspectionReportSchema),
  inspectionsController.createOrUpdate,
);

export default router;
