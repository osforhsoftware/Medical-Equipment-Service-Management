import { Prisma } from "@prisma/client";
import { prisma } from "@/db/prisma";
import { AppError } from "@/middleware/errorHandler";
import { generateReference } from "@/utils/reference";
import { getDefaultBranchId } from "@/utils/defaultBranch";

function money(value: Prisma.Decimal | number): Prisma.Decimal {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
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

  const qty = Math.max(1, Number(enquiry.quantity) || 1);
  const budget = enquiry.estimatedBudget != null ? Number(enquiry.estimatedBudget) : 0;
  const unitPrice = budget > 0 ? budget / qty : 0;
  const lineTotal = money(unitPrice).mul(qty);
  const partsCost = lineTotal;
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
        equipmentName: "Sales quotation",
        salespersonId: actorId,
        laborCost,
        partsCost,
        total,
        status: "draft",
        validUntil,
        notes: enquiry.notes
          ? `From enquiry ${enquiry.reference}\n${enquiry.notes}`
          : `From enquiry ${enquiry.reference}`,
      },
    });

    await tx.estimateLineItem.create({
      data: {
        estimateId: estimate.id,
        type: "product",
        description: enquiry.productInterest.trim(),
        quantity: qty,
        unitPrice: money(unitPrice),
        taxRate: new Prisma.Decimal(0),
        discount: new Prisma.Decimal(0),
        lineTotal,
      },
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
