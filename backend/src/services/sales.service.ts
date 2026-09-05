import { Prisma } from "@prisma/client";
import { prisma } from "@/db/prisma";
import { AppError } from "@/middleware/errorHandler";
import { generateReference } from "@/utils/reference";

const money = (value: Prisma.Decimal | number | string | null | undefined) =>
  new Prisma.Decimal(value ?? 0).toDecimalPlaces(2);

const num = (value: unknown) => Number(value ?? 0);

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function paymentLabel(balanceDue: number, total: number) {
  if (balanceDue <= 0) return "paid";
  if (balanceDue < total) return "partial";
  return "unpaid";
}

const orderInclude = {
  lines: { include: { inventoryItem: true } },
  invoices: { include: { payments: true } },
  estimate: { select: { id: true, reference: true, status: true } },
} as const;

export class SalesService {
  private isSalesQuote(estimate: { serviceRequestId: string | null }) {
    return !estimate.serviceRequestId;
  }

  async getDesk(tenantId: string) {
    const today = startOfDay();
    const month = startOfMonth();

    const [
      activeCustomers,
      estimateGroups,
      invoiceAgg,
      overdueCount,
      recentQuotes,
      outstandingInvoices,
      todaySales,
      monthSales,
      orderCounts,
      pendingOrders,
      pendingPaymentInvoices,
      topLines,
      lowStock,
    ] = await Promise.all([
      prisma.customer.count({ where: { tenantId, status: "active" } }),
      prisma.estimate.groupBy({
        by: ["status"],
        where: { tenantId, serviceRequestId: null },
        _count: true,
        _sum: { total: true },
      }),
      prisma.invoice.aggregate({
        where: { tenantId, status: { not: "closed" } },
        _sum: { total: true, paidTotal: true, balanceDue: true },
        _count: { _all: true },
      }),
      prisma.invoice.count({ where: { tenantId, status: "overdue" } }),
      prisma.estimate.findMany({
        where: { tenantId, serviceRequestId: null },
        orderBy: { updatedAt: "desc" },
        take: 8,
        select: {
          id: true,
          reference: true,
          customerName: true,
          status: true,
          total: true,
          validUntil: true,
          updatedAt: true,
          serviceRequestId: true,
        },
      }),
      prisma.invoice.findMany({
        where: {
          tenantId,
          status: { in: ["sent", "approved", "overdue"] },
          balanceDue: { gt: 0 },
        },
        orderBy: { dueAt: "asc" },
        take: 8,
        select: {
          id: true,
          reference: true,
          customerName: true,
          status: true,
          total: true,
          balanceDue: true,
          dueAt: true,
        },
      }),
      prisma.salesOrder.aggregate({
        where: { tenantId, orderedAt: { gte: today }, status: { not: "cancelled" } },
        _sum: { total: true },
        _count: true,
      }),
      prisma.salesOrder.aggregate({
        where: { tenantId, orderedAt: { gte: month }, status: { not: "cancelled" } },
        _sum: { total: true },
        _count: true,
      }),
      prisma.salesOrder.count({ where: { tenantId, status: { not: "cancelled" } } }),
      prisma.salesOrder.count({
        where: { tenantId, deliveryStatus: "pending", status: { not: "cancelled" } },
      }),
      prisma.invoice.aggregate({
        where: { tenantId, salesOrderId: { not: null }, balanceDue: { gt: 0 } },
        _sum: { balanceDue: true },
        _count: true,
      }),
      prisma.salesOrderLine.groupBy({
        by: ["description"],
        where: { salesOrder: { tenantId, status: { not: "cancelled" } } },
        _sum: { quantity: true, lineTotal: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 5,
      }),
      prisma.inventoryItem.findMany({
        where: { tenantId },
        orderBy: { inStock: "asc" },
        take: 40,
        select: {
          id: true,
          sku: true,
          name: true,
          category: true,
          inStock: true,
          reserved: true,
          reorderLevel: true,
        },
      }),
    ]);

    const quotesByStatus = Object.fromEntries(
      estimateGroups.map((row) => [row.status, { count: row._count, total: num(row._sum.total) }]),
    );
    const openQuoteStatuses = ["draft", "sent", "pendingAdminApproval", "revision"];
    const openQuotes = estimateGroups
      .filter((row) => openQuoteStatuses.includes(row.status))
      .reduce((sum, row) => sum + row._count, 0);

    const lowStockProducts = lowStock
      .filter((item) => item.inStock <= item.reorderLevel)
      .slice(0, 8)
      .map((item) => ({
        ...item,
        available: Math.max(0, item.inStock - item.reserved),
      }));

    return {
      process: [
        { key: "party", label: "Customer", hint: "Any hospital, clinic, or walk-in" },
        { key: "items", label: "Sold items", hint: "Add parts, set sale price" },
        { key: "order", label: "Sale", hint: "Save the deal" },
        { key: "deliver", label: "Deliver", hint: "Stock goes out" },
        { key: "invoice", label: "Invoice & pay", hint: "Billing collection" },
      ],
      kpis: {
        activeCustomers,
        openQuotes,
        pendingApproval: quotesByStatus.sent?.count ?? quotesByStatus.pendingAdminApproval?.count ?? 0,
        quoteValue: estimateGroups.reduce((sum, row) => sum + num(row._sum.total), 0),
        outstanding: num(invoiceAgg._sum.balanceDue),
        collected: num(invoiceAgg._sum.paidTotal),
        overdueInvoices: overdueCount,
        openInvoices: invoiceAgg._count._all,
        todaySales: num(todaySales._sum.total),
        monthlySales: num(monthSales._sum.total),
        totalOrders: orderCounts,
        pendingOrders,
        pendingPayments: pendingPaymentInvoices._count,
        pendingPaymentAmount: num(pendingPaymentInvoices._sum.balanceDue),
      },
      quotesByStatus,
      recentQuotes: recentQuotes.map((quote) => ({
        ...quote,
        total: num(quote.total),
        kind: "sales" as const,
      })),
      outstandingInvoices: outstandingInvoices.map((invoice) => ({
        ...invoice,
        total: num(invoice.total),
        balanceDue: num(invoice.balanceDue),
      })),
      topSellingProducts: topLines.map((row) => ({
        name: row.description,
        quantity: num(row._sum.quantity),
        amount: num(row._sum.lineTotal),
      })),
      lowStockProducts,
    };
  }

  async listOrders(tenantId: string) {
    const rows = await prisma.salesOrder.findMany({
      where: { tenantId },
      include: { lines: true, invoices: true },
      orderBy: { orderedAt: "desc" },
      take: 100,
    });
    return rows.map((row) => this.serializeOrder(row));
  }

  async getOrder(tenantId: string, id: string) {
    const order = await prisma.salesOrder.findFirst({
      where: { id, tenantId },
      include: orderInclude,
    });
    if (!order) throw new AppError("Sales order not found", 404);
    return this.serializeOrder(order);
  }

  async createOrder(
    tenantId: string,
    actor: { userId: string; name?: string },
    input: {
      customerId: string;
      notes?: string | null;
      lines: Array<{
        inventoryItemId?: string | null;
        catalogItemId?: string | null;
        type?: string;
        description: string;
        sku?: string | null;
        quantity: number;
        unitPrice: number;
        discount?: number;
        taxRate?: number;
      }>;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findFirst({ where: { id: input.customerId, tenantId } });
      if (!customer) throw new AppError("Customer not found", 404);
      const user = await tx.user.findFirst({ where: { id: actor.userId, tenantId } });
      const salespersonName = user?.name ?? actor.name ?? "Sales";
      const lines = await this.resolveSaleLines(tx, tenantId, input.lines);
      await this.assertStockForLines(tx, tenantId, lines);
      const totals = this.totalsFromLines(lines);
      const reference = await generateReference(tenantId, "SO", "salesOrder", tx);
      const order = await tx.salesOrder.create({
        data: {
          tenantId,
          estimateId: null,
          customerId: customer.id,
          salespersonId: actor.userId,
          branchId: user?.branchId ?? customer.branchId ?? null,
          reference,
          customerName: customer.name,
          salespersonName,
          status: "confirmed",
          deliveryStatus: "pending",
          paymentStatus: "unpaid",
          subtotal: totals.subtotal,
          discount: totals.discount,
          tax: totals.tax,
          total: totals.total,
          notes: input.notes ?? null,
          lines: {
            create: lines.map((line) => ({
              inventoryItemId: line.inventoryItemId,
              catalogItemId: line.catalogItemId,
              type: line.type,
              description: line.description,
              sku: line.sku,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              discount: line.discount,
              taxRate: line.taxRate,
              lineTotal: line.lineTotal,
            })),
          },
        },
        include: orderInclude,
      });
      return this.serializeOrder(order);
    });
  }

