import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Pencil, Plus, Printer, Trash2, X } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { ProfessionalDocument } from "@/components/shared/ProfessionalDocument";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoRow, downloadInvoicePdf, normalizeInvoiceLineDescription } from "@/components/billing/billing-ui";
import { ApiError, api, type BackendInvoice, type BillingJobContext, type InvoiceLineInput } from "@/lib/api";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/fixedOptions";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { toast } from "@/lib/toast";

const newLine = (): InvoiceLineInput => ({
  type: "adjustment",
  description: "",
  quantity: 1,
  unitPrice: 0,
  taxRate: 0,
  discount: 0,
});

function toEditableLines(invoice: BackendInvoice): InvoiceLineInput[] {
  return (invoice.lineItems ?? []).map((line) => ({
    id: line.id,
    type: line.type,
    description: normalizeInvoiceLineDescription(line.description, invoice.jobRef),
    quantity: Number(line.quantity),
    unitPrice: Number(line.unitPrice),
    taxRate: Number(line.taxRate),
    discount: Number(line.discount),
  }));
}

function toPreviewLines(lines: InvoiceLineInput[], jobRef?: string | null) {
  return lines.map((line, index) => ({
    id: line.id ?? `draft-${index}`,
    description: normalizeInvoiceLineDescription(line.description, jobRef),
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    discount: line.discount ?? 0,
    taxRate: line.taxRate ?? 0,
  }));
}

