import { Router } from "express";
import { billingController } from "@/controllers/billing.controller";
import { SERVICE_BILLING_ROLES } from "@/config/apiAccess";
import { authenticate, requireRole } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenant";
import { validate } from "@/middleware/validate";
import { createInvoiceSchema, updateInvoiceSchema } from "@/schemas/billing.schema";

const router = Router();
router.use(authenticate, resolveTenant);

/** Coordinators can read invoices for Financial reports; mutations stay billing/admin. */
const canRead = requireRole(...SERVICE_BILLING_ROLES, "coordinator");
const canWrite = requireRole(...SERVICE_BILLING_ROLES);

router.get("/queue", canWrite, billingController.getQueue);
router.get("/jobs/:jobId/context", canWrite, billingController.getJobContext);
router.post("/jobs/:jobId/verify", canWrite, billingController.verifyJob);
router.post("/:id/submit-approval", canWrite, billingController.submitForApproval);
router.post("/:id/approve", canWrite, billingController.approveInvoice);
router.post("/:id/mark-sent", canWrite, billingController.markSent);
router.get("/", canRead, billingController.getAll);
router.get("/summary", canRead, billingController.getSummary);
router.get("/:id", canRead, billingController.getById);
router.post("/", canWrite, validate(createInvoiceSchema), billingController.create);
router.put("/:id", canWrite, validate(updateInvoiceSchema), billingController.update);
router.delete("/:id", canWrite, billingController.delete);

export default router;
