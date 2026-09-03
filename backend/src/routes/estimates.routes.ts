import { Router } from "express";
import { estimatesController } from "@/controllers/estimates.controller";
import { ESTIMATE_READ_ROLES, ESTIMATE_WRITE_ROLES } from "@/config/apiAccess";
import { authenticate, requireRole } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenant";
import { validate } from "@/middleware/validate";
import { createEstimateSchema, updateEstimateSchema } from "@/schemas/estimates.schema";

const router = Router();
router.use(authenticate, resolveTenant);

const canRead = requireRole(...ESTIMATE_READ_ROLES);
const canManage = requireRole(...ESTIMATE_WRITE_ROLES);

router.get("/", canRead, estimatesController.getAll);
router.get("/:id", canRead, estimatesController.getById);
router.post("/", canManage, validate(createEstimateSchema), estimatesController.create);
router.put("/:id", canManage, validate(updateEstimateSchema), estimatesController.update);
router.delete("/:id", requireRole("admin", "coordinator"), estimatesController.delete);

export default router;
