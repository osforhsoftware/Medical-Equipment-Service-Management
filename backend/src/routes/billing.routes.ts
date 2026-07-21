import { Router } from "express";
import { billingController } from "@/controllers/billing.controller";
import { authenticate } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenant";

const router = Router();
router.use(authenticate, resolveTenant);

router.get("/", billingController.getAll);
router.get("/summary", billingController.getSummary);
router.get("/:id", billingController.getById);
router.post("/", billingController.create);
router.put("/:id", billingController.update);
router.delete("/:id", billingController.delete);

export default router;
