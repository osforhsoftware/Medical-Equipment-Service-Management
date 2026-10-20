import { Router } from "express";
import { amcController } from "@/controllers/amc.controller";
import { authenticate, requireRole } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenant";
import { validate } from "@/middleware/validate";
import { createAmcSchema, updateAmcSchema } from "@/schemas/amc.schema";

const router = Router();
router.use(authenticate, resolveTenant);

const canRead = requireRole("admin", "coordinator", "billing");
const canManage = requireRole("admin", "coordinator");

router.get("/", canRead, amcController.getAll);
router.get("/:id", canRead, amcController.getById);
router.post("/", canManage, validate(createAmcSchema), amcController.create);
router.put("/:id", canManage, validate(updateAmcSchema), amcController.update);
router.delete("/:id", requireRole("admin"), amcController.delete);

export default router;
