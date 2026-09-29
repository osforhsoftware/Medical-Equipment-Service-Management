import { Prisma } from "@prisma/client";
import { prisma } from "@/db/prisma";
import { AppError } from "@/middleware/errorHandler";
import { generateReference } from "@/utils/reference";
import { getDefaultBranchId } from "@/utils/defaultBranch";

function money(value: Prisma.Decimal | number): Prisma.Decimal {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

export type EnquiryInterestLineInput = {
  source: "inventory" | "custom";
  inventoryItemId?: string | null;
  description?: string;
  sku?: string | null;
  quantity: number;
  unitPrice?: number;
};

type StoredInterestLine = {
  source: "inventory" | "custom";
  inventoryItemId: string | null;
  description: string;
  sku: string | null;
  quantity: number;
  unitPrice: number;
};

function positivePrice(...values: Array<Prisma.Decimal | number | null | undefined>) {
  for (const value of values) {
    const amount = Number(value ?? 0);
    if (Number.isFinite(amount) && amount > 0) return amount;
  }
  return 0;
}

export async function normalizeEnquiryInterest(
  tenantId: string,
  input: {
    productInterest?: string;
    quantity?: number;
    estimatedBudget?: number | null;
    interestLines?: EnquiryInterestLineInput[];
  },
) {
  const rawLines = input.interestLines ?? [];
  if (!rawLines.length) {
    const text = input.productInterest?.trim() ?? "";
    if (!text) throw new AppError("Add at least one product", 422);
    return {
      productInterest: text,
      quantity: input.quantity && input.quantity > 0 ? input.quantity : 1,
      estimatedBudget: input.estimatedBudget ?? null,
      interestLines: [] as StoredInterestLine[],
    };
  }

  const inventoryIds = rawLines
    .filter((line) => line.source === "inventory")
    .map((line) => line.inventoryItemId?.trim() || "");
  if (inventoryIds.some((id) => !id)) {
    throw new AppError("Select an inventory product for each inventory line", 422);
  }
  if (new Set(inventoryIds).size !== inventoryIds.length) {
    throw new AppError("Each inventory product can only be added once. Change the quantity on that line.", 422);
  }

  const items = inventoryIds.length
    ? await prisma.inventoryItem.findMany({
        where: { tenantId, id: { in: inventoryIds }, status: "active" },
        select: { id: true, name: true, sku: true, sellingPrice: true, unitCost: true },
      })
    : [];
  if (items.length !== inventoryIds.length) {
    throw new AppError("One or more inventory products are not available", 422);
  }
  const byId = new Map(items.map((item) => [item.id, item]));

  const lines: StoredInterestLine[] = rawLines.map((line) => {
    const quantity = Number(line.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new AppError("Each product needs a quantity greater than 0", 422);
    }
    if (line.source === "inventory") {
      const item = byId.get(line.inventoryItemId!.trim())!;
      const requested = Number(line.unitPrice);
      return {
        source: "inventory",
        inventoryItemId: item.id,
        description: item.name,
        sku: item.sku,
        quantity,
        unitPrice:
          Number.isFinite(requested) && requested >= 0
            ? requested
            : positivePrice(item.sellingPrice, item.unitCost),
      };
    }
    const description = line.description?.trim() ?? "";
    if (!description) throw new AppError("Custom product name is required", 422);
    const requested = Number(line.unitPrice ?? 0);
    return {
      source: "custom",
      inventoryItemId: null,
      description,
      sku: line.sku?.trim() || null,
      quantity,
      unitPrice: Number.isFinite(requested) && requested >= 0 ? requested : 0,
    };
  });

  const quantity = lines.reduce((sum, line) => sum + line.quantity, 0);
  const budget = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  return {
    productInterest: lines.map((line) => `${line.description} × ${line.quantity}`).join(", "),
    quantity,
    estimatedBudget: budget > 0 ? budget : null,
    interestLines: lines,
  };
}

function readInterestLines(value: Prisma.JsonValue): StoredInterestLine[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return [];
    const line = row as Record<string, unknown>;
    const description = typeof line.description === "string" ? line.description.trim() : "";
    const quantity = Number(line.quantity);
    if (!description || !Number.isFinite(quantity) || quantity <= 0) return [];
    const source = line.source === "inventory" ? "inventory" : "custom";
    const inventoryItemId = typeof line.inventoryItemId === "string" ? line.inventoryItemId : null;
    const unitPrice = Number(line.unitPrice);
    return [
      {
        source,
        inventoryItemId: source === "inventory" ? inventoryItemId : null,
        description,
        sku: typeof line.sku === "string" && line.sku.trim() ? line.sku.trim() : null,
        quantity,
        unitPrice: Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0,
      },
    ];
  });
}

