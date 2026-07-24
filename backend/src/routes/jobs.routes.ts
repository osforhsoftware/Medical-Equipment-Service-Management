import { Router } from "express";
import { jobsController } from "@/controllers/jobs.controller";
import { authenticate, requireRole } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenant";
import { validate } from "@/middleware/validate";
import { createJobSchema, updateJobSchema } from "@/schemas/jobs.schema";
import {
  uploadJobPhotosSchema,
  requestJobPartsSchema,
  captureJobSignatureSchema,
  deductJobStockSchema,
} from "@/schemas/jobActions.schema";

const router = Router();
router.use(authenticate, resolveTenant);

const canRead = requireRole("admin", "coordinator", "engineer");
const canExecute = requireRole("admin", "coordinator", "engineer");

router.get("/", canRead, jobsController.getAll);
router.get("/:id/activities", canRead, jobsController.getActivities);
router.get("/:id", canRead, jobsController.getById);
router.post("/", requireRole("admin", "coordinator"), validate(createJobSchema), jobsController.create);
router.post("/:id/photos", canExecute, validate(uploadJobPhotosSchema), jobsController.uploadPhotos);
router.post("/:id/parts-requests", canExecute, validate(requestJobPartsSchema), jobsController.requestParts);
router.post("/:id/signature", canExecute, validate(captureJobSignatureSchema), jobsController.captureSignature);
router.post("/:id/deduct-stock", canExecute, validate(deductJobStockSchema), jobsController.deductStock);
router.put("/:id", canExecute, validate(updateJobSchema), jobsController.update);
router.delete("/:id", requireRole("admin"), jobsController.delete);

export default router;
