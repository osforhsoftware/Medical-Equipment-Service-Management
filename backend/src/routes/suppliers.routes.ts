import { Router } from "express";
import { suppliersController } from "@/controllers/suppliers.controller";
import { authenticate, requireRole } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenant";
import { validate } from "@/middleware/validate";
import { createSupplierSchema, updateSupplierSchema } from "@/schemas/suppliers.schema";

const router = Router();
router.use(authenticate, resolveTenant);

/** Coordinators need read access to pick vendors when creating Supplier RFQs. */
const canRead = requireRole("admin", "inventory", "coordinator");
const canManage = requireRole("admin", "inventory");

router.get("/", canRead, suppliersController.getAll);
router.get("/:id", canRead, suppliersController.getById);
router.post("/", canManage, validate(createSupplierSchema), suppliersController.create);
router.put("/:id", canManage, validate(updateSupplierSchema), suppliersController.update);
router.delete("/:id", canManage, suppliersController.delete);

export default router;
