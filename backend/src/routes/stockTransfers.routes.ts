import { Router } from "express";
import { stockTransfersController } from "@/controllers/stockTransfers.controller";
import { authenticate } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenant";
import { validate } from "@/middleware/validate";
import { createStockTransferSchema, updateStockTransferSchema } from "@/schemas/stockTransfers.schema";

const router = Router();
router.use(authenticate, resolveTenant);

router.get("/", stockTransfersController.getAll);
router.get("/:id", stockTransfersController.getById);
router.post("/", validate(createStockTransferSchema), stockTransfersController.create);
router.put("/:id", validate(updateStockTransferSchema), stockTransfersController.update);
router.delete("/:id", stockTransfersController.delete);

export default router;
