import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Clock, Eye, IndianRupee, Loader2, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { ProfessionalDocument } from "@/components/shared/ProfessionalDocument";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StatCard } from "@/components/shared/StatCard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { ApiError, api, type BackendInvoice, type BackendServiceJob } from "@/lib/api";
import { defaultDatePlusDays, formatCurrency, formatCurrencyShort, formatDate } from "@/lib/format";
import { toast } from "@/hooks/use-toast";

export default function BillingProfessional() {
  const [invoices, setInvoices] = useState<BackendInvoice[]>([]);
  const [jobs, setJobs] = useState<BackendServiceJob[]>([]);
  const [selected, setSelected] = useState<BackendInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [jobId, setJobId] = useState("");
  const [dueAt, setDueAt] = useState(defaultDatePlusDays(30));
  const [payment, setPayment] = useState({ amount: 0, method: "bank_transfer", reference: "", note: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [invoiceRows, jobRows] = await Promise.all([api.listInvoices(), api.listJobs("completed")]);
      setInvoices(invoiceRows);
      const invoicedJobs = new Set(invoiceRows.map((invoice) => invoice.jobId).filter(Boolean));
      setJobs(jobRows.filter((job) => !invoicedJobs.has(job.id)));
    } catch (error) {
      toast({ title: "Unable to load billing queue", description: error instanceof ApiError ? error.message : "Request failed", variant: "destructive" });
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => ({
    paid: invoices.reduce((sum, invoice) => sum + Number(invoice.paidTotal ?? (invoice.status === "paid" ? invoice.total : 0)), 0),
    due: invoices.reduce((sum, invoice) => sum + Number(invoice.balanceDue ?? (invoice.status === "paid" ? 0 : invoice.total)), 0),
    overdue: invoices.filter((invoice) => invoice.status === "overdue").length,
  }), [invoices]);

  const generate = async () => {
    setSaving(true);
    try {
      await api.createInvoiceFromJob(jobId, new Date(dueAt).toISOString(), "INR");
      setGenerateOpen(false); setJobId(""); await load(); toast({ title: "Invoice generated from completed job" });
    } catch (error) {
      toast({ title: "Invoice generation failed", description: error instanceof ApiError ? error.message : "Request failed", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const openInvoice = async (invoice: BackendInvoice) => {
    try { setSelected(await api.getInvoice(invoice.id)); }
    catch { setSelected(invoice); }
  };

  const markSent = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await api.updateInvoice(selected.id, { status: "sent" });
      setSelected(updated); await load(); toast({ title: "Invoice marked as sent" });
    } catch (error) { toast({ title: "Update failed", description: error instanceof ApiError ? error.message : "Request failed", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const recordPayment = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await api.recordInvoicePayment(selected.id, payment);
      setSelected(updated); setPaymentOpen(false); setPayment({ amount: 0, method: "bank_transfer", reference: "", note: "" }); await load(); toast({ title: "Payment recorded" });
    } catch (error) { toast({ title: "Payment failed", description: error instanceof ApiError ? error.message : "Request failed", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const lines = selected?.lineItems?.map((line) => ({ id: line.id, description: line.description, quantity: Number(line.quantity), unitPrice: Number(line.unitPrice), discount: Number(line.discount), taxRate: Number(line.taxRate) }))
    ?? (selected ? [{ id: "invoice", description: `Service job ${selected.jobRef}`, quantity: 1, unitPrice: Number(selected.amount), taxRate: Number(selected.amount) ? Number(selected.tax) / Number(selected.amount) * 100 : 0 }] : []);

  return <RoleGuard roles={["admin", "billing"]}><div className="space-y-6">
    <PageHeader title="Billing & Invoicing" description="Generate authoritative invoices from completed jobs and record payments." actions={<Button variant="brand" onClick={() => setGenerateOpen(true)} disabled={!jobs.length}><Plus className="mr-1 h-4 w-4" /> Generate from job</Button>} />
    <div className="grid gap-4 sm:grid-cols-3"><StatCard label="Collected" value={formatCurrencyShort(totals.paid)} icon={IndianRupee} accent="success" /><StatCard label="Outstanding" value={formatCurrencyShort(totals.due)} icon={Clock} accent="warning" /><StatCard label="Overdue" value={String(totals.overdue)} icon={AlertCircle} accent="destructive" /></div>
    {jobs.length ? <Card className="border-warning/30"><CardContent className="flex items-center justify-between p-4"><div><p className="font-medium">{jobs.length} completed job{jobs.length === 1 ? "" : "s"} ready for billing</p><p className="text-xs text-muted-foreground">Invoice totals are derived from approved estimates and accepted extras.</p></div><Button variant="outline" onClick={() => setGenerateOpen(true)}>Open queue</Button></CardContent></Card> : null}
    {loading ? <div className="flex justify-center gap-2 py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading invoices…</div> : <Card><CardContent className="overflow-x-auto p-0"><table className="w-full min-w-[800px] text-sm"><thead><tr className="border-b bg-muted/40 text-left"><th className="p-3">Invoice</th><th className="p-3">Customer</th><th className="p-3">Issued</th><th className="p-3">Total</th><th className="p-3">Paid</th><th className="p-3">Balance</th><th className="p-3">Status</th><th /></tr></thead><tbody>{invoices.map((invoice) => <tr key={invoice.id} className="border-b"><td className="p-3"><p className="font-mono font-medium">{invoice.reference}</p><p className="text-xs text-muted-foreground">{invoice.jobRef}</p></td><td className="p-3">{invoice.customerName}</td><td className="p-3">{formatDate(invoice.issuedAt)}</td><td className="p-3 font-semibold">{formatCurrency(invoice.total)}</td><td className="p-3">{formatCurrency(invoice.paidTotal ?? 0)}</td><td className="p-3">{formatCurrency(invoice.balanceDue ?? invoice.total)}</td><td className="p-3"><StatusBadge status={invoice.status} /></td><td className="p-3"><Button size="icon" variant="ghost" onClick={() => void openInvoice(invoice)}><Eye className="h-4 w-4" /></Button></td></tr>)}</tbody></table>{!invoices.length ? <p className="p-10 text-center text-muted-foreground">No invoices generated.</p> : null}</CardContent></Card>}
    <Dialog open={generateOpen} onOpenChange={setGenerateOpen}><DialogContent><DialogHeader><DialogTitle>Generate invoice from completed job</DialogTitle></DialogHeader><div className="grid gap-4 py-2"><Field label="Completed job"><Select value={jobId} onValueChange={setJobId}><SelectTrigger><SelectValue placeholder="Select completed job" /></SelectTrigger><SelectContent>{jobs.map((job) => <SelectItem key={job.id} value={job.id}>{job.reference} · {job.customerName}</SelectItem>)}</SelectContent></Select></Field><Field label="Payment due date"><Input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></Field></div><DialogFooter><Button variant="outline" onClick={() => setGenerateOpen(false)}>Cancel</Button><Button onClick={generate} disabled={saving || !jobId || !dueAt}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Generate</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}><DialogContent className="max-h-[94vh] max-w-4xl overflow-y-auto p-0">{selected ? <><ProfessionalDocument kind="Invoice" reference={selected.reference} customerName={selected.customerName} issueDate={selected.issuedAt} validOrDueLabel="Due date" validOrDueDate={selected.dueAt} lines={lines}><div className="no-print mt-6 flex flex-wrap justify-end gap-2 border-t pt-4">{selected.status === "draft" ? <Button onClick={markSent} disabled={saving}>Mark sent</Button> : null}{selected.status !== "draft" && Number(selected.balanceDue ?? selected.total) > 0 ? <Button onClick={() => { setPayment({ ...payment, amount: Number(selected.balanceDue ?? selected.total) }); setPaymentOpen(true); }}>Record payment</Button> : null}</div></ProfessionalDocument></> : null}</DialogContent></Dialog>
    <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}><DialogContent><DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader><div className="grid gap-3 py-2"><Field label="Amount"><Input type="number" min={0.01} max={Number(selected?.balanceDue ?? selected?.total ?? 0)} value={payment.amount} onChange={(event) => setPayment({ ...payment, amount: Number(event.target.value) })} /></Field><Field label="Method"><Select value={payment.method} onValueChange={(method) => setPayment({ ...payment, method })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bank_transfer">Bank transfer</SelectItem><SelectItem value="card">Card</SelectItem><SelectItem value="cash">Cash</SelectItem><SelectItem value="upi">UPI</SelectItem><SelectItem value="cheque">Cheque</SelectItem></SelectContent></Select></Field><Field label="Reference"><Input value={payment.reference} onChange={(event) => setPayment({ ...payment, reference: event.target.value })} /></Field><Field label="Note"><Textarea value={payment.note} onChange={(event) => setPayment({ ...payment, note: event.target.value })} /></Field></div><DialogFooter><Button variant="outline" onClick={() => setPaymentOpen(false)}>Cancel</Button><Button onClick={recordPayment} disabled={saving || payment.amount <= 0}>Record</Button></DialogFooter></DialogContent></Dialog>
  </div></RoleGuard>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="grid gap-2"><Label>{label}</Label>{children}</div>; }
