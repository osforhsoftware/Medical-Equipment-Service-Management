import { Router } from "express";
import { purchaseOrdersController } from "@/controllers/purchaseOrders.controller";
import { authenticate, requireRole } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenant";
import { validate } from "@/middleware/validate";
import { createPurchaseOrderSchema, updatePurchaseOrderSchema } from "@/schemas/purchaseOrders.schema";

const router = Router();
router.use(authenticate, resolveTenant);

const canManage = requireRole("admin", "inventory");

router.get("/", canManage, purchaseOrdersController.getAll);
router.get("/:id", canManage, purchaseOrdersController.getById);
router.post("/", requireRole("admin"), validate(createPurchaseOrderSchema), purchaseOrdersController.create);
router.put("/:id", requireRole("admin"), validate(updatePurchaseOrderSchema), purchaseOrdersController.update);
router.delete("/:id", requireRole("admin"), purchaseOrdersController.delete);

export default router;
