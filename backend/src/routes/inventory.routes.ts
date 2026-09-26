import { Router } from "express";
import { inventoryController } from "@/controllers/inventory.controller";
import { authenticate, requireRole } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenant";
import { validate } from "@/middleware/validate";
import {
  approvePartsRequestSchema,
  createInventorySchema,
  issuePartsRequestSchema,
  rejectPartsRequestSchema,
  updateInventorySchema,
} from "@/schemas/inventory.schema";
import { stockAdjustmentSchema } from "@/schemas/domain.schema";

const router = Router();
router.use(authenticate, resolveTenant);

const canRead = requireRole("admin", "coordinator", "inventory", "engineer", "inspector", "estimator", "sales", "billing");
const canManage = requireRole("admin", "inventory");
// Matches the `inventory.adjust` entry in the API write-access matrix.
const canAdjust = requireRole("admin", "inventory");

router.get("/", canRead, inventoryController.getAll);
router.get("/low-stock", canRead, inventoryController.getLowStock);
router.get("/parts-requests", canRead, inventoryController.listPartsRequests);
router.post("/parts-requests/:requestId/approve", canManage, validate(approvePartsRequestSchema), inventoryController.approvePartsRequest);
router.post("/parts-requests/:requestId/reject", canManage, validate(rejectPartsRequestSchema), inventoryController.rejectPartsRequest);
router.post("/parts-requests/:requestId/issue", canAdjust, validate(issuePartsRequestSchema), inventoryController.issuePartsRequest);
router.get("/:id", canRead, inventoryController.getById);
router.post("/", canManage, validate(createInventorySchema), inventoryController.create);
router.put("/:id", canManage, validate(updateInventorySchema), inventoryController.update);
router.post(
  "/:id/adjust",
  canAdjust,
  validate(stockAdjustmentSchema),
  inventoryController.adjust,
);
router.post("/:id/restore", canManage, inventoryController.restore);
router.delete("/:id", canManage, inventoryController.delete);

export default router;
