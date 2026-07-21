import { Router } from "express";
import { estimatesController } from "@/controllers/estimates.controller";
import { authenticate } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenant";
import { validate } from "@/middleware/validate";
import { createEstimateSchema, updateEstimateSchema } from "@/schemas/estimates.schema";

const router = Router();
router.use(authenticate, resolveTenant);

router.get("/", estimatesController.getAll);
router.get("/:id", estimatesController.getById);
router.post("/", validate(createEstimateSchema), estimatesController.create);
router.put("/:id", validate(updateEstimateSchema), estimatesController.update);
router.delete("/:id", estimatesController.delete);

export default router;
