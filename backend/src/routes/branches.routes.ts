import { Router } from "express";
import { branchesController } from "@/controllers/branches.controller";
import { authenticate } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenant";

const router = Router();
router.use(authenticate, resolveTenant);

router.get("/", branchesController.getAll);
router.get("/:id", branchesController.getById);
router.post("/", branchesController.create);
router.put("/:id", branchesController.update);
router.delete("/:id", branchesController.delete);

export default router;
