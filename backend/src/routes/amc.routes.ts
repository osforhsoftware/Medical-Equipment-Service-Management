import { Router } from "express";
import { amcController } from "@/controllers/amc.controller";
import { authenticate } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenant";

const router = Router();
router.use(authenticate, resolveTenant);

router.get("/", amcController.getAll);
router.get("/:id", amcController.getById);
router.post("/", amcController.create);
router.put("/:id", amcController.update);
router.delete("/:id", amcController.delete);

export default router;
