import { Router } from "express";
import { jobsController } from "@/controllers/jobs.controller";
import { authenticate, requireRole } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenant";
import { validate } from "@/middleware/validate";
import { createJobSchema, updateJobSchema } from "@/schemas/jobs.schema";
import {
  uploadJobPhotosSchema,
  saveJobWorkReportSchema,
  requestJobPartsSchema,
  captureJobSignatureSchema,
  deductJobStockSchema,
  returnJobStockSchema,
} from "@/schemas/jobActions.schema";

const router = Router();
router.use(authenticate, resolveTenant);

const canRead = requireRole("admin", "coordinator", "engineer", "qa");
const canExecute = requireRole("admin", "engineer");
const canUpdate = requireRole("admin", "coordinator", "engineer", "qa");
/** Timeline notes / escalation — ops leads + engineers (not field-only execute actions). */
const canLogActivity = requireRole("admin", "coordinator", "engineer");

router.get("/", canRead, jobsController.getAll);
router.get("/:id/activities", canRead, jobsController.getActivities);
router.post("/:id/activities", canLogActivity, jobsController.addActivity);
router.get("/:id", canRead, jobsController.getById);
router.post("/", requireRole("admin", "coordinator"), validate(createJobSchema), jobsController.create);
router.post("/:id/rework", requireRole("admin", "coordinator"), jobsController.createRework);
router.post("/:id/photos", canExecute, validate(uploadJobPhotosSchema), jobsController.uploadPhotos);
router.put("/:id/work-report", canExecute, validate(saveJobWorkReportSchema), jobsController.saveWorkReport);
router.post("/:id/parts-requests", canExecute, validate(requestJobPartsSchema), jobsController.requestParts);
router.post("/:id/signature", canExecute, validate(captureJobSignatureSchema), jobsController.captureSignature);
router.post("/:id/deduct-stock", canExecute, validate(deductJobStockSchema), jobsController.deductStock);
router.post("/:id/return-stock", canExecute, validate(returnJobStockSchema), jobsController.returnStock);
router.put("/:id", canUpdate, validate(updateJobSchema), jobsController.update);
router.delete("/:id", requireRole("admin", "coordinator"), jobsController.delete);

export default router;
