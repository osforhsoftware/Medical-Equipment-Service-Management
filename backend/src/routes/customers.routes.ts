import { Router } from "express";
import { customersController } from "@/controllers/customers.controller";
import { authenticate } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenant";
import { validate } from "@/middleware/validate";
import { createCustomerSchema, updateCustomerSchema } from "@/schemas/customers.schema";

const router = Router();
router.use(authenticate, resolveTenant);

router.get("/", customersController.getAll);
router.get("/:id", customersController.getById);
router.post("/", validate(createCustomerSchema), customersController.create);
router.put("/:id", validate(updateCustomerSchema), customersController.update);
router.delete("/:id", customersController.delete);

export default router;
