import { Router } from "express";
import { taxonomyController } from "@/controllers/taxonomy.controller";
import { authenticate, requirePermission, requireStaff } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenant";
import { validate, validateQuery } from "@/middleware/validate";
import {
  createTaxonomySchema,
  listTaxonomyQuerySchema,
  updateTaxonomySchema,
} from "@/schemas/taxonomy.schema";

const router = Router();
router.use(authenticate, resolveTenant);

router.get("/", requireStaff, validateQuery(listTaxonomyQuerySchema), taxonomyController.getAll);
router.post("/", requirePermission("taxonomy.write"), validate(createTaxonomySchema), taxonomyController.create);
router.patch("/:id", requirePermission("taxonomy.write"), validate(updateTaxonomySchema), taxonomyController.update);
router.delete("/:id", requirePermission("taxonomy.write"), taxonomyController.delete);

export default router;
