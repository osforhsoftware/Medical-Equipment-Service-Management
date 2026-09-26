import { Router, type Request, type Response, type NextFunction } from "express";
import { prisma } from "@/db/prisma";
import { authenticate, requireRole } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenant";
import { validate } from "@/middleware/validate";
import { createRfqSchema, updateRfqSchema, createSupplierQuoteSchema } from "@/schemas/rfqs.schema";
import { domainService } from "@/services/domain.service";
import { success } from "@/utils/response";

const router = Router();
router.use(authenticate, resolveTenant);

const canAccess = requireRole("admin", "inventory", "coordinator", "billing");
const canManage = requireRole("admin", "inventory", "coordinator");
const canConvertToPo = requireRole("admin", "inventory");

router.get("/", canAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await prisma.supplierRFQ.findMany({
      where: { tenantId: req.tenantId! },
      include: { quotes: true, supplierRecord: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(success("RFQs retrieved", list));
  } catch (err) {
    next(err);
  }
});

router.get("/:id", canAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rfq = await prisma.supplierRFQ.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId! },
      include: { quotes: true, supplierRecord: true },
    });
    if (!rfq) {
      res.status(404).json({ success: false, message: "RFQ not found", data: null });
      return;
    }
    res.json(success("RFQ retrieved", rfq));
  } catch (err) {
    next(err);
  }
});

router.post("/", canManage, validate(createRfqSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!;
    const year = new Date().getFullYear();
    const count = await prisma.supplierRFQ.count({ where: { tenantId } });
    const reference = `RFQ-${year}-${String(count + 1).padStart(4, "0")}`;

    const { dueDate, ...rest } = req.body;
    const created = await prisma.supplierRFQ.create({
      data: {
        ...rest,
        tenantId,
        reference,
        createdBy: req.user?.name || req.user?.userId || "System",
        dueDate: dueDate ? new Date(dueDate) : null,
      },
      include: { quotes: true, supplierRecord: true },
    });
    res.status(201).json(success("RFQ created", created));
  } catch (err) {
    next(err);
  }
});

router.put("/:id", canManage, validate(updateRfqSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;
    const existing = await prisma.supplierRFQ.findFirst({ where: { id, tenantId } });
    if (!existing) {
      res.status(404).json({ success: false, message: "RFQ not found", data: null });
      return;
    }

    const { dueDate, ...rest } = req.body;
    const updated = await prisma.supplierRFQ.update({
      where: { id },
      data: {
        ...rest,
        dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : undefined,
      },
      include: { quotes: true, supplierRecord: true },
    });
    res.json(success("RFQ updated", updated));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", canManage, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;
    const existing = await prisma.supplierRFQ.findFirst({ where: { id, tenantId } });
    if (!existing) {
      res.status(404).json({ success: false, message: "RFQ not found", data: null });
      return;
    }
    await prisma.supplierRFQ.delete({ where: { id } });
    res.json(success("RFQ deleted", null));
  } catch (err) {
    next(err);
  }
});

router.post("/:id/quotes", canManage, validate(createSupplierQuoteSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!;
    const rfqId = req.params.id;
    const rfq = await prisma.supplierRFQ.findFirst({ where: { id: rfqId, tenantId } });
    if (!rfq) {
      res.status(404).json({ success: false, message: "RFQ not found", data: null });
      return;
    }

    const {
      validUntil,
      lines,
      notes,
      currency,
      warranty,
      incoterm,
      shippingTerms,
      paymentTerms,
      countryOfOrigin,
    } = req.body;
    const quote = await prisma.supplierQuote.create({
      data: {
        tenantId,
        rfqId,
        lines,
        notes,
        currency,
        warranty,
        incoterm,
        shippingTerms,
        paymentTerms,
        countryOfOrigin,
        validUntil: validUntil ? new Date(validUntil) : null,
      },
    });

    await prisma.supplierRFQ.update({
      where: { id: rfqId },
      data: { status: "quoted" },
    });

    res.status(201).json(success("Supplier quote submitted", quote));
  } catch (err) {
    next(err);
  }
});

router.post("/:id/quotes/:quoteId/convert-to-po", canConvertToPo, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await domainService.convertSupplierQuoteToPurchaseOrder(
      req.tenantId!,
      req.params.id,
      req.params.quoteId,
    );
    res.status(201).json(success("Purchase order created from supplier quote", data));
  } catch (err) {
    next(err);
  }
});

export default router;
