import { type NextFunction, type Request, type Response } from "express";
import { domainService } from "@/services/domain.service";
import { documentsService } from "@/services/documents.service";
import { success } from "@/utils/response";

const actor = (req: Request) => ({ userId: req.user!.userId, role: req.user!.role });
const send = (res: Response, message: string, data: unknown, status = 200) =>
  res.status(status).json(success(message, data));

export class DomainController {
  catalogList = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Service catalog fetched", await domainService.listCatalog(req.tenantId!)); } catch (e) { next(e); }
  };
  catalogCreate = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Service catalog item created", await domainService.createCatalog(req.tenantId!, req.body), 201); } catch (e) { next(e); }
  };
  catalogUpdate = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Service catalog item updated", await domainService.updateCatalog(req.tenantId!, req.params.id, req.body)); } catch (e) { next(e); }
  };
  catalogDelete = async (req: Request, res: Response, next: NextFunction) => {
    try { await domainService.deleteCatalog(req.tenantId!, req.params.id); res.status(204).send(); } catch (e) { next(e); }
  };
  inspectionRecommendation = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Inspection recommendation added", await domainService.addInspectionRecommendation(req.tenantId!, req.params.id, actor(req), req.body), 201); } catch (e) { next(e); }
  };
  inspectionAttachment = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Inspection attachment linked", await domainService.attachInspectionFile(req.tenantId!, req.params.id, actor(req), req.body), 201); } catch (e) { next(e); }
  };
  estimateRevision = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Estimate revision created", await domainService.createEstimateRevision(req.tenantId!, req.params.id, actor(req), req.body), 201); } catch (e) { next(e); }
  };
  estimateDecision = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Estimate decision recorded", await domainService.decideEstimate(req.tenantId!, req.params.id, actor(req), req.body)); } catch (e) { next(e); }
  };
  jobAssignment = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Job assignment saved", await domainService.assignJob(req.tenantId!, req.params.id, actor(req), req.body), 201); } catch (e) { next(e); }
  };
  workLog = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Work log created", await domainService.addWorkLog(req.tenantId!, req.params.id, actor(req), req.body), 201); } catch (e) { next(e); }
  };
  jobExtra = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Job extra submitted", await domainService.addJobExtra(req.tenantId!, req.params.id, actor(req), req.body), 201); } catch (e) { next(e); }
  };
  approveJobExtra = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Job extra approved", await domainService.approveJobExtra(req.tenantId!, req.params.id, actor(req))); } catch (e) { next(e); }
  };
  reservations = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Stock reservations fetched", await domainService.listReservations(req.tenantId!, req.query.status as string | undefined)); } catch (e) { next(e); }
  };
  reservationAction = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Stock reservation updated", await domainService.actOnReservation(req.tenantId!, req.params.id, actor(req), req.body)); } catch (e) { next(e); }
  };
  movements = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Stock movements fetched", await domainService.listStockMovements(req.tenantId!, req.query.inventoryItemId as string | undefined)); } catch (e) { next(e); }
  };
  purchaseOrder = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Purchase order created", await domainService.createPurchaseOrder(req.tenantId!, req.body), 201); } catch (e) { next(e); }
  };
  receivePurchaseOrder = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Purchase order receipt posted", await domainService.receivePurchaseOrder(req.tenantId!, req.params.id, actor(req), req.body), 201); } catch (e) { next(e); }
  };
  branches = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Branches fetched", await domainService.listBranches(req.tenantId!)); } catch (e) { next(e); }
  };
  stockTransferById = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Stock transfer fetched", await domainService.getStockTransfer(req.tenantId!, req.params.id)); } catch (e) { next(e); }
  };
  purchaseReturns = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Purchase returns fetched", await domainService.listPurchaseReturns(req.tenantId!)); } catch (e) { next(e); }
  };
  purchaseReturnById = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Purchase return fetched", await domainService.getPurchaseReturn(req.tenantId!, req.params.id)); } catch (e) { next(e); }
  };
  purchaseReturnCreate = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Purchase return posted", await domainService.createPurchaseReturn(req.tenantId!, actor(req), req.body), 201); } catch (e) { next(e); }
  };
  stockTransfers = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Stock transfers fetched", await domainService.listStockTransfers(req.tenantId!)); } catch (e) { next(e); }
  };
  stockTransferCreate = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Stock transfer created", await domainService.createStockTransfer(req.tenantId!, req.body), 201); } catch (e) { next(e); }
  };
  stockTransferDispatch = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Stock transfer dispatched", await domainService.dispatchStockTransfer(req.tenantId!, req.params.id, actor(req))); } catch (e) { next(e); }
  };
  stockTransferReceive = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Stock transfer received", await domainService.receiveStockTransfer(req.tenantId!, req.params.id, actor(req))); } catch (e) { next(e); }
  };
  invoiceFromJob = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Invoice generated from job", await domainService.createInvoiceFromJob(req.tenantId!, actor(req), req.body), 201); } catch (e) { next(e); }
  };
  payment = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Payment recorded", await domainService.recordPayment(req.tenantId!, req.params.id, actor(req), req.body), 201); } catch (e) { next(e); }
  };
  documentGenerate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      send(
        res,
        "PDF document generated",
        await documentsService.generate(
          req.tenantId!,
          req.user!.userId,
          req.params.kind as "estimate" | "invoice" | "service-report",
          req.params.id,
        ),
        201,
      );
    } catch (e) { next(e); }
  };
  equipmentHistory = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Equipment history fetched", await domainService.equipmentHistory(req.tenantId!, req.params.assetTag)); } catch (e) { next(e); }
  };
  projectDetails = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Service project fetched", await domainService.projectDetails(req.tenantId!, req.params.requestId, actor(req))); } catch (e) { next(e); }
  };
  customerPortal = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Customer portal data fetched", await domainService.customerPortal(req.tenantId!, req.user!.userId)); } catch (e) { next(e); }
  };
  qrScan = async (req: Request, res: Response, next: NextFunction) => {
    try {
      send(res, "QR scan recorded", await domainService.recordQrScan(req.tenantId!, actor(req), req.body, {
        ip: req.ip, userAgent: req.get("user-agent"),
      }), 201);
    } catch (e) { next(e); }
  };
  officeAssets = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Office assets fetched", await domainService.listOfficeAssets(req.tenantId!)); } catch (e) { next(e); }
  };
  officeAssetCreate = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Office asset created", await domainService.createOfficeAsset(req.tenantId!, req.body), 201); } catch (e) { next(e); }
  };
  officeAssetUpdate = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Office asset updated", await domainService.updateOfficeAsset(req.tenantId!, req.params.id, req.body)); } catch (e) { next(e); }
  };
  officeAssetMaintenance = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Office asset maintenance recorded", await domainService.addOfficeAssetMaintenance(req.tenantId!, req.params.id, actor(req), req.body), 201); } catch (e) { next(e); }
  };
  expenses = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Project expenses fetched", await domainService.listExpenses(req.tenantId!)); } catch (e) { next(e); }
  };
  expenseCreate = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Project expense created", await domainService.createExpense(req.tenantId!, actor(req), req.body), 201); } catch (e) { next(e); }
  };
  referrals = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Referrals fetched", await domainService.listReferrals(req.tenantId!)); } catch (e) { next(e); }
  };
  referralCreate = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Referral created", await domainService.createReferral(req.tenantId!, req.body), 201); } catch (e) { next(e); }
  };
  commissions = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Commissions fetched", await domainService.listCommissions(req.tenantId!)); } catch (e) { next(e); }
  };
  commissionCreate = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Commission created", await domainService.createCommission(req.tenantId!, req.body), 201); } catch (e) { next(e); }
  };
  commissionUpdate = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Commission updated", await domainService.updateCommission(req.tenantId!, req.params.id, actor(req), req.body)); } catch (e) { next(e); }
  };
  roles = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Roles fetched", await domainService.listRoles(req.tenantId!)); } catch (e) { next(e); }
  };
  roleCreate = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Role created", await domainService.createRole(req.tenantId!, req.body), 201); } catch (e) { next(e); }
  };
  roleAssignment = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Role assigned", await domainService.assignRole(req.tenantId!, req.body), 201); } catch (e) { next(e); }
  };
  roleUnassignment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await domainService.unassignRole(req.tenantId!, req.params.id);
      res.status(204).send();
    } catch (e) { next(e); }
  };
  stockPurchaseRequests = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Stock purchase requests fetched", await domainService.listStockPurchaseRequests(req.tenantId!, req.query.status as string | undefined)); } catch (e) { next(e); }
  };
  stockPurchaseRequestCreate = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Stock purchase request created", await domainService.createStockPurchaseRequest(req.tenantId!, actor(req), req.body), 201); } catch (e) { next(e); }
  };
  stockPurchaseRequestConvert = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Stock purchase request converted to PO", await domainService.convertStockPurchaseRequest(req.tenantId!, req.params.id, actor(req), req.body)); } catch (e) { next(e); }
  };
  finishTicket = async (req: Request, res: Response, next: NextFunction) => {
    try { send(res, "Service ticket finished", await domainService.finishTicket(req.tenantId!, req.params.id, actor(req))); } catch (e) { next(e); }
  };
}

export const domainController = new DomainController();
