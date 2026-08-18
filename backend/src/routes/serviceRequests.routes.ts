import { Router } from "express";

import { serviceRequestsController } from "@/controllers/serviceRequests.controller";

import { authenticate, requirePermission, requireRole } from "@/middleware/auth";

import { resolveTenant } from "@/middleware/tenant";

import { validate } from "@/middleware/validate";

import {

  approveEstimateSchema,

  assignServiceRequestSchema,

  closeTicketSchema,

  createServiceRequestSchema,

  decideChangeRequestSchema,

  finalApprovalSchema,

  rejectEstimateSchema,

  rejectFinalApprovalSchema,

  reopenServiceRequestSchema,

  submitChangeRequestSchema,

  updateServiceRequestSchema,

  workflowServiceRequestSchema,

} from "@/schemas/serviceRequests.schema";



const router = Router();

router.use(authenticate, resolveTenant);



const canRead = requireRole(

  "admin",

  "coordinator",

  "inspector",

  "estimator",

  "engineer",

  "inventory",

  "billing",

);



const adminOps = requireRole("admin", "coordinator");
const canApproveEstimate = requireRole("admin", "coordinator", "inspector", "engineer");



router.get("/status-counts", canRead, serviceRequestsController.getStatusCounts);

router.get("/", canRead, serviceRequestsController.getAll);

router.get("/:id/timeline", canRead, serviceRequestsController.getTimeline);

router.get("/:id", canRead, serviceRequestsController.getById);

router.post("/", requirePermission("tickets.create"), validate(createServiceRequestSchema), serviceRequestsController.create);

router.put("/:id", requirePermission("tickets.update"), validate(updateServiceRequestSchema), serviceRequestsController.update);

router.put("/:id/assign", requirePermission("tickets.assign"), validate(assignServiceRequestSchema), serviceRequestsController.assign);

router.put("/:id/workflow", requirePermission("tickets.workflow"), validate(workflowServiceRequestSchema), serviceRequestsController.workflow);

router.put("/:id/reopen", requirePermission("tickets.reopen"), validate(reopenServiceRequestSchema), serviceRequestsController.reopen);

router.post("/:id/approve-estimate", canApproveEstimate, validate(approveEstimateSchema), serviceRequestsController.approveEstimate);

router.post("/:id/reject-estimate", canApproveEstimate, validate(rejectEstimateSchema), serviceRequestsController.rejectEstimate);

router.post("/:id/change-requests", requireRole("admin", "engineer"), validate(submitChangeRequestSchema), serviceRequestsController.submitChangeRequest);

router.post("/:id/change-requests/:changeRequestId/decide", adminOps, validate(decideChangeRequestSchema), serviceRequestsController.decideChangeRequest);

router.post("/:id/final-approval", adminOps, validate(finalApprovalSchema), serviceRequestsController.finalApproval);

router.post("/:id/reject-final-approval", adminOps, validate(rejectFinalApprovalSchema), serviceRequestsController.rejectFinalApproval);

router.post("/:id/close", adminOps, validate(closeTicketSchema), serviceRequestsController.closeTicket);

router.delete("/:id", requirePermission("tickets.delete"), serviceRequestsController.delete);



export default router;


