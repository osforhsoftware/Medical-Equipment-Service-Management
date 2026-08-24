import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Printer, Truck } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { ApiError, api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";
import { useState } from "react";

export default function SalesOrderDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const canDeliver = hasRole(["admin", "inventory", "coordinator"]);
  const canBill = hasRole(["admin", "billing"]);
  const [working, setWorking] = useState(false);

  const orderQuery = useQuery({
    queryKey: ["sales", "orders", id],
    queryFn: () => api.getSalesOrder(id),
    enabled: Boolean(id),
  });
  const order = orderQuery.data;
  const invoice = order?.invoices?.[0];

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
      toast({ title: "Invoice created", description: created.reference });
      await refresh();
      navigate(`/app/billing/invoices/${created.id}`);
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to create invoice" });
    } finally {
      setWorking(false);
    }
  };

  return (
    <RoleGuard roles={["admin", "coordinator", "estimator", "billing", "inventory"]}>
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
              description={`${order.customerName} · ${order.salespersonName} · ${formatDate(order.orderedAt)}`}
              actions={
                <div className="flex flex-wrap gap-2">
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
                      Create invoice
                    </Button>
                  ) : null}
                  {invoice ? (
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
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Line items</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                      <th className="py-2">Item</th>
                      <th className="py-2">Type</th>
                      <th className="py-2 text-right">Qty</th>
                      <th className="py-2 text-right">Price</th>
                      <th className="py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.lines.map((line) => (
                      <tr key={line.id} className="border-b last:border-0">
                        <td className="py-2">
                          <p className="font-medium">{line.description}</p>
                          {line.sku ? <p className="font-mono text-xs text-muted-foreground">{line.sku}</p> : null}
                        </td>
                        <td className="py-2 capitalize">{line.type}</td>
                        <td className="py-2 text-right">{line.quantity}</td>
                        <td className="py-2 text-right">{formatCurrency(line.unitPrice)}</td>
                        <td className="py-2 text-right">{formatCurrency(line.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <dl className="mt-4 grid gap-1 text-sm sm:max-w-xs sm:ml-auto">
                  <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>{formatCurrency(order.subtotal)}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Discount</dt><dd>{formatCurrency(order.discount)}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Tax</dt><dd>{formatCurrency(order.tax)}</dd></div>
                  <div className="flex justify-between font-semibold"><dt>Grand total</dt><dd>{formatCurrency(order.total)}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Paid</dt><dd>{formatCurrency(order.paidTotal ?? 0)}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Balance</dt><dd>{formatCurrency(order.balanceDue ?? 0)}</dd></div>
                </dl>
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground">
              After delivery, register sold equipment under Customers → Equipment if this was a machine sale. Payments are recorded on the invoice in Billing (Cash, Bank, UPI, Card, Other).
            </p>
          </>
        ) : null}
      </div>
    </RoleGuard>
  );
}
