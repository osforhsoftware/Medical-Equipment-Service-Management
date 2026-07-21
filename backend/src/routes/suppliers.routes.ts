import { Router } from "express";
import { suppliersController } from "@/controllers/suppliers.controller";
import { authenticate } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenant";

const router = Router();
router.use(authenticate, resolveTenant);

router.get("/", suppliersController.getAll);
router.get("/:id", suppliersController.getById);
router.post("/", suppliersController.create);
router.put("/:id", suppliersController.update);
router.delete("/:id", suppliersController.delete);

export default router;
