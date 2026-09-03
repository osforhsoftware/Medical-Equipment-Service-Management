import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Pencil, Printer, Truck } from "lucide-react";
import { MesmsLogo } from "@/components/shared/MesmsLogo";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { SaleFormDialog } from "@/components/sales/SaleFormDialog";
import { downloadInvoicePdf } from "@/components/billing/billing-ui";
import { SALES_BILL_ROLES, SALES_DESK_ROLES, SALES_WRITE_ROLES } from "@/config/roles";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { ApiError, api } from "@/lib/api";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/fixedOptions";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";
import { useState } from "react";

export default function SalesOrderDetail() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const { settings } = useSettings();
  const canDeliver = hasRole(["admin", "inventory", "coordinator"]);
  const canBill = hasRole(SALES_BILL_ROLES);
  const canEdit = hasRole(SALES_WRITE_ROLES);
  const [working, setWorking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [payment, setPayment] = useState({ amount: "", method: "upi", reference: "", note: "" });

  const orderQuery = useQuery({
    queryKey: ["sales", "orders", id],
    queryFn: () => api.getSalesOrder(id),
    enabled: Boolean(id),
  });
  const order = orderQuery.data;
  const invoice = order?.invoices?.[0];
  const locked = order?.deliveryStatus === "delivered" || Boolean(invoice);
  const balanceDue = invoice?.balanceDue ?? order?.balanceDue ?? 0;

  const customerQuery = useQuery({
    queryKey: ["customers", order?.customerId],
    queryFn: () => api.getCustomer(order!.customerId),
    enabled: Boolean(order?.customerId),
  });
  const customer = customerQuery.data;
  const customerAddress = customer
    ? [customer.address, customer.city, customer.country].filter(Boolean).join(", ")
    : null;

  const company = settings?.companyName ?? "MESMS";
  const companyLines = [
    settings?.companyAddress,
    settings?.companyPhone ? `Mob: ${settings.companyPhone}` : null,
    settings?.supportEmail,
    settings?.companyWebsite,
  ].filter(Boolean) as string[];

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["sales"] });
    await orderQuery.refetch();
  };

  const deliver = async () => {
    if (!order) return;
    setWorking(true);
    try {
      await api.deliverSalesOrder(order.id);
      toast({ title: "Delivered", description: "Stock was deducted from inventory." });
      await refresh();
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to deliver order" });
    } finally {
      setWorking(false);
    }
  };

  const invoiceOrder = async () => {
    if (!order) return;
    setWorking(true);
    try {
      const created = await api.invoiceSalesOrder(order.id);
      toast({ title: "Sale invoice created", description: created.reference });
      await refresh();
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to create invoice" });
    } finally {
      setWorking(false);
    }
  };

  const printInvoice = async () => {
    if (!invoice) return;
    setPrinting(true);
    try {
      await downloadInvoicePdf(invoice.id);
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to print invoice" });
    } finally {
      setPrinting(false);
    }
  };

  const recordPayment = async () => {
    if (!invoice) return;
    const amount = Number(payment.amount);
    if (!(amount > 0)) {
      toast({ title: "Enter a payment amount", variant: "destructive" });
      return;
    }
    if (amount > balanceDue + 0.009) {
      toast({ title: "Payment exceeds balance due", variant: "destructive" });
      return;
    }
    setWorking(true);
    try {
      await api.recordInvoicePayment(invoice.id, {
        amount,
        method: payment.method,
        reference: payment.reference.trim() || undefined,
        note: payment.note.trim() || undefined,
      });
      toast.success("Payment recorded", { description: formatCurrency(amount) });
      setPayment({ amount: "", method: payment.method, reference: "", note: "" });
      await refresh();
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to record payment" });
    } finally {
      setWorking(false);
    }
  };

  return (
    <RoleGuard roles={SALES_DESK_ROLES}>
      <div className="space-y-6">
        <Button variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground" asChild>
          <Link to="/app/sales">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to Sales
          </Link>
        </Button>

        {orderQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading sales order…
          </div>
        ) : orderQuery.isError ? (
          <p className="text-sm text-destructive">
            {orderQuery.error instanceof ApiError ? orderQuery.error.message : "Unable to load sales order"}
          </p>
        ) : order ? (
          <>
            <PageHeader
              title={order.reference}
              description="Sale order · customer billing stays on this desk"
              actions={
                <div className="flex flex-wrap gap-2">
                  {canEdit && !locked && !editing ? (
                    <Button variant="outline" onClick={() => setEditing(true)}>
                      <Pencil className="mr-1 h-4 w-4" /> Edit sold items
                    </Button>
                  ) : null}
                  {order.estimateId ? (
                    <Button variant="outline" asChild>
                      <Link to={`/app/estimates/${order.estimateId}/preview`}>
                        <Printer className="mr-1 h-4 w-4" /> Print quotation
                      </Link>
                    </Button>
                  ) : null}
                  {canDeliver && order.deliveryStatus !== "delivered" ? (
                    <Button variant="outline" disabled={working} onClick={() => void deliver()}>
                      <Truck className="mr-1 h-4 w-4" /> Mark delivered
                    </Button>
                  ) : null}
                  {canBill && !invoice ? (
                    <Button variant="brand" disabled={working} onClick={() => void invoiceOrder()}>
                      Create sale invoice
                    </Button>
                  ) : null}
                  {invoice ? (
                    <Button variant="outline" disabled={printing} onClick={() => void printInvoice()}>
                      {printing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Printer className="mr-1 h-4 w-4" />}
                      Print invoice
                    </Button>
                  ) : null}
                  {invoice && hasRole(["admin", "billing"]) ? (
                    <Button variant="brand" asChild>
                      <Link to={`/app/billing/invoices/${invoice.id}`}>Open invoice</Link>
                    </Button>
                  ) : null}
                </div>
              }
            />

            <div className="flex flex-wrap gap-2">
              <StatusBadge status={order.status} />
              <StatusBadge status={order.deliveryStatus} />
              <StatusBadge status={order.paymentStatus} />
              {invoice ? <StatusBadge status={invoice.status} /> : null}
            </div>

            {canEdit && !locked ? (
              <SaleFormDialog
                open={editing}
                onOpenChange={setEditing}
                mode="edit"
                initial={order}
                onSaved={async () => {
                  setEditing(false);
                  await refresh();
                }}
              />
            ) : null}

            <Card className="overflow-hidden shadow-card">
              <CardContent className="space-y-0 p-0">
                {/* Document header */}
                <div className="grid gap-6 border-b border-border px-6 py-6 sm:grid-cols-[1.2fr_0.8fr] sm:px-8">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/40">
                      {settings?.logoUrl ? (
                        <img src={settings.logoUrl} alt="" className="h-full w-full object-contain" />
                      ) : (
                        <MesmsLogo size="md" className="h-8 max-w-[2.5rem]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold uppercase tracking-wide text-foreground">{company}</p>
                      {companyLines.map((line) => (
                        <p key={line} className="text-xs text-muted-foreground">
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-2xl font-bold uppercase tracking-wide text-foreground">Sale order</p>
                    <dl className="mt-3 space-y-1 text-sm sm:ml-auto sm:max-w-[14rem]">
                      <div className="flex justify-between gap-4 sm:justify-end">
                        <dt className="font-medium text-foreground">Order No</dt>
                        <dd className="font-mono text-muted-foreground">{order.reference}</dd>
                      </div>
                      <div className="flex justify-between gap-4 sm:justify-end">
                        <dt className="font-medium text-foreground">Date</dt>
                        <dd className="text-muted-foreground">{formatDate(order.orderedAt)}</dd>
                      </div>
                      {invoice ? (
                        <div className="flex justify-between gap-4 sm:justify-end">
                          <dt className="font-medium text-foreground">Invoice</dt>
                          <dd className="font-mono text-muted-foreground">{invoice.reference}</dd>
                        </div>
                      ) : null}
                    </dl>
                  </div>
                </div>

                {/* Bill to | Sale details */}
                <div className="grid gap-0 border-b border-border sm:grid-cols-2">
                  <div className="px-6 py-5 sm:border-r sm:border-border sm:px-8">
                    <p className="text-xs font-bold uppercase tracking-wide text-foreground">Bill to</p>
                    <p className="mt-2 text-sm font-semibold text-foreground">{order.customerName}</p>
                    {customerAddress ? (
                      <p className="mt-1 text-sm text-muted-foreground">{customerAddress}</p>
                    ) : null}
                    {customer?.phone ? (
                      <p className="text-sm text-muted-foreground">{customer.phone}</p>
                    ) : null}
                    {customer?.email ? (
                      <p className="text-sm text-muted-foreground">{customer.email}</p>
                    ) : null}
                  </div>
                  <div className="border-t border-border px-6 py-5 sm:border-t-0 sm:px-8">
                    <p className="text-xs font-bold uppercase tracking-wide text-foreground">Sale details</p>
                    <dl className="mt-3 space-y-2 text-sm">
                      <div className="grid grid-cols-[6.5rem_1fr] gap-2">
                        <dt className="font-medium text-foreground">Salesperson</dt>
                        <dd className="text-muted-foreground">{order.salespersonName}</dd>
                      </div>
                      <div className="grid grid-cols-[6.5rem_1fr] gap-2">
                        <dt className="font-medium text-foreground">Delivery</dt>
                        <dd className="capitalize text-muted-foreground">{order.deliveryStatus}</dd>
                      </div>
                      <div className="grid grid-cols-[6.5rem_1fr] gap-2">
                        <dt className="font-medium text-foreground">Payment</dt>
                        <dd className="capitalize text-muted-foreground">{order.paymentStatus}</dd>
                      </div>
                      {order.deliveredAt ? (
                        <div className="grid grid-cols-[6.5rem_1fr] gap-2">
                          <dt className="font-medium text-foreground">Delivered</dt>
                          <dd className="text-muted-foreground">{formatDate(order.deliveredAt)}</dd>
                        </div>
                      ) : null}
                      {order.notes ? (
                        <div className="grid grid-cols-[6.5rem_1fr] gap-2">
                          <dt className="font-medium text-foreground">Notes</dt>
                          <dd className="text-muted-foreground whitespace-pre-line">{order.notes}</dd>
                        </div>
                      ) : null}
                    </dl>
                  </div>
                </div>

                {/* Line items */}
                <div className="px-6 py-6 sm:px-8">
                  <p className="mb-4 text-xs font-bold uppercase tracking-wide text-foreground">Sold items</p>
                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full min-w-[36rem] text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30 text-left">
                          <th className="w-16 px-3 py-2.5 text-center text-xs font-semibold text-foreground">Sl. No.</th>
                          <th className="px-3 py-2.5 text-xs font-semibold text-foreground">Description</th>
                          <th className="w-24 px-3 py-2.5 text-xs font-semibold text-foreground">Type</th>
                          <th className="w-28 px-3 py-2.5 text-right text-xs font-semibold text-foreground">Price</th>
                          <th className="w-20 px-3 py-2.5 text-center text-xs font-semibold text-foreground">Qty</th>
                          <th className="w-28 px-3 py-2.5 text-right text-xs font-semibold text-foreground">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.lines.map((line, index) => (
                          <tr key={line.id} className="border-b border-border last:border-0">
                            <td className="px-3 py-3 text-center text-muted-foreground">{index + 1}</td>
                            <td className="px-3 py-3">
                              <p className="font-medium text-foreground">{line.description}</p>
                              {line.sku ? (
                                <p className="font-mono text-xs text-muted-foreground">{line.sku}</p>
                              ) : null}
                            </td>
                            <td className="px-3 py-3 capitalize text-muted-foreground">{line.type}</td>
                            <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(line.unitPrice)}</td>
                            <td className="px-3 py-3 text-center tabular-nums">{line.quantity}</td>
                            <td className="px-3 py-3 text-right font-medium tabular-nums">
                              {formatCurrency(line.lineTotal)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-5 flex justify-end">
                    <dl className="w-full max-w-[16rem] rounded-md border border-border px-4 py-3 text-sm">
                      <div className="flex justify-between gap-6 py-1">
                        <dt className="text-foreground">Subtotal</dt>
                        <dd className="tabular-nums">{formatCurrency(order.subtotal)}</dd>
                      </div>
                      <div className="flex justify-between gap-6 py-1">
                        <dt className="text-foreground">Discount</dt>
                        <dd className="tabular-nums">{formatCurrency(order.discount)}</dd>
                      </div>
                      <div className="flex justify-between gap-6 py-1">
                        <dt className="text-foreground">Tax</dt>
                        <dd className="tabular-nums">{formatCurrency(order.tax)}</dd>
                      </div>
                      <div className="mt-1 flex justify-between gap-6 border-t border-border pt-2 font-semibold">
                        <dt>Grand total</dt>
                        <dd className="text-base tabular-nums">{formatCurrency(order.total)}</dd>
                      </div>
                      <div className="flex justify-between gap-6 py-1 text-muted-foreground">
                        <dt>Paid</dt>
                        <dd className="tabular-nums">{formatCurrency(order.paidTotal ?? 0)}</dd>
                      </div>
                      <div className="flex justify-between gap-6 py-1 text-muted-foreground">
                        <dt>Balance</dt>
                        <dd className="tabular-nums">{formatCurrency(order.balanceDue ?? 0)}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </CardContent>
            </Card>

            {invoice ? (
              <Card className="shadow-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Customer billing</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/20 px-4 py-3 text-sm">
                    <div>
                      <p className="font-mono font-semibold text-foreground">{invoice.reference}</p>
                      <p className="text-xs text-muted-foreground">Sale invoice · separate from service-ticket billing</p>
                    </div>
                    <p className="text-base font-semibold tabular-nums">{formatCurrency(balanceDue)} due</p>
                  </div>
                  {canBill && balanceDue > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="grid gap-1">
                        <Label htmlFor="sale-pay-amount">Amount</Label>
                        <Input
                          id="sale-pay-amount"
                          type="number"
                          min={0}
                          step="0.01"
                          value={payment.amount}
                          onChange={(e) => setPayment((prev) => ({ ...prev, amount: e.target.value }))}
                          placeholder={String(balanceDue)}
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label>Method</Label>
                        <Select
                          value={payment.method}
                          onValueChange={(method) => setPayment((prev) => ({ ...prev, method }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PAYMENT_METHOD_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-1">
                        <Label htmlFor="sale-pay-ref">Reference</Label>
                        <Input
                          id="sale-pay-ref"
                          value={payment.reference}
                          onChange={(e) => setPayment((prev) => ({ ...prev, reference: e.target.value }))}
                          placeholder="UPI / cheque / txn id"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button variant="brand" className="w-full" disabled={working} onClick={() => void recordPayment()}>
                          {working ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                          Record payment
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {balanceDue <= 0
                        ? "This sale is paid in full."
                        : "You can view this bill. Recording payment needs sale billing permission."}
                    </p>
                  )}
                </CardContent>
              </Card>
            ) : null}

            <p className="text-xs text-muted-foreground">
              Sale billing lives on this order. Service-ticket estimates and job invoices stay under Estimates and Billing.
            </p>
          </>
        ) : null}
      </div>
    </RoleGuard>
  );
}
