import { z } from "zod";

const money = z.coerce.number().finite().nonnegative();
const positiveInt = z.coerce.number().int().positive();

export const catalogItemSchema = z.object({
  body: z.object({
    branchId: z.string().cuid().nullable().optional(),
    code: z.string().trim().min(1).max(50),
    name: z.string().trim().min(1).max(160),
    description: z.string().trim().max(2000).nullable().optional(),
    category: z.string().trim().min(1).max(80),
    unit: z.string().trim().min(1).max(30).default("service"),
    unitPrice: money,
    taxRate: z.coerce.number().min(0).max(100).default(0),
    isActive: z.boolean().optional(),
  }),
});

export const estimateRevisionSchema = z.object({
  body: z.object({
    terms: z.string().max(10000).nullable().optional(),
    notes: z.string().max(10000).nullable().optional(),
    discount: money.default(0),
    sendForApproval: z.boolean().optional(),
    status: z.enum(["draft", "pendingAdminApproval"]).optional(),
    lines: z.array(z.object({
      type: z.enum(["labor", "part", "transport", "testing", "calibration", "service", "other"]),
      description: z.string().trim().min(1).max(500),
      catalogItemId: z.string().cuid().nullable().optional(),
      inventoryItemId: z.string().cuid().nullable().optional(),
      partNumber: z.string().max(100).nullable().optional(),
      quantity: z.coerce.number().positive(),
      unitPrice: money,
      taxRate: z.coerce.number().min(0).max(100).default(0),
      discount: money.default(0),
    })).min(1),
  }),
});

export const inspectionRecommendationSchema = z.object({
  body: z.object({
    catalogItemId: z.string().cuid().nullable().optional(),
    inventoryItemId: z.string().cuid().nullable().optional(),
    type: z.enum(["service", "part", "labor", "testing", "calibration", "transport", "other"]).default("other"),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(5000),
    priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
    quantity: z.coerce.number().positive().default(1),
    estimatedCost: money.default(0),
  }),
});

export const attachmentLinkSchema = z.object({
  body: z.object({
    fileId: z.string().cuid(),
    caption: z.string().max(500).optional(),
    kind: z.enum(["evidence", "image", "video", "report", "signature"]).default("evidence"),
  }),
});

export const estimateDecisionSchema = z.object({
  body: z.object({
    decision: z.enum(["approved", "rejected", "revision"]),
    note: z.string().trim().max(5000).optional(),
    engineerId: z.string().cuid().optional(),
    scheduledFor: z.coerce.date().optional(),
  }),
});

export const stockPurchaseRequestSchema = z.object({
  body: z.object({
    inventoryItemId: z.string().cuid(),
    quantity: z.coerce.number().int().positive(),
    serviceRequestId: z.string().cuid().nullable().optional(),
    jobId: z.string().cuid().nullable().optional(),
    note: z.string().trim().max(2000).optional(),
    force: z.boolean().optional(),
  }),
});

export const convertStockPurchaseRequestSchema = z.object({
  body: z.object({
    expectedDate: z.coerce.date(),
    unitCost: money.optional(),
  }),
});

export const stockAdjustmentSchema = z.object({
  body: z.object({
    quantityDelta: z.coerce.number().int(),
    reason: z.string().trim().min(1).max(500),
  }),
});

export const inventoryImageSchema = z.object({
  body: z.object({
    fileId: z.string().cuid(),
    sortOrder: z.coerce.number().int().min(0).optional().default(0),
  }),
});

export const jobAssignmentSchema = z.object({
  body: z.object({
    userId: z.string().cuid(),
    role: z.string().trim().min(1).max(50),
    isLead: z.boolean().default(false),
  }),
});

export const workLogSchema = z.object({
  body: z.object({
    startedAt: z.coerce.date(),
    endedAt: z.coerce.date().nullable().optional(),
    workPerformed: z.string().trim().min(1).max(20000),
    testingResult: z.string().max(20000).nullable().optional(),
    calibrationResult: z.string().max(20000).nullable().optional(),
  }),
});

export const jobExtraSchema = z.object({
  body: z.object({
    inventoryItemId: z.string().cuid().nullable().optional(),
    description: z.string().trim().min(1).max(500),
    reason: z.string().trim().min(1).max(5000),
    quantity: z.coerce.number().positive(),
    unitPrice: money,
    taxRate: z.coerce.number().min(0).max(100).default(0),
  }),
});

export const reservationActionSchema = z.object({
  body: z.object({
    action: z.enum(["consume", "release"]),
    quantity: positiveInt,
  }),
});

export const receivePurchaseOrderSchema = z.object({
  body: z.object({
    reference: z.string().trim().min(1).max(80),
    notes: z.string().max(2000).optional(),
    lines: z.array(z.object({
      purchaseOrderLineId: z.string().cuid(),
      quantity: positiveInt,
    })).min(1),
  }),
});

