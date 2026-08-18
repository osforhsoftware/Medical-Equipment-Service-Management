import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { BadgeIndianRupee, Loader2, Plus, ReceiptText } from "lucide-react";
import { FormFieldError } from "@/components/shared/FormFieldError";
import { RequiredMark } from "@/components/shared/RequiredMark";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useFormValidation } from "@/hooks/useFormValidation";
import { fieldAria, fieldErrorClass, fieldRules } from "@/lib/formValidation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api, type BackendCommission, type BackendExpense, type BackendServiceJob } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";

const expenseSchema = z.object({
  category: fieldRules.requiredString("Category"),
  description: fieldRules.requiredString("Description"),
  incurredAt: fieldRules.requiredString("Incurred date"),
  amount: fieldRules.positiveNumber("Amount"),
  projectRef: fieldRules.optionalString(),
  jobId: fieldRules.optionalString(),
  vendor: fieldRules.optionalString(),
});

const commissionSchema = z.object({
  payeeName: fieldRules.requiredString("Payee"),
  basisAmount: fieldRules.positiveNumber("Basis amount"),
  rate: fieldRules.nonNegativeNumber("Rate"),
});

export default function ExpensesCommissions() {
  const [expenses, setExpenses] = useState<BackendExpense[]>([]);
  const [commissions, setCommissions] = useState<BackendCommission[]>([]);
  const [jobs, setJobs] = useState<BackendServiceJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [commissionOpen, setCommissionOpen] = useState(false);
  const [expense, setExpense] = useState({ projectRef: "", jobId: "", category: "", description: "", amount: 0, incurredAt: "", vendor: "" });
  const [commission, setCommission] = useState({ payeeName: "", basisAmount: 0, rate: 0 });
  const expenseRef = useRef<HTMLDivElement>(null);
  const commissionRef = useRef<HTMLDivElement>(null);

  const expenseValidation = useFormValidation({
    fieldOrder: ["category", "incurredAt", "description", "amount"],
    schema: expenseSchema,
  });
  const commissionValidation = useFormValidation({
    fieldOrder: ["payeeName", "basisAmount", "rate"],
    schema: commissionSchema,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [expenseRows, commissionRows, jobRows] = await Promise.all([
        api.listExpenses(),
        api.listCommissions(),
        api.listJobs({ limit: 100, page: 1 }),
      ]);
      setExpenses(expenseRows); setCommissions(commissionRows); setJobs(jobRows.data);
    } catch (error) { toast.apiError(error, { fallback: "Request failed" }); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => ({
    expenses: expenses.reduce((sum, row) => sum + Number(row.amount), 0),
    commissions: commissions.reduce((sum, row) => sum + Number(row.amount), 0),
  }), [expenses, commissions]);

  const saveExpense = async () => {
    if (!expenseValidation.validateAll(expense, undefined, expenseRef.current)) return;
    setSaving(true);
    try {
      await api.createExpense({ ...expense, branchId: null, projectRef: expense.projectRef || null, jobId: expense.jobId || null, vendor: expense.vendor || null, receiptFileId: null });
      setExpenseOpen(false);
      setExpense({ projectRef: "", jobId: "", category: "", description: "", amount: 0, incurredAt: "", vendor: "" });
      expenseValidation.reset();
      await load();
      toast({ title: "Expense recorded" });
    } catch (error) {
      if (!expenseValidation.applyApiErrors(error, expenseRef.current)) {
        toast.apiError(error, { fallback: "Request failed" });
      }
    }
    finally { setSaving(false); }
  };

  const saveCommission = async () => {
    if (!commissionValidation.validateAll(commission, undefined, commissionRef.current)) return;
    setSaving(true);
    try {
      await api.createCommission(commission);
      setCommissionOpen(false);
      setCommission({ payeeName: "", basisAmount: 0, rate: 0 });
      commissionValidation.reset();
      await load();
      toast({ title: "Commission accrued" });
    } catch (error) {
      if (!commissionValidation.applyApiErrors(error, commissionRef.current)) {
        toast.apiError(error, { fallback: "Request failed" });
      }
    }
    finally { setSaving(false); }
  };

  return <div className="space-y-6">
    <PageHeader title="Expenses & Commissions" description="Project costs, referrals and commission accruals." actions={<div className="flex gap-2"><Button variant="outline" onClick={() => { expenseValidation.reset(); setExpenseOpen(true); }}><Plus className="mr-1 h-4 w-4" /> Expense</Button><Button variant="brand" onClick={() => { commissionValidation.reset(); setCommissionOpen(true); }}><Plus className="mr-1 h-4 w-4" /> Commission</Button></div>} />
    <div className="grid gap-4 sm:grid-cols-2"><StatCard label="Recorded Expenses" value={formatCurrency(totals.expenses)} icon={ReceiptText} accent="warning" /><StatCard label="Commission Accruals" value={formatCurrency(totals.commissions)} icon={BadgeIndianRupee} accent="accent" /></div>
    {loading ? <div className="flex justify-center gap-2 py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading finance records…</div> : <Tabs defaultValue="expenses"><TabsList><TabsTrigger value="expenses">Expenses</TabsTrigger><TabsTrigger value="commissions">Commissions</TabsTrigger></TabsList>
      <TabsContent value="expenses"><Card><CardContent className="divide-y p-0">{expenses.map((row) => <div key={row.id} className="flex items-center justify-between gap-4 p-4"><div><p className="font-medium">{row.description}</p><p className="text-xs text-muted-foreground">{row.category} · {row.projectRef || row.vendor || "General"} · {formatDate(row.incurredAt)}</p></div><span className="font-semibold">{formatCurrency(row.amount)}</span></div>)}{expenses.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No expenses recorded.</p> : null}</CardContent></Card></TabsContent>
      <TabsContent value="commissions"><Card><CardContent className="divide-y p-0">{commissions.map((row) => <div key={row.id} className="flex items-center justify-between gap-4 p-4"><div><div className="flex items-center gap-2"><p className="font-medium">{row.payeeName}</p><StatusBadge status={row.status} /></div><p className="text-xs text-muted-foreground">{Number(row.rate)}% of {formatCurrency(row.basisAmount)}</p></div><span className="font-semibold">{formatCurrency(row.amount)}</span></div>)}{commissions.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No commissions recorded.</p> : null}</CardContent></Card></TabsContent>
    </Tabs>}
    <Dialog open={expenseOpen} onOpenChange={(open) => { if (!open) expenseValidation.reset(); setExpenseOpen(open); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Record expense</DialogTitle></DialogHeader>
        <form noValidate onSubmit={(e) => { e.preventDefault(); void saveExpense(); }}>
          <div ref={expenseRef} className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2" data-field="category">
                <Label htmlFor="expense-category" className={expenseValidation.shouldShow("category") ? "text-destructive" : undefined}>Category<RequiredMark /></Label>
                <Input id="expense-category" name="category" value={expense.category} className={fieldErrorClass(expenseValidation.shouldShow("category"))} {...fieldAria("category", expenseValidation.shouldShow("category") ? expenseValidation.errors.category : null)} onChange={(e) => { const next = { ...expense, category: e.target.value }; setExpense(next); expenseValidation.handleChange("category", next); }} onBlur={() => expenseValidation.handleBlur("category", expense)} />
                {expenseValidation.shouldShow("category") && <FormFieldError field="category" message={expenseValidation.errors.category} />}
              </div>
              <div className="grid gap-2" data-field="incurredAt">
                <Label htmlFor="expense-date" className={expenseValidation.shouldShow("incurredAt") ? "text-destructive" : undefined}>Incurred date<RequiredMark /></Label>
                <Input id="expense-date" name="incurredAt" type="date" value={expense.incurredAt} className={fieldErrorClass(expenseValidation.shouldShow("incurredAt"))} {...fieldAria("incurredAt", expenseValidation.shouldShow("incurredAt") ? expenseValidation.errors.incurredAt : null)} onChange={(e) => { const next = { ...expense, incurredAt: e.target.value }; setExpense(next); expenseValidation.handleChange("incurredAt", next); }} onBlur={() => expenseValidation.handleBlur("incurredAt", expense)} />
                {expenseValidation.shouldShow("incurredAt") && <FormFieldError field="incurredAt" message={expenseValidation.errors.incurredAt} />}
              </div>
            </div>
            <div className="grid gap-2" data-field="description">
              <Label htmlFor="expense-description" className={expenseValidation.shouldShow("description") ? "text-destructive" : undefined}>Description<RequiredMark /></Label>
              <Textarea id="expense-description" name="description" value={expense.description} className={fieldErrorClass(expenseValidation.shouldShow("description"))} {...fieldAria("description", expenseValidation.shouldShow("description") ? expenseValidation.errors.description : null)} onChange={(e) => { const next = { ...expense, description: e.target.value }; setExpense(next); expenseValidation.handleChange("description", next); }} onBlur={() => expenseValidation.handleBlur("description", expense)} />
              {expenseValidation.shouldShow("description") && <FormFieldError field="description" message={expenseValidation.errors.description} />}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2"><Label>Project / job</Label><Select value={expense.jobId} onValueChange={(jobId) => { const job = jobs.find((row) => row.id === jobId); setExpense({ ...expense, jobId, projectRef: job?.reference ?? "" }); }}><SelectTrigger><SelectValue placeholder="Optional project" /></SelectTrigger><SelectContent>{jobs.map((job) => <SelectItem key={job.id} value={job.id}>{job.reference} · {job.customerName}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid gap-2"><Label htmlFor="expense-vendor">Vendor</Label><Input id="expense-vendor" value={expense.vendor} onChange={(e) => setExpense({ ...expense, vendor: e.target.value })} /></div>
            </div>
            <div className="grid gap-2" data-field="amount">
              <Label htmlFor="expense-amount" className={expenseValidation.shouldShow("amount") ? "text-destructive" : undefined}>Amount<RequiredMark /></Label>
              <Input id="expense-amount" name="amount" type="number" min={0.01} value={expense.amount} className={fieldErrorClass(expenseValidation.shouldShow("amount"))} {...fieldAria("amount", expenseValidation.shouldShow("amount") ? expenseValidation.errors.amount : null)} onChange={(e) => { const next = { ...expense, amount: Number(e.target.value) }; setExpense(next); expenseValidation.handleChange("amount", next); }} onBlur={() => expenseValidation.handleBlur("amount", expense)} />
              {expenseValidation.shouldShow("amount") && <FormFieldError field="amount" message={expenseValidation.errors.amount} />}
            </div>
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setExpenseOpen(false)}>Cancel</Button><Button type="submit" disabled={saving}>Save</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    <Dialog open={commissionOpen} onOpenChange={(open) => { if (!open) commissionValidation.reset(); setCommissionOpen(open); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Accrue commission</DialogTitle></DialogHeader>
        <form noValidate onSubmit={(e) => { e.preventDefault(); void saveCommission(); }}>
          <div ref={commissionRef} className="grid gap-3 py-2">
            <div className="grid gap-2" data-field="payeeName">
              <Label htmlFor="commission-payee" className={commissionValidation.shouldShow("payeeName") ? "text-destructive" : undefined}>Payee<RequiredMark /></Label>
              <Input id="commission-payee" name="payeeName" value={commission.payeeName} className={fieldErrorClass(commissionValidation.shouldShow("payeeName"))} {...fieldAria("payeeName", commissionValidation.shouldShow("payeeName") ? commissionValidation.errors.payeeName : null)} onChange={(e) => { const next = { ...commission, payeeName: e.target.value }; setCommission(next); commissionValidation.handleChange("payeeName", next); }} onBlur={() => commissionValidation.handleBlur("payeeName", commission)} />
              {commissionValidation.shouldShow("payeeName") && <FormFieldError field="payeeName" message={commissionValidation.errors.payeeName} />}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2" data-field="basisAmount">
                <Label htmlFor="commission-basis" className={commissionValidation.shouldShow("basisAmount") ? "text-destructive" : undefined}>Basis amount<RequiredMark /></Label>
                <Input id="commission-basis" name="basisAmount" type="number" min={0} value={commission.basisAmount} className={fieldErrorClass(commissionValidation.shouldShow("basisAmount"))} {...fieldAria("basisAmount", commissionValidation.shouldShow("basisAmount") ? commissionValidation.errors.basisAmount : null)} onChange={(e) => { const next = { ...commission, basisAmount: Number(e.target.value) }; setCommission(next); commissionValidation.handleChange("basisAmount", next); }} onBlur={() => commissionValidation.handleBlur("basisAmount", commission)} />
                {commissionValidation.shouldShow("basisAmount") && <FormFieldError field="basisAmount" message={commissionValidation.errors.basisAmount} />}
              </div>
              <div className="grid gap-2" data-field="rate">
                <Label htmlFor="commission-rate">Rate %</Label>
                <Input id="commission-rate" name="rate" type="number" min={0} max={100} value={commission.rate} onChange={(e) => { const next = { ...commission, rate: Number(e.target.value) }; setCommission(next); commissionValidation.handleChange("rate", next); }} onBlur={() => commissionValidation.handleBlur("rate", commission)} />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Calculated amount: {formatCurrency(commission.basisAmount * commission.rate / 100)}</p>
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setCommissionOpen(false)}>Cancel</Button><Button type="submit" disabled={saving}>Save</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>;
}
