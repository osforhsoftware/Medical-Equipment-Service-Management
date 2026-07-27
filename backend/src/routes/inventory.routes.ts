import { Router } from "express";
import { inventoryController } from "@/controllers/inventory.controller";
import { authenticate, requireRole } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenant";
import { validate } from "@/middleware/validate";
import { createInventorySchema, updateInventorySchema } from "@/schemas/inventory.schema";
import { stockAdjustmentSchema } from "@/schemas/domain.schema";

const router = Router();
router.use(authenticate, resolveTenant);

const canRead = requireRole("admin", "inventory", "engineer", "inspector", "estimator");
const canManage = requireRole("admin", "inventory");
const canAdjust = requireRole("admin");

router.get("/", canRead, inventoryController.getAll);
router.get("/low-stock", canRead, inventoryController.getLowStock);
router.get("/:id", canRead, inventoryController.getById);
router.post("/", canManage, validate(createInventorySchema), inventoryController.create);
router.put("/:id", canManage, validate(updateInventorySchema), inventoryController.update);
router.post(
  "/:id/adjust",
  canAdjust,
  validate(stockAdjustmentSchema),
  inventoryController.adjust,
);
router.delete("/:id", canManage, inventoryController.delete);

export default router;
