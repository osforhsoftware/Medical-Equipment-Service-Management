import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeIndianRupee, Loader2, Plus, ReceiptText } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api, type BackendCommission, type BackendExpense, type BackendServiceJob } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "@/hooks/use-toast";

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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [expenseRows, commissionRows, jobRows] = await Promise.all([api.listExpenses(), api.listCommissions(), api.listJobs()]);
      setExpenses(expenseRows); setCommissions(commissionRows); setJobs(jobRows);
    } catch (error) { toast({ title: "Unable to load finance operations", description: error instanceof ApiError ? error.message : "Request failed", variant: "destructive" }); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => ({
    expenses: expenses.reduce((sum, row) => sum + Number(row.amount), 0),
    commissions: commissions.reduce((sum, row) => sum + Number(row.amount), 0),
  }), [expenses, commissions]);

  const saveExpense = async () => {
    setSaving(true);
    try {
      await api.createExpense({ ...expense, branchId: null, projectRef: expense.projectRef || null, jobId: expense.jobId || null, vendor: expense.vendor || null, receiptFileId: null });
      setExpenseOpen(false); setExpense({ projectRef: "", jobId: "", category: "", description: "", amount: 0, incurredAt: "", vendor: "" }); await load(); toast({ title: "Expense recorded" });
    } catch (error) { toast({ title: "Expense save failed", description: error instanceof ApiError ? error.message : "Request failed", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const saveCommission = async () => {
    setSaving(true);
    try {
      await api.createCommission(commission);
      setCommissionOpen(false); setCommission({ payeeName: "", basisAmount: 0, rate: 0 }); await load(); toast({ title: "Commission accrued" });
    } catch (error) { toast({ title: "Commission save failed", description: error instanceof ApiError ? error.message : "Request failed", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  return <div className="space-y-6">
    <PageHeader title="Expenses & Commissions" description="Project costs, referrals and commission accruals." actions={<div className="flex gap-2"><Button variant="outline" onClick={() => setExpenseOpen(true)}><Plus className="mr-1 h-4 w-4" /> Expense</Button><Button variant="brand" onClick={() => setCommissionOpen(true)}><Plus className="mr-1 h-4 w-4" /> Commission</Button></div>} />
    <div className="grid gap-4 sm:grid-cols-2"><StatCard label="Recorded Expenses" value={formatCurrency(totals.expenses)} icon={ReceiptText} accent="warning" /><StatCard label="Commission Accruals" value={formatCurrency(totals.commissions)} icon={BadgeIndianRupee} accent="accent" /></div>
    {loading ? <div className="flex justify-center gap-2 py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading finance records…</div> : <Tabs defaultValue="expenses"><TabsList><TabsTrigger value="expenses">Expenses</TabsTrigger><TabsTrigger value="commissions">Commissions</TabsTrigger></TabsList>
      <TabsContent value="expenses"><Card><CardContent className="divide-y p-0">{expenses.map((row) => <div key={row.id} className="flex items-center justify-between gap-4 p-4"><div><p className="font-medium">{row.description}</p><p className="text-xs text-muted-foreground">{row.category} · {row.projectRef || row.vendor || "General"} · {formatDate(row.incurredAt)}</p></div><span className="font-semibold">{formatCurrency(row.amount)}</span></div>)}{expenses.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No expenses recorded.</p> : null}</CardContent></Card></TabsContent>
      <TabsContent value="commissions"><Card><CardContent className="divide-y p-0">{commissions.map((row) => <div key={row.id} className="flex items-center justify-between gap-4 p-4"><div><div className="flex items-center gap-2"><p className="font-medium">{row.payeeName}</p><StatusBadge status={row.status} /></div><p className="text-xs text-muted-foreground">{Number(row.rate)}% of {formatCurrency(row.basisAmount)}</p></div><span className="font-semibold">{formatCurrency(row.amount)}</span></div>)}{commissions.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No commissions recorded.</p> : null}</CardContent></Card></TabsContent>
    </Tabs>}
    <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}><DialogContent><DialogHeader><DialogTitle>Record expense</DialogTitle></DialogHeader><div className="grid gap-3 py-2"><div className="grid grid-cols-2 gap-3"><Field label="Category"><Input value={expense.category} onChange={(e) => setExpense({ ...expense, category: e.target.value })} /></Field><Field label="Incurred date"><Input type="date" value={expense.incurredAt} onChange={(e) => setExpense({ ...expense, incurredAt: e.target.value })} /></Field></div><Field label="Description"><Textarea value={expense.description} onChange={(e) => setExpense({ ...expense, description: e.target.value })} /></Field><div className="grid grid-cols-2 gap-3"><Field label="Project / job"><Select value={expense.jobId} onValueChange={(jobId) => { const job = jobs.find((row) => row.id === jobId); setExpense({ ...expense, jobId, projectRef: job?.reference ?? "" }); }}><SelectTrigger><SelectValue placeholder="Optional project" /></SelectTrigger><SelectContent>{jobs.map((job) => <SelectItem key={job.id} value={job.id}>{job.reference} · {job.customerName}</SelectItem>)}</SelectContent></Select></Field><Field label="Vendor"><Input value={expense.vendor} onChange={(e) => setExpense({ ...expense, vendor: e.target.value })} /></Field></div><Field label="Amount"><Input type="number" min={0.01} value={expense.amount} onChange={(e) => setExpense({ ...expense, amount: Number(e.target.value) })} /></Field></div><DialogFooter><Button variant="outline" onClick={() => setExpenseOpen(false)}>Cancel</Button><Button onClick={saveExpense} disabled={saving || !expense.category || !expense.description || !expense.incurredAt || expense.amount <= 0}>Save</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={commissionOpen} onOpenChange={setCommissionOpen}><DialogContent><DialogHeader><DialogTitle>Accrue commission</DialogTitle></DialogHeader><div className="grid gap-3 py-2"><Field label="Payee"><Input value={commission.payeeName} onChange={(e) => setCommission({ ...commission, payeeName: e.target.value })} /></Field><div className="grid grid-cols-2 gap-3"><Field label="Basis amount"><Input type="number" min={0} value={commission.basisAmount} onChange={(e) => setCommission({ ...commission, basisAmount: Number(e.target.value) })} /></Field><Field label="Rate %"><Input type="number" min={0} max={100} value={commission.rate} onChange={(e) => setCommission({ ...commission, rate: Number(e.target.value) })} /></Field></div><p className="text-sm text-muted-foreground">Calculated amount: {formatCurrency(commission.basisAmount * commission.rate / 100)}</p></div><DialogFooter><Button variant="outline" onClick={() => setCommissionOpen(false)}>Cancel</Button><Button onClick={saveCommission} disabled={saving || !commission.payeeName || commission.basisAmount <= 0}>Save</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="grid gap-2"><Label>{label}</Label>{children}</div>; }
