import { Router } from "express";
import { customersController } from "@/controllers/customers.controller";
import { CUSTOMER_READ_ROLES, CUSTOMER_WRITE_ROLES } from "@/config/apiAccess";
import { authenticate, requireRole } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenant";
import { validate } from "@/middleware/validate";
import { createCustomerSchema, updateCustomerSchema } from "@/schemas/customers.schema";

const router = Router();
router.use(authenticate, resolveTenant);

const canRead = requireRole(...CUSTOMER_READ_ROLES);
const canManage = requireRole(...CUSTOMER_WRITE_ROLES);

router.get("/", canRead, customersController.getAll);
router.get("/next-reference", canManage, customersController.previewReference);
router.get("/:id", canRead, customersController.getById);
router.post("/", canManage, validate(createCustomerSchema), customersController.create);
router.put("/:id", canManage, validate(updateCustomerSchema), customersController.update);
router.delete("/:id", requireRole("admin"), customersController.delete);

export default router;
