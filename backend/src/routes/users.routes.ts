import { Router } from "express";
import { usersController } from "@/controllers/users.controller";
import { authenticate, requireRole } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenant";
import { validate } from "@/middleware/validate";
import { createUserSchema, updateUserSchema } from "@/schemas/users.schema";

const router = Router();

router.use(authenticate, resolveTenant);

// Read endpoints — accessible to all authenticated staff (for assignment dropdowns)
router.get("/", usersController.list);
router.get("/:id", usersController.getById);

// Write endpoints — admin only
router.post("/", requireRole("admin"), validate(createUserSchema), usersController.create);
router.put("/:id", requireRole("admin"), validate(updateUserSchema), usersController.update);
router.delete("/:id", requireRole("admin"), usersController.delete);

export default router;