  async updateOrder(
    tenantId: string,
    id: string,
    input: {
      customerId: string;
      notes?: string | null;
      lines: Array<{
        inventoryItemId?: string | null;
        catalogItemId?: string | null;
        type?: string;
        description: string;
        sku?: string | null;
        quantity: number;
        unitPrice: number;
        discount?: number;
        taxRate?: number;
      }>;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.salesOrder.findFirst({
        where: { id, tenantId },
        include: { invoices: true, lines: true },
      });
      if (!order) throw new AppError("Sales order not found", 404);
      if (order.deliveryStatus === "delivered") {
        throw new AppError("Delivered sales cannot be edited", 409);
      }
      if (order.invoices.some((inv) => inv.status !== "closed")) {
        throw new AppError("Invoiced sales cannot be edited", 409);
      }
      const customer = await tx.customer.findFirst({ where: { id: input.customerId, tenantId } });
      if (!customer) throw new AppError("Customer not found", 404);
      const lines = await this.resolveSaleLines(tx, tenantId, input.lines);
      await this.assertStockForLines(tx, tenantId, lines);
      const totals = this.totalsFromLines(lines);
      await tx.salesOrderLine.deleteMany({ where: { salesOrderId: order.id } });
      const updated = await tx.salesOrder.update({
        where: { id: order.id },
        data: {
          customerId: customer.id,
          customerName: customer.name,
          notes: input.notes ?? null,
          subtotal: totals.subtotal,
          discount: totals.discount,
          tax: totals.tax,
          total: totals.total,
          lines: {
            create: lines.map((line) => ({
              inventoryItemId: line.inventoryItemId,
              catalogItemId: line.catalogItemId,
              type: line.type,
              description: line.description,
              sku: line.sku,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              discount: line.discount,
              taxRate: line.taxRate,
              lineTotal: line.lineTotal,
            })),
          },
        },
        include: orderInclude,
      });
      return this.serializeOrder(updated);
    });
  }

  async convertQuote(
    tenantId: string,
    estimateId: string,
    actor: { userId: string; name?: string },
    input?: { commissionRate?: number; notes?: string },
  ) {
    return prisma.$transaction(async (tx) => {
      const estimate = await tx.estimate.findFirst({
        where: { id: estimateId, tenantId },
        include: { lineItems: true, customer: true, reservations: true },
      });
      if (!estimate) throw new AppError("Quotation not found", 404);
      if (!this.isSalesQuote(estimate)) {
        throw new AppError("Service estimates stay on the service ticket workflow", 409);
      }
      if (estimate.status !== "approved") {
        throw new AppError("Approve the quotation before converting to a sales order", 409);
      }
      if (!estimate.customerId) throw new AppError("Quotation is missing a customer", 422);

      const existing = await tx.salesOrder.findUnique({ where: { estimateId } });
      if (existing) throw new AppError("This quotation already has a sales order", 409);

      const user = await tx.user.findFirst({ where: { id: actor.userId, tenantId } });
      const salespersonName = user?.name ?? actor.name ?? "Sales";

      for (const line of estimate.lineItems) {
        if (!line.inventoryItemId) continue;
        const item = await tx.inventoryItem.findFirst({ where: { id: line.inventoryItemId, tenantId } });
        if (!item) throw new AppError(`Inventory item not found for ${line.description}`, 404);
        const needed = Math.ceil(Number(line.quantity));
        const reservedHere = estimate.reservations
          .filter((r) => r.inventoryItemId === item.id && r.status === "active")
          .reduce((sum, r) => sum + (r.quantity - r.consumed - r.released), 0);
        const available = Math.max(0, item.inStock - item.reserved) + reservedHere;
        if (needed > available) {
          throw new AppError(
            `Not enough stock for ${item.name} (${item.sku}). Available ${available}, requested ${needed}.`,
            409,
          );
        }
      }

      const reference = await generateReference(tenantId, "SO", "salesOrder", tx);
      const order = await tx.salesOrder.create({
        data: {
          tenantId,
          estimateId: estimate.id,
          customerId: estimate.customerId,
          salespersonId: actor.userId,
          branchId: user?.branchId ?? estimate.customer?.branchId ?? null,
          reference,
          customerName: estimate.customerName,
          salespersonName,
          status: "confirmed",
          deliveryStatus: "pending",
          paymentStatus: "unpaid",
          subtotal: estimate.subtotal,
          discount: estimate.discount,
          tax: estimate.tax,
          total: estimate.total,
          notes: input?.notes ?? estimate.notes,
          lines: {
            create: estimate.lineItems.map((line) => ({
              inventoryItemId: line.inventoryItemId,
              catalogItemId: line.catalogItemId,
              type: line.type,
              description: line.description,
              sku: line.partNumber,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              discount: line.discount,
              taxRate: line.taxRate,
              lineTotal: line.lineTotal,
            })),
          },
        },
      });

      await tx.stockReservation.updateMany({
        where: { tenantId, estimateId: estimate.id },
        data: { salesOrderId: order.id },
      });
      await tx.estimate.update({
        where: { id: estimate.id },
        data: { status: "converted", salespersonId: actor.userId },
      });

      const rate = Number(input?.commissionRate ?? 0);
      if (rate > 0) {
        await tx.commission.create({
          data: {
            tenantId,
            salesOrderId: order.id,
            payeeName: salespersonName,
            basisAmount: estimate.total,
            rate,
            amount: money(estimate.total).mul(rate).div(100),
            status: "accrued",
          },
        });
      }

      return tx.salesOrder.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude });
    }).then((order) => this.serializeOrder(order));
  }

  async deliver(tenantId: string, id: string, actorId: string) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.salesOrder.findFirst({
        where: { id, tenantId },
        include: { reservations: true, lines: true },
      });
      if (!order) throw new AppError("Sales order not found", 404);
      if (order.status === "cancelled") throw new AppError("Cancelled orders cannot be delivered", 409);
      if (order.deliveryStatus === "delivered") throw new AppError("Order is already delivered", 409);

      const reservations = order.reservations.filter((r) => r.status === "active" || r.status === "shortage");
      for (const reservation of reservations) {
        const remaining = reservation.quantity - reservation.consumed;
        if (remaining <= 0) continue;
        const item = await tx.inventoryItem.findFirst({ where: { id: reservation.inventoryItemId, tenantId } });
        if (!item) throw new AppError("Inventory item not found", 404);
        if (item.inStock < remaining) {
          throw new AppError(`Cannot deliver ${item.name}: stock is ${item.inStock}, need ${remaining}.`, 409);
        }
        const nextStock = item.inStock - remaining;
        const nextReserved = Math.max(0, item.reserved - remaining);
        await tx.inventoryItem.update({
          where: { id: item.id },
          data: { inStock: nextStock, reserved: nextReserved },
        });
        await tx.stockReservation.update({
          where: { id: reservation.id },
          data: { consumed: { increment: remaining }, status: "consumed" },
        });
        await tx.stockMovement.create({
          data: {
            tenantId,
            inventoryItemId: item.id,
            reservationId: reservation.id,
            type: "issue",
            quantity: -remaining,
            balanceAfter: nextStock,
            referenceType: "sales_order",
            referenceId: order.id,
            reason: `Delivery ${order.reference}`,
            actorId,
          },
        });
      }

      const unreservedParts = order.lines.filter(
        (line) => line.inventoryItemId && !reservations.some((r) => r.inventoryItemId === line.inventoryItemId),
      );
      for (const line of unreservedParts) {
        const qty = Math.ceil(Number(line.quantity));
        const item = await tx.inventoryItem.findFirst({ where: { id: line.inventoryItemId!, tenantId } });
        if (!item) continue;
        const available = Math.max(0, item.inStock - item.reserved);
        if (qty > available) {
          throw new AppError(`Not enough stock for ${item.name}. Available ${available}, need ${qty}.`, 409);
        }
        const nextStock = item.inStock - qty;
        await tx.inventoryItem.update({ where: { id: item.id }, data: { inStock: nextStock } });
        await tx.stockMovement.create({
          data: {
            tenantId,
            inventoryItemId: item.id,
            type: "issue",
            quantity: -qty,
            balanceAfter: nextStock,
            referenceType: "sales_order",
            referenceId: order.id,
            reason: `Delivery ${order.reference}`,
            actorId,
          },
        });
      }

      const updated = await tx.salesOrder.update({
        where: { id: order.id },
        data: {
          deliveryStatus: "delivered",
          deliveredAt: new Date(),
          status: order.status === "invoiced" ? "invoiced" : "delivered",
        },
        include: orderInclude,
      });
      return this.serializeOrder(updated);
    });
  }

  async createInvoice(tenantId: string, id: string, input?: { dueAt?: string; commissionRate?: number }) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.salesOrder.findFirst({
        where: { id, tenantId },
        include: { lines: true, invoices: true, estimate: true },
      });
      if (!order) throw new AppError("Sales order not found", 404);
      if (order.invoices.some((inv) => inv.status !== "closed")) {
        throw new AppError("An open invoice already exists for this sales order", 409);
      }

      const dueAt = input?.dueAt ? new Date(input.dueAt) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      const invoice = await tx.invoice.create({
        data: {
          tenantId,
          customerId: order.customerId,
          estimateId: order.estimateId,
          salesOrderId: order.id,
          reference: `INV-${Date.now().toString(36).toUpperCase()}`,
          customerName: order.customerName,
          jobRef: order.reference,
          amount: order.subtotal.minus(order.discount),
          tax: order.tax,
          total: order.total,
          balanceDue: order.total,
          currency: "INR",
          status: "sent",
          sentAt: new Date(),
          dueAt,
          lineItems: {
            create: order.lines.map((line) => ({
              catalogItemId: line.catalogItemId,
              type: line.type,
              description: line.description,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              taxRate: line.taxRate,
              discount: line.discount,
              lineTotal: line.lineTotal,
            })),
          },
        },
        include: { lineItems: true, payments: true },
      });

      await tx.salesOrder.update({
        where: { id: order.id },
        data: { status: "invoiced", paymentStatus: "unpaid" },
      });

      const rate = Number(input?.commissionRate ?? 0);
      if (rate > 0) {
        await tx.commission.create({
          data: {
            tenantId,
            invoiceId: invoice.id,
            salesOrderId: order.id,
            payeeName: order.salespersonName,
            basisAmount: order.total,
            rate,
            amount: money(order.total).mul(rate).div(100),
            status: "accrued",
          },
        });
      }

      return invoice;
    });
  }

  async getReports(tenantId: string) {
    const month = startOfMonth();
    const today = startOfDay();
    const [orders, invoices, lines] = await Promise.all([
      prisma.salesOrder.findMany({
        where: { tenantId, status: { not: "cancelled" } },
        include: { lines: true },
        orderBy: { orderedAt: "desc" },
      }),
      prisma.invoice.findMany({
        where: { tenantId, salesOrderId: { not: null } },
        select: {
          id: true,
          customerName: true,
          total: true,
          paidTotal: true,
          balanceDue: true,
          status: true,
          issuedAt: true,
        },
      }),
      prisma.salesOrderLine.findMany({
        where: { salesOrder: { tenantId, status: { not: "cancelled" } } },
        select: {
          type: true,
          description: true,
          quantity: true,
          lineTotal: true,
          salesOrder: { select: { salespersonName: true, customerName: true, orderedAt: true } },
        },
      }),
    ]);

    const daily = orders
      .filter((o) => o.orderedAt >= today)
      .reduce((sum, o) => sum + num(o.total), 0);
    const monthly = orders
      .filter((o) => o.orderedAt >= month)
      .reduce((sum, o) => sum + num(o.total), 0);

    const byKey = (key: (line: (typeof lines)[number]) => string) => {
      const map = new Map<string, { name: string; quantity: number; amount: number }>();
      for (const line of lines) {
        const name = key(line);
        const current = map.get(name) ?? { name, quantity: 0, amount: 0 };
        current.quantity += num(line.quantity);
        current.amount += num(line.lineTotal);
        map.set(name, current);
      }
      return [...map.values()].sort((a, b) => b.amount - a.amount);
    };

    const productWise = byKey((l) => l.description);
    const sparePartsSales = byKey((l) => (l.type === "part" ? l.description : "")).filter((row) => row.name);
    const equipmentSales = byKey((l) =>
      l.type === "service" || l.type === "labor" ? l.description : "",
    ).filter((row) => row.name);

    const invoiced = invoices.reduce((sum, inv) => sum + num(inv.total), 0);
    const collected = invoices.reduce((sum, inv) => sum + num(inv.paidTotal), 0);
    const outstandingTotal = invoices.reduce((sum, inv) => sum + num(inv.balanceDue), 0);

    return {
      dailySales: daily,
      monthlySales: monthly,
      invoiced,
      collected,
      outstandingTotal,
      productWise,
      sparePartsSales,
      equipmentSales,
      salespersonWise: byKey((l) => l.salesOrder.salespersonName || "Unassigned"),
      customerWise: byKey((l) => l.salesOrder.customerName),
      outstanding: invoices
        .filter((inv) => num(inv.balanceDue) > 0)
        .map((inv) => ({
          ...inv,
          total: num(inv.total),
          paidTotal: num(inv.paidTotal),
          balanceDue: num(inv.balanceDue),
        })),
      topSelling: productWise.slice(0, 10),
    };
  }

  private async resolveSaleLines(
    tx: Prisma.TransactionClient,
    tenantId: string,
    lines: Array<{
      inventoryItemId?: string | null;
      catalogItemId?: string | null;
      type?: string;
      description: string;
      sku?: string | null;
      quantity: number;
      unitPrice: number;
      discount?: number;
      taxRate?: number;
    }>,
  ) {
    if (!lines.length) throw new AppError("Add at least one sold item", 422);
    const resolved: Array<{
      inventoryItemId: string | null;
      catalogItemId: string | null;
      type: string;
      description: string;
      sku: string | null;
      quantity: number;
      unitPrice: Prisma.Decimal;
      discount: Prisma.Decimal;
      taxRate: Prisma.Decimal;
      lineTotal: Prisma.Decimal;
    }> = [];

    for (const line of lines) {
      let inventoryItemId = line.inventoryItemId ?? null;
      let catalogItemId = line.catalogItemId ?? null;
      let description = line.description.trim();
      let sku = line.sku?.trim() || null;
      let type = line.type?.trim() || (inventoryItemId ? "part" : catalogItemId ? "service" : "other");
      if (inventoryItemId) {
        const item = await tx.inventoryItem.findFirst({ where: { id: inventoryItemId, tenantId } });
        if (!item) throw new AppError(`Inventory item not found for ${description || "line"}`, 404);
        if (!description) description = item.name;
        if (!sku) sku = item.sku;
        if (!line.type) type = "part";
      }
      if (catalogItemId) {
        const catalog = await tx.serviceCatalogItem.findFirst({ where: { id: catalogItemId, tenantId } });
        if (!catalog) throw new AppError(`Service not found for ${description || "line"}`, 404);
        if (!description) description = catalog.name;
        if (!line.type) type = "service";
      }
      if (!description) throw new AppError("Each sold item needs a name", 422);
      const quantity = Number(line.quantity);
      const unitPrice = money(line.unitPrice);
      const discount = money(line.discount ?? 0);
      const taxRate = money(line.taxRate ?? 0);
      if (!(quantity > 0)) throw new AppError(`Quantity must be greater than 0 for ${description}`, 422);
      const net = unitPrice.mul(quantity).minus(discount);
      if (net.lt(0)) throw new AppError(`Discount cannot exceed the amount for ${description}`, 422);
      const taxAmt = net.mul(taxRate).div(100);
      resolved.push({
        inventoryItemId,
        catalogItemId,
        type,
        description,
        sku,
        quantity,
        unitPrice,
        discount,
        taxRate,
        lineTotal: net.plus(taxAmt).toDecimalPlaces(2),
      });
    }
    return resolved;
  }

  private totalsFromLines(
    lines: Array<{
      quantity: number;
      unitPrice: Prisma.Decimal;
      discount: Prisma.Decimal;
      taxRate: Prisma.Decimal;
    }>,
  ) {
    const subtotal = lines.reduce((sum, line) => sum.plus(line.unitPrice.mul(line.quantity)), money(0));
    const discount = lines.reduce((sum, line) => sum.plus(line.discount), money(0));
    const tax = lines.reduce((sum, line) => {
      const net = line.unitPrice.mul(line.quantity).minus(line.discount);
      return sum.plus(net.mul(line.taxRate).div(100));
    }, money(0));
    return {
      subtotal: subtotal.toDecimalPlaces(2),
      discount: discount.toDecimalPlaces(2),
      tax: tax.toDecimalPlaces(2),
      total: subtotal.minus(discount).plus(tax).toDecimalPlaces(2),
    };
  }

  private async assertStockForLines(
    tx: Prisma.TransactionClient,
    tenantId: string,
    lines: Array<{ inventoryItemId: string | null; description: string; quantity: number }>,
  ) {
    const needed = new Map<string, { name: string; qty: number }>();
    for (const line of lines) {
      if (!line.inventoryItemId) continue;
      const qty = Math.ceil(Number(line.quantity));
      const current = needed.get(line.inventoryItemId);
      if (current) current.qty += qty;
      else needed.set(line.inventoryItemId, { name: line.description, qty });
    }
    for (const [itemId, row] of needed) {
      const item = await tx.inventoryItem.findFirst({ where: { id: itemId, tenantId } });
      if (!item) throw new AppError(`Inventory item not found for ${row.name}`, 404);
      const available = Math.max(0, item.inStock - item.reserved);
      if (row.qty > available) {
        throw new AppError(
          `Not enough stock for ${item.name} (${item.sku}). Available ${available}, requested ${row.qty}.`,
          409,
        );
      }
    }
  }

  private serializeOrder(order: {
    id: string;
    estimateId: string | null;
    customerId: string;
    salespersonId: string | null;
    branchId: string | null;
    reference: string;
    customerName: string;
    salespersonName: string;
    status: string;
    deliveryStatus: string;
    paymentStatus: string;
    subtotal: Prisma.Decimal;
    discount: Prisma.Decimal;
    tax: Prisma.Decimal;
    total: Prisma.Decimal;
    notes: string | null;
    orderedAt: Date;
    deliveredAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    lines?: Array<Record<string, unknown>>;
    invoices?: Array<{
      id: string;
      reference: string;
      status: string;
      total: Prisma.Decimal;
      paidTotal: Prisma.Decimal;
      balanceDue: Prisma.Decimal;
    }>;
    estimate?: { id: string; reference: string; status: string } | null;
  }) {
    const invoices = order.invoices ?? [];
    const billed = invoices.reduce((sum, inv) => sum + num(inv.total), 0);
    const paid = invoices.reduce((sum, inv) => sum + num(inv.paidTotal), 0);
    const due = invoices.reduce((sum, inv) => sum + num(inv.balanceDue), 0);
    return {
      ...order,
      subtotal: num(order.subtotal),
      discount: num(order.discount),
      tax: num(order.tax),
      total: num(order.total),
      paymentStatus: billed ? paymentLabel(due, billed) : order.paymentStatus,
      paidTotal: paid,
      balanceDue: due,
      invoices: invoices.map((inv) => ({
        ...inv,
        total: num(inv.total),
        paidTotal: num(inv.paidTotal),
        balanceDue: num(inv.balanceDue),
      })),
      lines: (order.lines ?? []).map((line) => ({
        ...line,
        quantity: num(line.quantity),
        unitPrice: num(line.unitPrice),
        discount: num(line.discount),
        taxRate: num(line.taxRate),
        lineTotal: num(line.lineTotal),
      })),
    };
  }
}

export const salesService = new SalesService();
