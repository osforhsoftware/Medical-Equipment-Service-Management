import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { AlertCircle, Clock, Download, IndianRupee, Loader2, Plus, Receipt } from "lucide-react";
import { FormFieldError } from "@/components/shared/FormFieldError";
import { RequiredMark } from "@/components/shared/RequiredMark";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { useFormValidation } from "@/hooks/useFormValidation";
import { fieldAria, fieldErrorClass, fieldRules } from "@/lib/formValidation";
import { api, type BackendInvoice } from "@/lib/api";
import { formatCurrency, formatCurrencyShort } from "@/lib/format";
import { toast } from "@/lib/toast";

const nonNegativeAmount = (label: string) =>
  z.string().refine((v) => {
    if (!v.trim()) return true;
    const n = parseFloat(v);
    return !Number.isNaN(n) && n >= 0;
  }, `${label} cannot be negative.`);

const invoiceSchema = z.object({
  reference: fieldRules.requiredString("Reference"),
  customerName: fieldRules.requiredString("Customer name"),
  jobRef: fieldRules.optionalString(),
  amount: nonNegativeAmount("Amount"),
  tax: nonNegativeAmount("Tax"),
  dueAt: fieldRules.requiredString("Due date"),
});

type FormState = {
  reference: string;
  customerName: string;
  jobRef: string;
  amount: string;
  tax: string;
  dueAt: string;
};

const emptyForm: FormState = {
  reference: "",
  customerName: "",
  jobRef: "",
  amount: "0",
  tax: "0",
  dueAt: "",
};

