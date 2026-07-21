import { Router } from "express";
import { purchaseOrdersController } from "@/controllers/purchaseOrders.controller";
import { authenticate } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenant";
import { validate } from "@/middleware/validate";
import { createPurchaseOrderSchema, updatePurchaseOrderSchema } from "@/schemas/purchaseOrders.schema";

const router = Router();
router.use(authenticate, resolveTenant);

router.get("/", purchaseOrdersController.getAll);
router.get("/:id", purchaseOrdersController.getById);
router.post("/", validate(createPurchaseOrderSchema), purchaseOrdersController.create);
router.put("/:id", validate(updatePurchaseOrderSchema), purchaseOrdersController.update);
router.delete("/:id", purchaseOrdersController.delete);

export default router;