export default function BillingInvoiceDetail() {
  const { invoiceId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [invoice, setInvoice] = useState<BackendInvoice | null>(null);
  const [context, setContext] = useState<BillingJobContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDueAt, setEditDueAt] = useState("");
  const [editLines, setEditLines] = useState<InvoiceLineInput[]>([]);
  const [payment, setPayment] = useState({ amount: 0, method: "bank_transfer", methodOther: "", reference: "", note: "" });

  const load = useCallback(async () => {
    if (!invoiceId) return;
    setLoading(true);
    try {
      const inv = await api.getInvoice(invoiceId);
      setInvoice(inv);
      if (inv.jobId) {
        setContext(await api.getBillingJobContext(inv.jobId));
      }
    } catch (error) {
      toast({
        title: "Unable to load invoice",
        description: error instanceof ApiError ? error.message : "Request failed",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (invoice) {
      setPayment((prev) => ({
        ...prev,
        amount: Number(invoice.balanceDue ?? invoice.total),
      }));
    }
  }, [invoice?.id, invoice?.balanceDue, invoice?.total]);

  const canEdit = Boolean(
    invoice
    && ["draft", "pendingApproval"].includes(invoice.status)
    && !(invoice.payments?.length),
  );

  const startEditing = () => {
    if (!invoice) return;
    const editable = toEditableLines(invoice);
    setEditDueAt(invoice.dueAt.slice(0, 10));
    setEditLines(editable.length ? editable : [newLine()]);
    setEditing(true);
  };

  useEffect(() => {
    if (!invoice || loading || editing) return;

    const next = new URLSearchParams(searchParams);
    let changed = false;

    if (next.get("edit") === "1") {
      next.delete("edit");
      changed = true;
      if (
        ["draft", "pendingApproval"].includes(invoice.status)
        && !(invoice.payments?.length)
      ) {
        startEditing();
      }
    }

    if (next.get("print") === "1") {
      next.delete("print");
      changed = true;
      window.setTimeout(() => window.print(), 300);
    }

    if (changed) setSearchParams(next, { replace: true });
  }, [invoice, loading, editing, searchParams, setSearchParams]);

  const cancelEditing = () => {
    setEditing(false);
    setEditLines([]);
    setEditDueAt("");
  };

  const updateLine = (index: number, patch: Partial<InvoiceLineInput>) => {
    setEditLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const saveEdits = async () => {
    if (!invoice) return;
    if (!editDueAt) {
      toast({ title: "Due date required", variant: "destructive" });
      return;
    }
    if (editLines.some((line) => !line.description.trim() || line.quantity <= 0)) {
      toast({
        title: "Invalid line items",
        description: "Each line needs a description and quantity greater than zero.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const updated = await api.updateInvoice(invoiceId, {
        dueAt: new Date(editDueAt).toISOString(),
        lineItems: editLines.map((line) => ({
          id: line.id,
          type: line.type,
          description: line.description.trim(),
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          taxRate: line.taxRate ?? 0,
          discount: line.discount ?? 0,
        })),
      });
      setInvoice(updated);
      setEditing(false);
      toast({ title: "Invoice updated" });
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof ApiError ? error.message : "Request failed",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const lines = useMemo(
    () => (editing
      ? toPreviewLines(editLines, invoice?.jobRef)
      : invoice?.lineItems?.map((line) => ({
          id: line.id,
          description: normalizeInvoiceLineDescription(line.description, invoice.jobRef),
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
          discount: Number(line.discount),
          taxRate: Number(line.taxRate),
        })) ?? []),
    [editing, editLines, invoice],
  );

  const editPreviewTotal = useMemo(() => {
    return lines.reduce((sum, line) => {
      const net = line.quantity * line.unitPrice - (line.discount ?? 0);
      return sum + net + net * ((line.taxRate ?? 0) / 100);
    }, 0);
  }, [lines]);

  const printInvoice = () => {
    window.print();
  };

  const downloadPdf = async () => {
    setSaving(true);
    try {
      await downloadInvoicePdf(invoiceId);
      toast({ title: "PDF ready", description: "Invoice PDF opened in a new tab." });
    } catch (error) {
      toast.apiError(error, { fallback: "Request failed" });
    } finally { setSaving(false); }
  };

  const submitApproval = async () => {
    setSaving(true);
    try {
      setInvoice(await api.submitInvoiceApproval(invoiceId));
      toast({ title: "Submitted for approval" });
    } catch (error) {
      toast.apiError(error, { fallback: "Request failed" });
    } finally { setSaving(false); }
  };

  const approveInvoice = async () => {
    setSaving(true);
    try {
      setInvoice(await api.approveBillingInvoice(invoiceId));
      toast({ title: "Invoice approved" });
    } catch (error) {
      toast.apiError(error, { fallback: "Request failed" });
    } finally { setSaving(false); }
  };

  const markSent = async () => {
    setSaving(true);
    try {
      setInvoice(await api.markBillingInvoiceSent(invoiceId));
      toast({ title: "Invoice marked as sent" });
    } catch (error) {
      toast.apiError(error, { fallback: "Request failed" });
    } finally { setSaving(false); }
  };

  const recordPayment = async () => {
    if (!invoice) return;
    if (payment.method === "other" && !payment.methodOther.trim()) {
      toast({ title: "Method required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const method = payment.method === "other" ? payment.methodOther.trim() : payment.method;
      setInvoice(await api.recordInvoicePayment(invoiceId, {
        amount: payment.amount,
        method,
        reference: payment.reference,
        note: payment.note,
      }));
      setPayment({ amount: 0, method: "bank_transfer", methodOther: "", reference: "", note: "" });
      toast({ title: "Payment recorded" });
    } catch (error) {
      toast.apiError(error, { fallback: "Request failed" });
    } finally { setSaving(false); }
  };

  return (
    <RoleGuard roles={["admin", "billing"]}>
      <div className="space-y-6">
        <div className="no-print flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/app/billing"><ArrowLeft className="mr-1 h-4 w-4" /> Back to queue</Link>
          </Button>
          {context?.job.id ? (
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/app/billing/jobs/${context.job.id}`}>Service review</Link>
            </Button>
          ) : null}
        </div>

        <PageHeader
          title={invoice ? `Invoice ${invoice.reference}` : "Invoice"}
          description={invoice ? `${invoice.customerName} · Job ${invoice.jobRef}` : "Loading…"}
          actions={
            invoice ? (
              <>
                {canEdit && !editing ? (
                  <Button variant="outline" onClick={startEditing}>
                    <Pencil className="mr-2 h-4 w-4" /> Edit invoice
                  </Button>
                ) : null}
                {editing ? (
                  <>
                    <Button variant="outline" onClick={cancelEditing} disabled={saving}>
                      <X className="mr-2 h-4 w-4" /> Cancel
                    </Button>
                    <Button variant="brand" onClick={saveEdits} disabled={saving}>
                      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Save changes
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" onClick={printInvoice}><Printer className="mr-2 h-4 w-4" /> Print</Button>
                    <Button variant="brand" onClick={downloadPdf} disabled={saving}>Download PDF</Button>
                  </>
                )}
              </>
            ) : null
          }
        />

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : !invoice ? (
          <p className="text-center text-muted-foreground">Invoice not found.</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
            <div className="no-print space-y-4">
              {editing ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Edit invoice</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-2">
                      <Label>Payment due date</Label>
                      <Input type="date" value={editDueAt} onChange={(e) => setEditDueAt(e.target.value)} />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Line items</Label>
                        <Button type="button" variant="outline" size="sm" onClick={() => setEditLines((prev) => [...prev, newLine()])}>
                          <Plus className="mr-1 h-3.5 w-3.5" /> Add line
                        </Button>
                      </div>
                      {editLines.map((line, index) => (
                        <div key={line.id ?? `new-${index}`} className="space-y-2 rounded-lg border p-3">
                          <div className="flex items-start justify-between gap-2">
                            <Input
                              value={line.description}
                              onChange={(e) => updateLine(index, { description: e.target.value })}
                              placeholder="Description"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="shrink-0"
                              disabled={editLines.length <= 1}
                              onClick={() => setEditLines((prev) => prev.filter((_, i) => i !== index))}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="grid gap-1">
                              <Label className="text-xs">Qty</Label>
                              <Input
                                type="number"
                                min={0.001}
                                step="any"
                                value={line.quantity}
                                onChange={(e) => updateLine(index, { quantity: Number(e.target.value) })}
                              />
                            </div>
                            <div className="grid gap-1">
                              <Label className="text-xs">Unit price</Label>
                              <Input
                                type="number"
                                min={0}
                                step="any"
                                value={line.unitPrice}
                                onChange={(e) => updateLine(index, { unitPrice: Number(e.target.value) })}
                              />
                            </div>
                            <div className="grid gap-1">
                              <Label className="text-xs">Discount</Label>
                              <Input
                                type="number"
                                min={0}
                                step="any"
                                value={line.discount ?? 0}
                                onChange={(e) => updateLine(index, { discount: Number(e.target.value) })}
                              />
                            </div>
                            <div className="grid gap-1">
                              <Label className="text-xs">Tax %</Label>
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                step="any"
                                value={line.taxRate ?? 0}
                                onChange={(e) => updateLine(index, { taxRate: Number(e.target.value) })}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <InfoRow label="Preview total" value={formatCurrency(editPreviewTotal)} />
                    <p className="text-xs text-muted-foreground">
                      Totals are recalculated on the server when you save. Only draft and pending-approval invoices can be edited.
                    </p>
                  </CardContent>
                </Card>
              ) : null}

              <Card>
                <CardHeader><CardTitle className="text-base">Invoice actions</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <InfoRow label="Status" value={<StatusBadge status={invoice.status} />} />
                  <InfoRow label="Total" value={formatCurrency(editing ? editPreviewTotal : invoice.total)} />
                  <InfoRow label="Paid" value={formatCurrency(invoice.paidTotal ?? 0)} />
                  <InfoRow label="Balance" value={formatCurrency(editing ? editPreviewTotal : (invoice.balanceDue ?? invoice.total))} />
                  <div className="flex flex-col gap-2 pt-2">
                    {!editing && invoice.status === "draft" ? (
                      <Button variant="outline" onClick={submitApproval} disabled={saving}>Submit for approval</Button>
                    ) : null}
                    {!editing && invoice.status === "pendingApproval" ? (
                      <Button onClick={approveInvoice} disabled={saving}>Approve invoice</Button>
                    ) : null}
                    {!editing && invoice.status === "approved" ? (
                      <Button onClick={markSent} disabled={saving}>Mark sent</Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              {["sent", "overdue"].includes(invoice.status) && Number(invoice.balanceDue ?? invoice.total) > 0 ? (
                <Card>
                  <CardHeader><CardTitle className="text-base">Record payment</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid gap-2">
                      <Label>Amount</Label>
                      <Input
                        type="number"
                        min={0.01}
                        max={Number(invoice.balanceDue ?? invoice.total)}
                        value={payment.amount}
                        onChange={(e) => setPayment({ ...payment, amount: Number(e.target.value) })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Method</Label>
                      <Select value={payment.method} onValueChange={(method) => setPayment({ ...payment, method, methodOther: method === "other" ? payment.methodOther : "" })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHOD_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {payment.method === "other" ? (
                      <div className="grid gap-2">
                        <Label>Specify method</Label>
                        <Input value={payment.methodOther} onChange={(e) => setPayment({ ...payment, methodOther: e.target.value })} />
                      </div>
                    ) : null}
                    <div className="grid gap-2">
                      <Label>Reference</Label>
                      <Input value={payment.reference} onChange={(e) => setPayment({ ...payment, reference: e.target.value })} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Note</Label>
                      <Textarea value={payment.note} onChange={(e) => setPayment({ ...payment, note: e.target.value })} />
                    </div>
                    <Button className="w-full" onClick={recordPayment} disabled={saving || payment.amount <= 0}>Record payment</Button>
                  </CardContent>
                </Card>
              ) : null}

              <Card>
                <CardHeader><CardTitle className="text-base">Payment history</CardTitle></CardHeader>
                <CardContent>
                  {(invoice.payments ?? []).length ? (
                    invoice.payments!.map((p) => (
                      <div key={p.id} className="mb-2 flex justify-between rounded border p-2 text-sm">
                        <div>
                          <p className="font-medium capitalize">{p.method}</p>
                          <p className="text-xs text-muted-foreground">{formatDateTime(p.paidAt)}</p>
                        </div>
                        <span className="font-semibold">{formatCurrency(p.amount)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No payments yet.</p>
                  )}
                </CardContent>
              </Card>

              {context ? (
                <Card>
                  <CardHeader><CardTitle className="text-base">Service links</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <InfoRow label="Service request" value={context.job.requestRef} />
                    <InfoRow label="Job" value={context.job.reference} />
                    <InfoRow label="Engineer" value={context.job.engineer} />
                  </CardContent>
                </Card>
              ) : null}
            </div>

            <Card className="print-area overflow-hidden print:overflow-visible print:shadow-none">
              <CardContent className="p-0">
                {lines.length ? (
                  <ProfessionalDocument
                    kind="Invoice"
                    reference={invoice.reference}
                    customerName={invoice.customerName}
                    issueDate={invoice.issuedAt}
                    validOrDueLabel="Due date"
                    validOrDueDate={editing ? editDueAt : invoice.dueAt}
                    lines={lines}
                    notes={context?.job.serviceRequest?.description ? `Service: ${context.job.serviceRequest.description}` : undefined}
                  />
                ) : (
                  <p className="p-10 text-center text-muted-foreground">No line items on this invoice.</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
