import { Router } from "express";
import { equipmentController } from "@/controllers/equipment.controller";
import { authenticate, requireRole } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenant";
import { validate } from "@/middleware/validate";
import { createEquipmentSchema, updateEquipmentSchema } from "@/schemas/equipment.schema";

const router = Router();
router.use(authenticate, resolveTenant);

const canRead = requireRole("admin", "coordinator", "inspector", "engineer", "inventory");
const canManage = requireRole("admin", "coordinator", "inventory");

router.get("/", canRead, equipmentController.getAll);
router.get("/by-tag/:tag", canRead, equipmentController.getByTag);
router.get("/:id", canRead, equipmentController.getById);
router.post("/", canManage, validate(createEquipmentSchema), equipmentController.create);
router.put("/:id", canManage, validate(updateEquipmentSchema), equipmentController.update);
router.delete("/:id", requireRole("admin"), equipmentController.delete);

export default router;
