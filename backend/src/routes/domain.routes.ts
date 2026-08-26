import { Router, type NextFunction, type Request, type Response } from "express";
import { domainController as c } from "@/controllers/domain.controller";
import { authenticate, requireRole, requireStaff } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenant";
import { validate } from "@/middleware/validate";
import {
  attachmentLinkSchema,
  catalogItemSchema,
  commissionActionSchema,
  commissionSchema,
  convertStockPurchaseRequestSchema,
  createPurchaseOrderSchema,
  createPurchaseReturnSchema,
  createStockTransferSchema,
  estimateDecisionSchema,
  estimateRevisionSchema,
  expenseSchema,
  inspectionRecommendationSchema,
  invoiceFromJobSchema,
  jobAssignmentSchema,
  jobExtraSchema,
  officeAssetMaintenanceSchema,
  officeAssetSchema,
  officeAssetUpdateSchema,
  paymentSchema,
  qrScanSchema,
  receivePurchaseOrderSchema,
  referralSchema,
  reservationActionSchema,
  roleAssignmentSchema,
  roleSchema,
  stockPurchaseRequestSchema,
  workLogSchema,
} from "@/schemas/domain.schema";

const router = Router();
router.use(authenticate, resolveTenant);

const operations = requireRole("admin", "coordinator");
const inventory = requireRole("admin", "inventory");
const finance = requireRole("admin", "billing");
const documentRole = (req: Request, res: Response, next: NextFunction) => {
  const permissions: Record<string, string[]> = {
    estimate: ["admin", "coordinator", "estimator", "billing"],
    invoice: ["admin", "billing"],
    "service-report": ["admin", "coordinator", "engineer"],
  };
  return requireRole(...(permissions[req.params.kind] ?? []))(req, res, next);
};

router.get("/service-catalog", requireStaff, c.catalogList);
router.post("/service-catalog", operations, validate(catalogItemSchema), c.catalogCreate);
router.put("/service-catalog/:id", operations, validate(catalogItemSchema), c.catalogUpdate);
router.delete("/service-catalog/:id", operations, c.catalogDelete);

router.post("/inspection-reports/:id/recommendations", requireRole("admin", "coordinator", "inspector"), validate(inspectionRecommendationSchema), c.inspectionRecommendation);
router.post("/inspection-reports/:id/attachments", requireRole("admin", "coordinator", "inspector"), validate(attachmentLinkSchema), c.inspectionAttachment);

router.post("/estimates/:id/revisions", requireRole("admin", "coordinator", "estimator"), validate(estimateRevisionSchema), c.estimateRevision);
router.post("/estimates/:id/decisions", requireRole("admin", "coordinator", "customer"), validate(estimateDecisionSchema), c.estimateDecision);

router.post("/jobs/:id/assignments", operations, validate(jobAssignmentSchema), c.jobAssignment);
router.post("/jobs/:id/work-logs", requireRole("admin", "coordinator", "engineer"), validate(workLogSchema), c.workLog);
router.post("/jobs/:id/extras", requireRole("admin", "coordinator", "engineer"), validate(jobExtraSchema), c.jobExtra);
router.post("/job-extras/:id/approve", requireRole("admin", "coordinator"), c.approveJobExtra);

router.get("/stock/reservations", inventory, c.reservations);
router.post("/stock/reservations/:id/action", inventory, validate(reservationActionSchema), c.reservationAction);
router.get("/stock/movements", inventory, c.movements);
router.get("/branches", inventory, c.branches);
router.get("/stock-purchase-requests", requireRole("admin", "coordinator", "inventory", "inspector", "engineer"), c.stockPurchaseRequests);
router.post("/stock-purchase-requests", requireRole("admin", "coordinator", "inventory", "inspector", "engineer"), validate(stockPurchaseRequestSchema), c.stockPurchaseRequestCreate);
router.post("/stock-purchase-requests/:id/convert", inventory, validate(convertStockPurchaseRequestSchema), c.stockPurchaseRequestConvert);
router.get("/stock-transfers", inventory, c.stockTransfers);
router.post("/stock-transfers", inventory, validate(createStockTransferSchema), c.stockTransferCreate);
router.get("/stock-transfers/:id", inventory, c.stockTransferById);
router.post("/stock-transfers/:id/dispatch", inventory, c.stockTransferDispatch);
router.post("/stock-transfers/:id/receive", inventory, c.stockTransferReceive);
router.post("/purchase-orders", inventory, validate(createPurchaseOrderSchema), c.purchaseOrder);
router.post("/purchase-orders/:id/receipts", inventory, validate(receivePurchaseOrderSchema), c.receivePurchaseOrder);
router.get("/purchase-returns", inventory, c.purchaseReturns);
router.post("/purchase-returns", inventory, validate(createPurchaseReturnSchema), c.purchaseReturnCreate);
router.get("/purchase-returns/:id", inventory, c.purchaseReturnById);

router.post("/invoices/from-job", finance, validate(invoiceFromJobSchema), c.invoiceFromJob);
router.post("/invoices/:id/payments", finance, validate(paymentSchema), c.payment);
router.post("/documents/:kind/:id", documentRole, c.documentGenerate);
router.post("/service-tickets/:id/finish", requireRole("admin", "coordinator", "billing"), c.finishTicket);

router.get("/equipment-history/:assetTag", requireStaff, c.equipmentHistory);
router.get("/projects/:requestId", requireStaff, c.projectDetails);
router.post("/qr-scans", requireStaff, validate(qrScanSchema), c.qrScan);
router.get("/portal", requireRole("customer"), c.customerPortal);

router.get("/office-assets", requireRole("admin"), c.officeAssets);
router.post("/office-assets", requireRole("admin"), validate(officeAssetSchema), c.officeAssetCreate);
router.put("/office-assets/:id", requireRole("admin"), validate(officeAssetUpdateSchema), c.officeAssetUpdate);
router.post("/office-assets/:id/maintenance", requireRole("admin"), validate(officeAssetMaintenanceSchema), c.officeAssetMaintenance);

router.get("/finance/expenses", finance, c.expenses);
router.post("/finance/expenses", finance, validate(expenseSchema), c.expenseCreate);
router.get("/finance/referrals", finance, c.referrals);
router.post("/finance/referrals", finance, validate(referralSchema), c.referralCreate);
router.get("/finance/commissions", finance, c.commissions);
router.post("/finance/commissions", finance, validate(commissionSchema), c.commissionCreate);
router.put("/finance/commissions/:id", finance, validate(commissionActionSchema), c.commissionUpdate);

router.get("/roles", requireRole("admin"), c.roles);
router.post("/roles", requireRole("admin"), validate(roleSchema), c.roleCreate);
router.post("/role-assignments", requireRole("admin"), validate(roleAssignmentSchema), c.roleAssignment);
router.delete("/role-assignments/:id", requireRole("admin"), c.roleUnassignment);

export default router;
