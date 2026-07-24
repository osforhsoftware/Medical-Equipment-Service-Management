import { Router } from "express";
import { stockTransfersController } from "@/controllers/stockTransfers.controller";
import { authenticate, requireRole } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenant";
import { validate } from "@/middleware/validate";
import { createStockTransferSchema, updateStockTransferSchema } from "@/schemas/stockTransfers.schema";

const router = Router();
router.use(authenticate, resolveTenant);

const canManage = requireRole("admin", "inventory");

router.get("/", canManage, stockTransfersController.getAll);
router.get("/:id", canManage, stockTransfersController.getById);
router.post("/", canManage, validate(createStockTransferSchema), stockTransfersController.create);
router.put("/:id", canManage, validate(updateStockTransferSchema), stockTransfersController.update);
router.delete("/:id", canManage, stockTransfersController.delete);

export default router;
