import { Router, type Request, type Response, type NextFunction } from "express";
import { prisma } from "@/db/prisma";
import { authenticate, requireRole } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenant";
import { validate } from "@/middleware/validate";
import { createSalesEnquirySchema, updateSalesEnquirySchema } from "@/schemas/salesEnquiries.schema";
import { convertSalesEnquiryToQuotation } from "@/services/salesEnquiries.service";
import { assertOwnSalesRecord, isSalesSelfScoped } from "@/lib/salesScope";
import { success } from "@/utils/response";

const router = Router();
router.use(authenticate, resolveTenant);

const canAccess = requireRole("admin", "sales", "coordinator", "billing");
const canManage = requireRole("admin", "sales", "coordinator");

function enquiryOwnerWhere(req: Request) {
  if (!isSalesSelfScoped(req.user?.role)) return {};
  return { createdBy: req.user!.userId };
}

router.get("/", canAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await prisma.salesEnquiry.findMany({
      where: { tenantId: req.tenantId!, ...enquiryOwnerWhere(req) },
      orderBy: { createdAt: "desc" },
    });
    res.json(success("Sales enquiries retrieved", list));
  } catch (err) {
    next(err);
  }
});

router.get("/:id", canAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const enquiry = await prisma.salesEnquiry.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId!, ...enquiryOwnerWhere(req) },
    });
    if (!enquiry) {
      res.status(404).json({ success: false, message: "Sales enquiry not found", data: null });
      return;
    }
    res.json(success("Sales enquiry retrieved", enquiry));
  } catch (err) {
    next(err);
  }
});

router.post("/", canManage, validate(createSalesEnquirySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!;
    const year = new Date().getFullYear();
    const count = await prisma.salesEnquiry.count({ where: { tenantId } });
    const reference = `ENQ-${year}-${String(count + 1).padStart(4, "0")}`;

    const { followUpDate, ...rest } = req.body;
    const actorName = req.user!.name?.trim() || "Sales";
    const created = await prisma.salesEnquiry.create({
      data: {
        ...rest,
        tenantId,
        reference,
        createdBy: req.user!.userId,
        assignedTo: rest.assignedTo?.trim() || actorName,
        followUpDate: followUpDate ? new Date(followUpDate) : null,
      },
    });
    res.status(201).json(success("Sales enquiry created", created));
  } catch (err) {
    next(err);
  }
});

router.put("/:id", canManage, validate(updateSalesEnquirySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;
    const existing = await prisma.salesEnquiry.findFirst({ where: { id, tenantId } });
    if (!existing) {
      res.status(404).json({ success: false, message: "Sales enquiry not found", data: null });
      return;
    }
    assertOwnSalesRecord(req.user?.role, req.user!.userId, existing.createdBy, "Sales enquiry not found");

    const { followUpDate, ...rest } = req.body;
    const updated = await prisma.salesEnquiry.update({
      where: { id },
      data: {
        ...rest,
        followUpDate: followUpDate !== undefined ? (followUpDate ? new Date(followUpDate) : null) : undefined,
      },
    });
    res.json(success("Sales enquiry updated", updated));
  } catch (err) {
    next(err);
  }
});

router.post("/:id/convert-to-quotation", canManage, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.salesEnquiry.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId! },
    });
    if (!existing) {
      res.status(404).json({ success: false, message: "Sales enquiry not found", data: null });
      return;
    }
    assertOwnSalesRecord(req.user?.role, req.user!.userId, existing.createdBy, "Sales enquiry not found");

    const estimate = await convertSalesEnquiryToQuotation(
      req.tenantId!,
      req.params.id,
      req.user!.userId,
      req.user!.role,
    );
    res.status(201).json(success("Sales quotation created from enquiry", estimate));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", canManage, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;
    const existing = await prisma.salesEnquiry.findFirst({ where: { id, tenantId } });
    if (!existing) {
      res.status(404).json({ success: false, message: "Sales enquiry not found", data: null });
      return;
    }
    assertOwnSalesRecord(req.user?.role, req.user!.userId, existing.createdBy, "Sales enquiry not found");
    await prisma.salesEnquiry.delete({ where: { id } });
    res.json(success("Sales enquiry deleted", null));
  } catch (err) {
    next(err);
  }
});

export default router;
