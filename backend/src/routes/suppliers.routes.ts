import { Router } from "express";
import { suppliersController } from "@/controllers/suppliers.controller";
import { authenticate, requireRole } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenant";

const router = Router();
router.use(authenticate, resolveTenant);

/** Coordinators need read access to pick vendors when creating Supplier RFQs. */
const canRead = requireRole("admin", "inventory", "coordinator");
const canManage = requireRole("admin", "inventory");

router.get("/", canRead, suppliersController.getAll);
router.get("/:id", canRead, suppliersController.getById);
router.post("/", canManage, suppliersController.create);
router.put("/:id", canManage, suppliersController.update);
router.delete("/:id", canManage, suppliersController.delete);

export default router;
