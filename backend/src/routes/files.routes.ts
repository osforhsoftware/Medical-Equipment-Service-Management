import { Router } from "express";
import multer from "multer";
import { env } from "@/config/env";
import { filesController } from "@/controllers/files.controller";
import { authenticate, requirePermission } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenant";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_BYTES, files: 1 },
});

router.use(authenticate, resolveTenant);
// Uploads are staff-only. Download/metadata use fileStorage access checks so
// a customer can open only their own non-internal documents.
router.post("/", requirePermission("files.upload"), upload.single("file"), filesController.upload);
router.get("/:id", filesController.metadata);
router.get("/:id/download", filesController.download);

export default router;