export default function Billing() {
  const [invoices, setInvoices] = useState<BackendInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const {
    errors,
    shouldShow,
    reset: resetValidation,
    validateAll,
    handleBlur,
    handleChange,
    applyApiErrors,
  } = useFormValidation({
    fieldOrder: ["reference", "customerName", "jobRef", "amount", "tax", "dueAt"],
    schema: invoiceSchema,
  });

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.listInvoices();
      setInvoices(data);
    } catch (err) {
      toast.apiError(err, { fallback: "Failed to load invoices" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const openCreate = () => {
    setForm(emptyForm);
    resetValidation();
    setDialogOpen(true);
  };

  const save = async () => {
    if (!validateAll(form, undefined, dialogRef.current)) return;

    setSaving(true);
    const amount = parseFloat(form.amount) || 0;
    const tax = parseFloat(form.tax) || 0;
    try {
      await api.createInvoice({
        reference: form.reference.trim(),
        customerName: form.customerName.trim(),
        jobRef: form.jobRef.trim(),
        amount,
        tax,
        total: amount + tax,
        status: "draft",
        dueAt: new Date(form.dueAt).toISOString(),
      });
      toast({ title: "Invoice created", description: `${form.reference.trim()} saved as draft.` });
      setDialogOpen(false);
      setForm(emptyForm);
      resetValidation();
      await load();
    } catch (err) {
      if (!applyApiErrors(err, dialogRef.current)) {
        toast.apiError(err, { fallback: "Unable to save invoice" });
      }
    } finally {
      setSaving(false);
    }
  };

  const paid = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.total), 0);
  const outstanding = invoices.filter((i) => i.status !== "paid").reduce((s, i) => s + Number(i.total), 0);
  const overdue = invoices.filter((i) => i.status === "overdue").length;

  const columns: Column<BackendInvoice>[] = [
    {
      key: "reference",
      header: "Invoice",
      render: (i) => (
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-primary" />
          <div>
            <p className="font-mono text-sm font-medium">{i.reference}</p>
            <p className="text-xs text-muted-foreground">{i.jobRef}</p>
          </div>
        </div>
      ),
    },
    { key: "customerName", header: "Customer", render: (i) => <span className="text-sm">{i.customerName}</span> },
    { key: "amount", header: "Subtotal", render: (i) => <span className="text-sm">{formatCurrency(Number(i.amount))}</span> },
    { key: "tax", header: "Tax", render: (i) => <span className="text-sm text-muted-foreground">{formatCurrency(Number(i.tax))}</span> },
    { key: "total", header: "Total", render: (i) => <span className="font-semibold">{formatCurrency(Number(i.total))}</span> },
    {
      key: "dueAt",
      header: "Due",
      render: (i) => <span className="text-sm text-muted-foreground">{new Date(i.dueAt).toLocaleDateString()}</span>,
    },
    { key: "status", header: "Status", render: (i) => <StatusBadge status={i.status} /> },
    {
      key: "actions" as keyof BackendInvoice,
      header: "",
      render: (i) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => { e.stopPropagation(); toast({ title: "Download PDF", description: `${i.reference}.pdf` }); }}
        >
          <Download className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <RoleGuard roles={["admin", "billing"]}>
      <div className="space-y-6">
        <PageHeader
          title="Billing & Invoicing"
          description="Generate invoices from completed jobs and track payments."
          actions={
            <Button onClick={openCreate} variant="brand">
              <Plus className="mr-1 h-4 w-4" /> New Invoice
            </Button>
          }
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Collected" value={formatCurrencyShort(paid)} icon={IndianRupee} accent="success" />
          <StatCard label="Outstanding" value={formatCurrencyShort(outstanding)} icon={Clock} accent="warning" />
          <StatCard label="Overdue Invoices" value={String(overdue)} icon={AlertCircle} accent="destructive" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading invoices…
          </div>
        ) : (
          <DataTable
            data={invoices}
            columns={columns}
            searchKeys={["reference", "customerName", "jobRef"]}
            searchPlaceholder="Search invoices…"
            filters={[
              {
                label: "Status",
                options: [
                  { label: "Draft", value: "draft" },
                  { label: "Sent", value: "sent" },
                  { label: "Paid", value: "paid" },
                  { label: "Overdue", value: "overdue" },
                ],
                predicate: (i, v) => i.status === v,
              },
            ]}
            onRowClick={(i) => toast({ title: i.reference, description: `${i.customerName} · ${formatCurrency(Number(i.total))}` })}
          />
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetValidation(); setDialogOpen(open); }}>
        <DialogContent ref={dialogRef} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Invoice</DialogTitle>
          </DialogHeader>
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
            className="grid gap-3 py-2"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2" data-field="reference">
                <Label htmlFor="invoice-reference" className={shouldShow("reference") ? "text-destructive" : undefined}>
                  Reference
                  <RequiredMark />
                </Label>
                <Input
                  id="invoice-reference"
                  value={form.reference}
                  onChange={(e) => {
                    const next = { ...form, reference: e.target.value };
                    setForm(next);
                    handleChange("reference", next);
                  }}
                  onBlur={() => handleBlur("reference", form)}
                  placeholder="INV-2026-001"
                  className={fieldErrorClass(shouldShow("reference"))}
                  {...fieldAria("reference", shouldShow("reference") ? errors.reference : null)}
                />
                {shouldShow("reference") && <FormFieldError field="reference" message={errors.reference} />}
              </div>
              <div className="grid gap-2" data-field="jobRef">
                <Label htmlFor="invoice-job-ref">Job Reference</Label>
                <Input
                  id="invoice-job-ref"
                  value={form.jobRef}
                  onChange={(e) => setForm({ ...form, jobRef: e.target.value })}
                  placeholder="JOB-2026-001"
                />
              </div>
            </div>
            <div className="grid gap-2" data-field="customerName">
              <Label htmlFor="invoice-customer" className={shouldShow("customerName") ? "text-destructive" : undefined}>
                Customer Name
                <RequiredMark />
              </Label>
              <Input
                id="invoice-customer"
                value={form.customerName}
                onChange={(e) => {
                  const next = { ...form, customerName: e.target.value };
                  setForm(next);
                  handleChange("customerName", next);
                }}
                onBlur={() => handleBlur("customerName", form)}
                className={fieldErrorClass(shouldShow("customerName"))}
                {...fieldAria("customerName", shouldShow("customerName") ? errors.customerName : null)}
              />
              {shouldShow("customerName") && <FormFieldError field="customerName" message={errors.customerName} />}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2" data-field="amount">
                <Label htmlFor="invoice-amount">Amount (₹)</Label>
                <Input
                  id="invoice-amount"
                  type="number"
                  min="0"
                  value={form.amount}
                  onChange={(e) => {
                    const next = { ...form, amount: e.target.value };
                    setForm(next);
                    handleChange("amount", next);
                  }}
                  onBlur={() => handleBlur("amount", form)}
                  className={fieldErrorClass(shouldShow("amount"))}
                  {...fieldAria("amount", shouldShow("amount") ? errors.amount : null)}
                />
                {shouldShow("amount") && <FormFieldError field="amount" message={errors.amount} />}
              </div>
              <div className="grid gap-2" data-field="tax">
                <Label htmlFor="invoice-tax">Tax (₹)</Label>
                <Input
                  id="invoice-tax"
                  type="number"
                  min="0"
                  value={form.tax}
                  onChange={(e) => {
                    const next = { ...form, tax: e.target.value };
                    setForm(next);
                    handleChange("tax", next);
                  }}
                  onBlur={() => handleBlur("tax", form)}
                  className={fieldErrorClass(shouldShow("tax"))}
                  {...fieldAria("tax", shouldShow("tax") ? errors.tax : null)}
                />
                {shouldShow("tax") && <FormFieldError field="tax" message={errors.tax} />}
              </div>
              <div className="grid gap-2">
                <Label>Total</Label>
                <Input readOnly value={`₹${(parseFloat(form.amount || "0") + parseFloat(form.tax || "0")).toLocaleString("en-IN")}`} className="bg-muted text-muted-foreground" />
              </div>
            </div>
            <div className="grid gap-2" data-field="dueAt">
              <Label htmlFor="invoice-due" className={shouldShow("dueAt") ? "text-destructive" : undefined}>
                Due Date
                <RequiredMark />
              </Label>
              <Input
                id="invoice-due"
                type="date"
                value={form.dueAt}
                onChange={(e) => {
                  const next = { ...form, dueAt: e.target.value };
                  setForm(next);
                  handleChange("dueAt", next);
                }}
                onBlur={() => handleBlur("dueAt", form)}
                className={fieldErrorClass(shouldShow("dueAt"))}
                {...fieldAria("dueAt", shouldShow("dueAt") ? errors.dueAt : null)}
              />
              {shouldShow("dueAt") && <FormFieldError field="dueAt" message={errors.dueAt} />}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Create Invoice
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </RoleGuard>
  );
}
