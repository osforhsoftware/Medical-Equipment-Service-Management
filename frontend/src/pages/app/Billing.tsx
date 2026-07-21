import { useEffect, useState } from "react";
import { AlertCircle, Clock, Download, IndianRupee, Loader2, Plus, Receipt } from "lucide-react";
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
import { ApiError } from "@/lib/api";
import { api, type BackendInvoice } from "@/lib/api";
import { formatCurrency, formatCurrencyShort } from "@/lib/format";
import { toast } from "@/hooks/use-toast";

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

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.listInvoices();
      setInvoices(data);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to load invoices";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const save = async () => {
    setSaving(true);
    const amount = parseFloat(form.amount) || 0;
    const tax = parseFloat(form.tax) || 0;
    try {
      await api.createInvoice({
        reference: form.reference,
        customerName: form.customerName,
        jobRef: form.jobRef,
        amount,
        tax,
        total: amount + tax,
        status: "draft",
        dueAt: new Date(form.dueAt).toISOString(),
      });
      toast({ title: "Invoice created", description: `${form.reference} saved as draft.` });
      setDialogOpen(false);
      setForm(emptyForm);
      await load();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Unable to save invoice";
      toast({ title: "Error", description: msg, variant: "destructive" });
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
            <Button onClick={() => { setForm(emptyForm); setDialogOpen(true); }} className="bg-gradient-primary text-primary-foreground hover:opacity-90">
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Invoice</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Reference</Label>
                <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="INV-2026-001" />
              </div>
              <div className="grid gap-2">
                <Label>Job Reference</Label>
                <Input value={form.jobRef} onChange={(e) => setForm({ ...form, jobRef: e.target.value })} placeholder="JOB-2026-001" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Customer Name</Label>
              <Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label>Amount (₹)</Label>
                <Input type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Tax (₹)</Label>
                <Input type="number" min="0" value={form.tax} onChange={(e) => setForm({ ...form, tax: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Total</Label>
                <Input readOnly value={`₹${(parseFloat(form.amount || "0") + parseFloat(form.tax || "0")).toLocaleString("en-IN")}`} className="bg-muted text-muted-foreground" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Due Date</Label>
              <Input type="date" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Create Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleGuard>
  );
}
