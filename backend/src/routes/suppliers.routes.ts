import { Router } from "express";
import { suppliersController } from "@/controllers/suppliers.controller";
import { authenticate, requireRole } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenant";

const router = Router();
router.use(authenticate, resolveTenant);

const canManage = requireRole("admin", "inventory");

router.get("/", canManage, suppliersController.getAll);
router.get("/:id", canManage, suppliersController.getById);
router.post("/", canManage, suppliersController.create);
router.put("/:id", canManage, suppliersController.update);
router.delete("/:id", canManage, suppliersController.delete);

export default router;