async function resolveCustomerForEnquiry(
  tenantId: string,
  enquiry: { customerName: string; contactPerson: string; phone: string; email: string },
) {
  const email = enquiry.email.trim().toLowerCase();
  if (email) {
    const byEmail = await prisma.customer.findFirst({
      where: { tenantId, email: enquiry.email.trim() },
    });
    if (byEmail) return byEmail;
  }

  const byName = await prisma.customer.findFirst({
    where: { tenantId, name: enquiry.customerName.trim() },
  });
  if (byName) return byName;

  const branchId = await getDefaultBranchId(tenantId);
  const reference = await generateReference(tenantId, "CUST", "customer");
  return prisma.customer.create({
    data: {
      tenantId,
      branchId,
      reference,
      name: enquiry.customerName.trim(),
      contactPerson: enquiry.contactPerson.trim() || enquiry.customerName.trim(),
      phone: enquiry.phone.trim(),
      email: enquiry.email.trim() || `${reference.toLowerCase()}@enquiry.local`,
      city: "",
      country: "",
      type: "",
      status: "active",
    },
  });
}

export async function convertSalesEnquiryToQuotation(
  tenantId: string,
  enquiryId: string,
  actorId: string,
  actorRole: string,
) {
  if (actorRole === "estimator") {
    throw new AppError("Estimate staff cannot create sales quotations from enquiries", 403);
  }

  const enquiry = await prisma.salesEnquiry.findFirst({ where: { id: enquiryId, tenantId } });
  if (!enquiry) throw new AppError("Sales enquiry not found", 404);
  if (enquiry.convertedEstimateId) {
    throw new AppError("This enquiry was already converted to a quotation", 409);
  }

  const customer = await resolveCustomerForEnquiry(tenantId, enquiry);
  const reference = await generateReference(tenantId, "EST", "estimate");

  const storedLines = readInterestLines(enquiry.interestLines);
  const legacyQty = Math.max(1, Number(enquiry.quantity) || 1);
  const legacyBudget = enquiry.estimatedBudget != null ? Number(enquiry.estimatedBudget) : 0;
  const legacyUnit = money(legacyBudget > 0 ? legacyBudget / legacyQty : 0);
  const quoteLines = (storedLines.length
    ? storedLines.map((line) => ({
        type: line.source === "inventory" ? "part" : "other",
        inventoryItemId: line.inventoryItemId,
        description: line.description,
        partNumber: line.sku,
        quantity: line.quantity,
        unitPrice: money(line.unitPrice),
      }))
    : [
        {
          type: "product",
          inventoryItemId: null as string | null,
          description: enquiry.productInterest.trim(),
          partNumber: null as string | null,
          quantity: legacyQty,
          unitPrice: legacyUnit,
        },
      ]
  ).map((line) => ({
    ...line,
    taxRate: new Prisma.Decimal(0),
    discount: new Prisma.Decimal(0),
    lineTotal: line.unitPrice.mul(line.quantity),
  }));

  const partsCost = quoteLines.reduce((sum, line) => sum.plus(line.lineTotal), new Prisma.Decimal(0));
  const laborCost = new Prisma.Decimal(0);
  const total = partsCost.plus(laborCost);

  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 30);

  return prisma.$transaction(async (tx) => {
    const estimate = await tx.estimate.create({
      data: {
        tenantId,
        serviceRequestId: null,
        customerId: customer.id,
        reference,
        requestRef: "SALE",
        customerName: customer.name,
        equipmentName: quoteLines.length === 1 ? quoteLines[0].description : "Sales quotation",
        salespersonId: actorId,
        laborCost,
        partsCost,
        subtotal: partsCost,
        total,
        status: "draft",
        validUntil,
        notes: enquiry.notes
          ? `From enquiry ${enquiry.reference}\n${enquiry.notes}`
          : `From enquiry ${enquiry.reference}`,
      },
    });

    await tx.estimateLineItem.createMany({
      data: quoteLines.map((line) => ({
        estimateId: estimate.id,
        type: line.type,
        inventoryItemId: line.inventoryItemId,
        description: line.description,
        partNumber: line.partNumber,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        taxRate: line.taxRate,
        discount: line.discount,
        lineTotal: line.lineTotal,
      })),
    });

    await tx.salesEnquiry.update({
      where: { id: enquiry.id },
      data: {
        status: "quoted",
        convertedEstimateId: estimate.id,
      },
    });

    return tx.estimate.findUniqueOrThrow({
      where: { id: estimate.id },
      include: { lineItems: true },
    });
  });
}
