import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { ArrowLeft, Loader2, Pencil, Printer, X } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { FormFieldError } from "@/components/shared/FormFieldError";
import { RequiredMark } from "@/components/shared/RequiredMark";
import { useFormValidation } from "@/hooks/useFormValidation";
import { fieldAria, fieldErrorClass, fieldRules, focusFirstInvalidField, type FieldErrors } from "@/lib/formValidation";
import { PageHeader } from "@/components/shared/PageHeader";
import { ProfessionalDocument } from "@/components/shared/ProfessionalDocument";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { SERVICE_BILLING_ROLES } from "@/config/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoRow, ChargeBreakdown, downloadInvoicePdf, normalizeInvoiceLineDescription } from "@/components/billing/billing-ui";
import { InvoiceLineEditor, newBillingLine } from "@/components/billing/InvoiceLineEditor";
import { ApiError, api, type BackendCatalogItem, type BackendInventoryItem, type BackendInvoice, type BillingJobContext, type InvoiceLineInput } from "@/lib/api";
import { summarizeChargeGroups } from "@/lib/billingCharges";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/fixedOptions";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { toast } from "@/lib/toast";

const newLine = (): InvoiceLineInput => newBillingLine("product");

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
    type: line.type,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    discount: line.discount ?? 0,
    taxRate: line.taxRate ?? 0,
  }));
}

type EditInvoiceValues = { dueAt: string; lines: InvoiceLineInput[] };

function validateEditInvoice(values: EditInvoiceValues): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.dueAt.trim()) {
    errors.dueAt = "Due date is required.";
  }
  values.lines.forEach((line, index) => {
    if (!line.description.trim()) {
      errors[`line_${index}_description`] = "Description is required.";
    }
    if (line.quantity <= 0) {
      errors[`line_${index}_quantity`] = "Quantity must be greater than zero.";
    }
  });
  return errors;
}

function editInvoiceFieldOrder(lines: InvoiceLineInput[]): string[] {
  const order = ["dueAt"];
  lines.forEach((_, index) => {
    order.push(`line_${index}_description`, `line_${index}_quantity`);
  });
  return order;
}