export const createStockTransferSchema = z.object({
  body: z.object({
    fromBranchId: z.string().cuid(),
    toBranchId: z.string().cuid(),
    lines: z.array(z.object({
      inventoryItemId: z.string().cuid(),
      quantity: positiveInt,
    })).min(1),
  }).refine((value) => value.fromBranchId !== value.toBranchId, {
    message: "Source and destination branches must be different",
  }),
});

export const createPurchaseOrderSchema = z.object({
  body: z.object({
    supplierId: z.string().cuid().nullable().optional(),
    supplier: z.string().trim().min(1).max(200),
    branchId: z.string().cuid().nullable().optional(),
    expectedDate: z.coerce.date(),
    lines: z.array(z.object({
      inventoryItemId: z.string().cuid().nullable().optional(),
      sku: z.string().trim().min(1).max(100),
      description: z.string().trim().min(1).max(500),
      quantityOrdered: positiveInt,
      unitCost: money,
      taxRate: z.coerce.number().min(0).max(100).default(0),
    })).min(1),
  }),
});

export const invoiceFromJobSchema = z.object({
  body: z.object({
    jobId: z.string().cuid(),
    dueAt: z.coerce.date(),
    currency: z.string().trim().length(3).default("USD"),
  }),
});

export const paymentSchema = z.object({
  body: z.object({
    amount: z.coerce.number().positive(),
    method: z.string().trim().min(1).max(50),
    reference: z.string().max(100).optional(),
    note: z.string().max(1000).optional(),
    paidAt: z.coerce.date().optional(),
  }),
});

export const qrScanSchema = z.object({
  body: z.object({
    assetTag: z.string().trim().min(1).max(100),
    source: z.enum(["camera", "manual", "label"]).default("manual"),
  }),
});

export const officeAssetSchema = z.object({
  body: z.object({
    branchId: z.string().cuid().nullable().optional(),
    assetTag: z.string().trim().min(1).max(100),
    name: z.string().trim().min(1).max(200),
    category: z.string().trim().min(1).max(100),
    serialNumber: z.string().max(150).nullable().optional(),
    purchaseDate: z.coerce.date().nullable().optional(),
    purchaseCost: money.default(0),
    salvageValue: money.default(0),
    usefulLifeMonths: z.coerce.number().int().positive().nullable().optional(),
    depreciationMethod: z.enum(["straight-line", "declining-balance", "none"]).default("straight-line"),
    assignedTo: z.string().max(150).nullable().optional(),
    location: z.string().max(300).nullable().optional(),
    warrantyEnd: z.coerce.date().nullable().optional(),
    nextMaintenanceAt: z.coerce.date().nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  }),
});

export const officeAssetUpdateSchema = z.object({
  body: officeAssetSchema.shape.body.partial().refine((value) => Object.keys(value).length > 0, {
    message: "At least one office asset field is required",
  }),
});

export const officeAssetMaintenanceSchema = z.object({
  body: z.object({
    performedAt: z.coerce.date(),
    nextMaintenanceAt: z.coerce.date().nullable().optional(),
    provider: z.string().max(200).nullable().optional(),
    description: z.string().trim().min(1).max(5000),
    cost: money.default(0),
  }),
});

export const expenseSchema = z.object({
  body: z.object({
    branchId: z.string().cuid().nullable().optional(),
    projectRef: z.string().max(100).nullable().optional(),
    jobId: z.string().cuid().nullable().optional(),
    category: z.string().trim().min(1).max(100),
    description: z.string().trim().min(1).max(1000),
    amount: z.coerce.number().positive(),
    incurredAt: z.coerce.date(),
    vendor: z.string().max(200).nullable().optional(),
    receiptFileId: z.string().cuid().nullable().optional(),
  }),
});

export const referralSchema = z.object({
  body: z.object({
    customerId: z.string().cuid().nullable().optional(),
    serviceRequestId: z.string().cuid().nullable().optional(),
    referrerName: z.string().trim().min(1).max(200),
    referrerType: z.string().trim().min(1).max(80),
    source: z.string().max(100).nullable().optional(),
  }),
});

export const commissionSchema = z.object({
  body: z.object({
    referralId: z.string().cuid().nullable().optional(),
    invoiceId: z.string().cuid().nullable().optional(),
    payeeName: z.string().trim().min(1).max(200),
    basisAmount: money,
    rate: z.coerce.number().min(0).max(100),
  }),
});

export const commissionActionSchema = z.object({
  body: z.object({
    status: z.enum(["accrued", "approved", "paid", "cancelled"]),
    paidAt: z.coerce.date().nullable().optional(),
  }),
});

export const roleSchema = z.object({
  body: z.object({
    key: z.string().trim().regex(/^[a-z][a-z0-9_-]*$/).max(50),
    name: z.string().trim().min(1).max(100),
    description: z.string().max(1000).nullable().optional(),
    permissions: z.record(z.unknown()).default({}),
  }),
});

export const roleAssignmentSchema = z.object({
  body: z.object({
    userId: z.string().cuid(),
    roleId: z.string().cuid(),
    branchId: z.string().cuid().nullable().optional(),
  }),
});
