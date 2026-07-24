import { Router } from "express";
import multer from "multer";
import { env } from "@/config/env";
import { filesController } from "@/controllers/files.controller";
import { authenticate } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenant";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_BYTES, files: 1 },
});

router.use(authenticate, resolveTenant);
router.post("/", upload.single("file"), filesController.upload);
router.get("/:id", filesController.metadata);
router.get("/:id/download", filesController.download);

export default router;