const paymentSchema = z.object({
  amount: fieldRules.positiveNumber("Amount"),
  method: fieldRules.selectRequired("payment method"),
  methodOther: fieldRules.optionalString(),
  reference: fieldRules.optionalString(),
  note: fieldRules.optionalString(),
}).superRefine((data, ctx) => {
  if (data.method === "other" && !data.methodOther?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["methodOther"],
      message: "Specify the payment method.",
    });
  }
});

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
  const [inventory, setInventory] = useState<BackendInventoryItem[]>([]);
  const [catalog, setCatalog] = useState<BackendCatalogItem[]>([]);
  const editFormRef = useRef<HTMLDivElement>(null);
  const paymentFormRef = useRef<HTMLDivElement>(null);

  const editValidation = useFormValidation<EditInvoiceValues>({
    fieldOrder: ["dueAt"],
    validate: validateEditInvoice,
  });

  const paymentValidation = useFormValidation({
    fieldOrder: ["amount", "method", "methodOther", "reference", "note"],
    schema: paymentSchema,
  });

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
    void Promise.all([
      api.listInventory({ limit: 100, page: 1 }).then((res) => setInventory(res.data)).catch(() => setInventory([])),
      api.listServiceCatalog().then(setCatalog).catch(() => setCatalog([])),
    ]);
  }, []);

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
    editValidation.reset();
    setEditing(true);
    void Promise.all([
      api.listInventory({ limit: 100, page: 1 }).then((res) => setInventory(res.data)).catch(() => undefined),
      api.listServiceCatalog().then(setCatalog).catch(() => undefined),
    ]);
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
    editValidation.reset();
  };

  const saveEdits = async () => {
    if (!invoice) return;
    const values = { dueAt: editDueAt, lines: editLines };
    const fieldErrors = validateEditInvoice(values);
    if (Object.keys(fieldErrors).length > 0) {
      editValidation.validateAll(values, fieldErrors, editFormRef.current);
      focusFirstInvalidField(fieldErrors, editInvoiceFieldOrder(editLines), editFormRef.current);
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
      editValidation.reset();
      toast({ title: "Invoice updated" });
    } catch (error) {
      if (!editValidation.applyApiErrors(error, editFormRef.current)) {
        toast({
          title: "Save failed",
          description: error instanceof ApiError ? error.message : "Request failed",
          variant: "destructive",
        });
      }
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
          type: line.type,
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

  const chargeSummary = useMemo(
    () => summarizeChargeGroups(lines.map((line) => ({
      type: line.type ?? "other",
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discount: line.discount,
      taxRate: line.taxRate,
    }))),
    [lines],
  );

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
    const values = payment;
    const extraErrors: FieldErrors = {};
    const maxAmount = Number(invoice.balanceDue ?? invoice.total);
    if (values.amount > maxAmount) {
      extraErrors.amount = `Amount cannot exceed ${formatCurrency(maxAmount)}.`;
    }
    if (!paymentValidation.validateAll(values, extraErrors, paymentFormRef.current)) return;

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
      paymentValidation.reset();
      toast({ title: "Payment recorded" });
    } catch (error) {
      if (!paymentValidation.applyApiErrors(error, paymentFormRef.current)) {
        toast.apiError(error, { fallback: "Request failed" });
      }
    } finally { setSaving(false); }
  };

  return (
    <RoleGuard roles={SERVICE_BILLING_ROLES}>
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
          editing ? (
            <div className="no-print space-y-6" ref={editFormRef}>
              <form
                noValidate
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void saveEdits();
                }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Edit invoice items</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid max-w-xs gap-2" data-field="dueAt">
                      <Label htmlFor="edit-due-at" className={editValidation.shouldShow("dueAt") ? "text-destructive" : undefined}>
                        Payment due date
                        <RequiredMark />
                      </Label>
                      <Input
                        id="edit-due-at"
                        name="dueAt"
                        type="date"
                        value={editDueAt}
                        className={fieldErrorClass(editValidation.shouldShow("dueAt"))}
                        {...fieldAria("dueAt", editValidation.shouldShow("dueAt") ? editValidation.errors.dueAt : null)}
                        onChange={(e) => {
                          setEditDueAt(e.target.value);
                          editValidation.handleChange("dueAt", { dueAt: e.target.value, lines: editLines });
                        }}
                        onBlur={() => editValidation.handleBlur("dueAt", { dueAt: editDueAt, lines: editLines })}
                      />
                      {editValidation.shouldShow("dueAt") && (
                        <FormFieldError field="dueAt" message={editValidation.errors.dueAt} />
                      )}
                    </div>

                    <InvoiceLineEditor
                      title="Products & services"
                      lines={editLines}
                      inventory={inventory}
                      catalog={catalog}
                      minLines={1}
                      errors={editValidation.errors}
                      shouldShow={editValidation.shouldShow}
                      onChange={(next) => {
                        setEditLines(next);
                        editValidation.handleChange("dueAt", { dueAt: editDueAt, lines: next });
                      }}
                      onBlurField={(field) => editValidation.handleBlur(field, { dueAt: editDueAt, lines: editLines })}
                    />

                    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Final amount</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ChargeBreakdown groups={chargeSummary.groups} total={editPreviewTotal} label="Preview final amount" />
                          <p className="mt-3 text-xs text-muted-foreground">
                            Add products from inventory or services from the catalog, same as estimate creation. Totals update when you save.
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="overflow-visible border-border">
                        <CardContent className="p-0">
                          {lines.length ? (
                            <ProfessionalDocument
                              kind="Invoice"
                              reference={invoice.reference}
                              customerName={invoice.customerName}
                              equipmentName={context?.job.equipmentName}
                              issueDate={invoice.issuedAt}
                              validOrDueLabel="Due date"
                              validOrDueDate={editDueAt}
                              ticketRef={invoice.jobRef}
                              lines={lines}
                              notes={context?.job.serviceRequest?.description ? `Service: ${context.job.serviceRequest.description}` : undefined}
                              hideToolbar
                              showSignature
                            />
                          ) : (
                            <p className="p-10 text-center text-muted-foreground">Add at least one line item.</p>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </CardContent>
                </Card>
              </form>
            </div>
          ) : (
          <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
            <div className="no-print space-y-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Invoice actions</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <InfoRow label="Status" value={<StatusBadge status={invoice.status} />} />
                  <ChargeBreakdown groups={chargeSummary.groups} total={Number(invoice.total)} />
                  <InfoRow label="Paid" value={formatCurrency(invoice.paidTotal ?? 0)} />
                  <InfoRow label="Balance" value={formatCurrency(invoice.balanceDue ?? invoice.total)} />
                  {canEdit ? (
                    <Button className="w-full" variant="outline" onClick={startEditing}>
                      <Pencil className="mr-2 h-4 w-4" /> Edit / add products & services
                    </Button>
                  ) : null}
                  <div className="flex flex-col gap-2 pt-2">
                    {invoice.status === "draft" ? (
                      <Button variant="outline" onClick={submitApproval} disabled={saving}>Submit for approval</Button>
                    ) : null}
                    {invoice.status === "pendingApproval" ? (
                      <Button onClick={approveInvoice} disabled={saving}>Approve invoice</Button>
                    ) : null}
                    {invoice.status === "approved" ? (
                      <Button onClick={markSent} disabled={saving}>Mark sent</Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              {["sent", "overdue"].includes(invoice.status) && Number(invoice.balanceDue ?? invoice.total) > 0 ? (
                <Card ref={paymentFormRef}>
                  <CardHeader><CardTitle className="text-base">Record payment</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <form
                      noValidate
                      onSubmit={(e) => {
                        e.preventDefault();
                        void recordPayment();
                      }}
                    >
                      <div className="grid gap-2" data-field="amount">
                        <Label htmlFor="payment-amount" className={paymentValidation.shouldShow("amount") ? "text-destructive" : undefined}>
                          Amount
                          <RequiredMark />
                        </Label>
                        <Input
                          id="payment-amount"
                          name="amount"
                          type="number"
                          min={0.01}
                          max={Number(invoice.balanceDue ?? invoice.total)}
                          value={payment.amount}
                          className={fieldErrorClass(paymentValidation.shouldShow("amount"))}
                          {...fieldAria("amount", paymentValidation.shouldShow("amount") ? paymentValidation.errors.amount : null)}
                          onChange={(e) => {
                            const next = { ...payment, amount: Number(e.target.value) };
                            setPayment(next);
                            paymentValidation.handleChange("amount", next);
                          }}
                          onBlur={() => paymentValidation.handleBlur("amount", payment)}
                        />
                        {paymentValidation.shouldShow("amount") && (
                          <FormFieldError field="amount" message={paymentValidation.errors.amount} />
                        )}
                      </div>
                      <div className="grid gap-2" data-field="method">
                        <Label className={paymentValidation.shouldShow("method") ? "text-destructive" : undefined}>
                          Method
                          <RequiredMark />
                        </Label>
                        <Select
                          value={payment.method}
                          onValueChange={(method) => {
                            const next = { ...payment, method, methodOther: method === "other" ? payment.methodOther : "" };
                            setPayment(next);
                            paymentValidation.clearError("method");
                            if (method !== "other") paymentValidation.clearError("methodOther");
                            paymentValidation.handleChange("method", next);
                          }}
                        >
                          <SelectTrigger
                            id="method"
                            className={fieldErrorClass(paymentValidation.shouldShow("method"))}
                            {...fieldAria("method", paymentValidation.shouldShow("method") ? paymentValidation.errors.method : null)}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PAYMENT_METHOD_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {paymentValidation.shouldShow("method") && (
                          <FormFieldError field="method" message={paymentValidation.errors.method} />
                        )}
                      </div>
                      {payment.method === "other" ? (
                        <div className="grid gap-2" data-field="methodOther">
                          <Label htmlFor="method-other" className={paymentValidation.shouldShow("methodOther") ? "text-destructive" : undefined}>
                            Specify method
                            <RequiredMark />
                          </Label>
                          <Input
                            id="method-other"
                            name="methodOther"
                            value={payment.methodOther}
                            className={fieldErrorClass(paymentValidation.shouldShow("methodOther"))}
                            {...fieldAria("methodOther", paymentValidation.shouldShow("methodOther") ? paymentValidation.errors.methodOther : null)}
                            onChange={(e) => {
                              const next = { ...payment, methodOther: e.target.value };
                              setPayment(next);
                              paymentValidation.handleChange("methodOther", next);
                            }}
                            onBlur={() => paymentValidation.handleBlur("methodOther", payment)}
                          />
                          {paymentValidation.shouldShow("methodOther") && (
                            <FormFieldError field="methodOther" message={paymentValidation.errors.methodOther} />
                          )}
                        </div>
                      ) : null}
                      <div className="grid gap-2" data-field="reference">
                        <Label htmlFor="payment-reference">Reference</Label>
                        <Input
                          id="payment-reference"
                          name="reference"
                          value={payment.reference}
                          onChange={(e) => setPayment({ ...payment, reference: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-2" data-field="note">
                        <Label htmlFor="payment-note">Note</Label>
                        <Textarea
                          id="payment-note"
                          name="note"
                          value={payment.note}
                          onChange={(e) => setPayment({ ...payment, note: e.target.value })}
                        />
                      </div>
                      <Button type="submit" className="w-full" disabled={saving}>
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Record payment
                      </Button>
                    </form>
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

            <Card className="print-area overflow-visible border-border">
              <CardContent className="p-0">
                {lines.length ? (
                  <ProfessionalDocument
                    kind="Invoice"
                    reference={invoice.reference}
                    customerName={invoice.customerName}
                    equipmentName={context?.job.equipmentName}
                    issueDate={invoice.issuedAt}
                    validOrDueLabel="Due date"
                    validOrDueDate={invoice.dueAt}
                    ticketRef={invoice.jobRef}
                    lines={lines}
                    notes={context?.job.serviceRequest?.description ? `Service: ${context.job.serviceRequest.description}` : undefined}
                    hideToolbar
                    showSignature
                  />
                ) : (
                  <p className="p-10 text-center text-muted-foreground">No line items on this invoice.</p>
                )}
              </CardContent>
            </Card>
          </div>
          )
        )}
      </div>
    </RoleGuard>
  );
}
