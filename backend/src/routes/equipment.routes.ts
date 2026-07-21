import { Router } from "express";
import { equipmentController } from "@/controllers/equipment.controller";
import { authenticate } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenant";
import { validate } from "@/middleware/validate";
import { createEquipmentSchema, updateEquipmentSchema } from "@/schemas/equipment.schema";

const router = Router();
router.use(authenticate, resolveTenant);

router.get("/", equipmentController.getAll);
router.get("/by-tag/:tag", equipmentController.getByTag);
router.get("/:id", equipmentController.getById);
router.post("/", validate(createEquipmentSchema), equipmentController.create);
router.put("/:id", validate(updateEquipmentSchema), equipmentController.update);
router.delete("/:id", equipmentController.delete);

export default router;
