import { Router } from "express";
import { jobsController } from "@/controllers/jobs.controller";
import { authenticate } from "@/middleware/auth";
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

router.get("/", jobsController.getAll);
router.get("/:id/activities", jobsController.getActivities);
router.get("/:id", jobsController.getById);
router.post("/", validate(createJobSchema), jobsController.create);
router.post("/:id/photos", validate(uploadJobPhotosSchema), jobsController.uploadPhotos);
router.post("/:id/parts-requests", validate(requestJobPartsSchema), jobsController.requestParts);
router.post("/:id/signature", validate(captureJobSignatureSchema), jobsController.captureSignature);
router.post("/:id/deduct-stock", validate(deductJobStockSchema), jobsController.deductStock);
router.put("/:id", validate(updateJobSchema), jobsController.update);
router.delete("/:id", jobsController.delete);

export default router;
