import { Router, type Request, type Response, type NextFunction } from "express";
import { prisma } from "@/db/prisma";
import { authenticate, requireRole } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenant";
import { validate } from "@/middleware/validate";
import { createWarrantyClaimSchema, updateWarrantyClaimSchema, decideWarrantyClaimSchema } from "@/schemas/warrantyClaims.schema";
import { success } from "@/utils/response";

const router = Router();
router.use(authenticate, resolveTenant);

const canAccess = requireRole("admin", "coordinator", "inspector", "estimator", "sales", "billing", "engineer");
const canManage = requireRole("admin", "coordinator", "inspector");

router.get("/", canAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await prisma.warrantyClaim.findMany({
      where: { tenantId: req.tenantId! },
      orderBy: { createdAt: "desc" },
    });
    res.json(success("Warranty claims retrieved", list));
  } catch (err) {
    next(err);
  }
});

router.get("/:id", canAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const claim = await prisma.warrantyClaim.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId! },
    });
    if (!claim) {
      res.status(404).json({ success: false, message: "Warranty claim not found", data: null });
      return;
    }
    res.json(success("Warranty claim retrieved", claim));
  } catch (err) {
    next(err);
  }
});

router.post("/", canManage, validate(createWarrantyClaimSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!;
    const year = new Date().getFullYear();
    const count = await prisma.warrantyClaim.count({ where: { tenantId } });
    const reference = `WC-${year}-${String(count + 1).padStart(4, "0")}`;

    const created = await prisma.warrantyClaim.create({
      data: {
        ...req.body,
        tenantId,
        reference,
        createdBy: req.user?.name || req.user?.userId || "System",
      },
    });
    res.status(201).json(success("Warranty claim created", created));
  } catch (err) {
    next(err);
  }
});

router.put("/:id", canManage, validate(updateWarrantyClaimSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;
    const existing = await prisma.warrantyClaim.findFirst({ where: { id, tenantId } });
    if (!existing) {
      res.status(404).json({ success: false, message: "Warranty claim not found", data: null });
      return;
    }

    const updated = await prisma.warrantyClaim.update({
      where: { id },
      data: req.body,
    });
    res.json(success("Warranty claim updated", updated));
  } catch (err) {
    next(err);
  }
});

router.post("/:id/decide", canManage, validate(decideWarrantyClaimSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;
    const existing = await prisma.warrantyClaim.findFirst({ where: { id, tenantId } });
    if (!existing) {
      res.status(404).json({ success: false, message: "Warranty claim not found", data: null });
      return;
    }

    const updated = await prisma.warrantyClaim.update({
      where: { id },
      data: req.body,
    });
    res.json(success("Warranty claim decision recorded", updated));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", canManage, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;
    const existing = await prisma.warrantyClaim.findFirst({ where: { id, tenantId } });
    if (!existing) {
      res.status(404).json({ success: false, message: "Warranty claim not found", data: null });
      return;
    }
    await prisma.warrantyClaim.delete({ where: { id } });
    res.json(success("Warranty claim deleted", null));
  } catch (err) {
    next(err);
  }
});

export default router;
