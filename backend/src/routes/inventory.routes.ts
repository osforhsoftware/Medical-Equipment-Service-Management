import { Router } from "express";
import { inventoryController } from "@/controllers/inventory.controller";
import { authenticate } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenant";
import { validate } from "@/middleware/validate";
import { createInventorySchema, updateInventorySchema } from "@/schemas/inventory.schema";

const router = Router();
router.use(authenticate, resolveTenant);

router.get("/", inventoryController.getAll);
router.get("/low-stock", inventoryController.getLowStock);
router.get("/:id", inventoryController.getById);
router.post("/", validate(createInventorySchema), inventoryController.create);
router.put("/:id", validate(updateInventorySchema), inventoryController.update);
router.delete("/:id", inventoryController.delete);

export default router;
