import { Router } from "express";
import { branchesController } from "@/controllers/branches.controller";
import { authenticate, requireRole } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenant";

const router = Router();
router.use(authenticate, resolveTenant);

const canRead = requireRole("admin", "coordinator", "inspector", "estimator", "engineer", "inventory", "billing");

router.get("/", canRead, branchesController.getAll);
router.get("/:id", canRead, branchesController.getById);
router.post("/", requireRole("admin"), branchesController.create);
router.put("/:id", requireRole("admin"), branchesController.update);
router.delete("/:id", requireRole("admin"), branchesController.delete);

export default router;
