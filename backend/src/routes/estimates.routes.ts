import { Router } from "express";
import { estimatesController } from "@/controllers/estimates.controller";
import { authenticate, requireRole } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenant";
import { validate } from "@/middleware/validate";
import { createEstimateSchema, updateEstimateSchema } from "@/schemas/estimates.schema";

const router = Router();
router.use(authenticate, resolveTenant);

const canRead = requireRole("admin", "coordinator", "estimator", "billing", "inspector", "engineer");
const canManage = requireRole("admin", "coordinator", "estimator");

router.get("/", canRead, estimatesController.getAll);
router.get("/:id", canRead, estimatesController.getById);
router.post("/", canManage, validate(createEstimateSchema), estimatesController.create);
router.put("/:id", canManage, validate(updateEstimateSchema), estimatesController.update);
router.delete("/:id", requireRole("admin", "coordinator"), estimatesController.delete);

export default router;
