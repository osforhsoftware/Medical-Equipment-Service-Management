import { Router } from "express";
import { salesController } from "@/controllers/sales.controller";
import { SALES_DESK_ROLES } from "@/config/apiAccess";
import { authenticate, requirePermission, requireRole } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenant";
import { validate } from "@/middleware/validate";
import { convertSalesQuoteSchema, salesInvoiceSchema, upsertSalesOrderSchema } from "@/schemas/sales.schema";

const router = Router();
router.use(authenticate, resolveTenant);

const desk = requireRole(...SALES_DESK_ROLES);
const write = requirePermission("sales.write");
const fulfill = requirePermission("sales.fulfill");
const bill = requirePermission("sales.bill");

router.get("/desk", desk, salesController.getDesk);
router.get("/reports", desk, salesController.getReports);
router.get("/orders", desk, salesController.listOrders);
router.post("/orders", write, validate(upsertSalesOrderSchema), salesController.createOrder);
router.get("/orders/:id", desk, salesController.getOrder);
router.put("/orders/:id", write, validate(upsertSalesOrderSchema), salesController.updateOrder);
router.post("/quotes/:estimateId/convert", write, validate(convertSalesQuoteSchema), salesController.convertQuote);
router.post("/orders/:id/deliver", fulfill, salesController.deliver);
router.post("/orders/:id/invoice", bill, validate(salesInvoiceSchema), salesController.createInvoice);

export default router;
