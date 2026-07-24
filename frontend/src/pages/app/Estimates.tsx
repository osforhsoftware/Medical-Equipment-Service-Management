import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Eye, FileText, Loader2, MessageSquare, Plus, Send, Trash2, X } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { ProfessionalDocument } from "@/components/shared/ProfessionalDocument";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { ApiError } from "@/lib/api";
import { useBranch } from "@/context/BranchContext";
import { api, type BackendCatalogItem, type BackendEstimate, type BackendServiceRequest, type EstimateLineInput } from "@/lib/api";
import { useSettings } from "@/context/SettingsContext";
import { defaultDatePlusDays, formatDate, formatCurrency } from "@/lib/format";
import { toast } from "@/hooks/use-toast";

const newLine = (taxRate = 0): EstimateLineInput => ({
  type: "service",
  description: "",
  quantity: 1,
  unitPrice: 0,
  taxRate,
  discount: 0,
});

export default function Estimates() {
  const { branchId } = useBranch();
  const { settings } = useSettings();
  const [estimates, setEstimates] = useState<BackendEstimate[]>([]);
  const [requests, setRequests] = useState<BackendServiceRequest[]>([]);
  const [catalog, setCatalog] = useState<BackendCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<BackendEstimate | null>(null);
  const [preview, setPreview] = useState<BackendEstimate | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    serviceRequestId: "",
    validUntil: defaultDatePlusDays(14),
    status: "draft",
    discount: 0,
    terms: "Payment due as agreed. Parts are subject to availability.",
    notes: "",
    lines: [newLine(settings?.defaultTaxRate ?? 0)],
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [est, sr, services] = await Promise.all([
        api.listEstimates(),
        api.listServiceRequests({ branchId }),
        api.listServiceCatalog(),
      ]);
      setEstimates(est);
      setRequests(sr.filter((r) => ["inspection", "estimate", "approval", "new"].includes(r.status)));
      setCatalog(services.filter((service) => service.isActive));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to load estimates";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const eligibleRequests = useMemo(
    () => requests.filter((r) => ["inspection", "estimate", "approval", "new"].includes(r.status)),
    [requests],
  );

  const saveEstimate = async () => {
    if (!form.serviceRequestId || form.lines.some((line) => !line.description.trim() || line.quantity <= 0)) return;
    setSaving(true);
    try {
      const laborCost = form.lines.filter((line) => line.type !== "part").reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
      const partsCost = form.lines.filter((line) => line.type === "part").reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
      const created = await api.createEstimate({
        serviceRequestId: form.serviceRequestId,
        laborCost,
        partsCost,
        validUntil: form.validUntil,
        status: "draft",
      });
      await api.createEstimateRevision(created.id, {
        lines: form.lines,
        discount: form.discount,
        terms: form.terms,
        notes: form.notes,
      });
      if (form.status === "sent") await api.updateEstimate(created.id, { status: "sent" });
      setDialogOpen(false);
      setForm({ serviceRequestId: "", validUntil: defaultDatePlusDays(14), status: "draft", discount: 0, terms: "Payment due as agreed. Parts are subject to availability.", notes: "", lines: [newLine(settings?.defaultTaxRate ?? 0)] });
      await loadData();
      toast({ title: form.status === "sent" ? "Estimate created and sent" : "Estimate draft created" });
    } catch (err) {
      const message = err instanceof ApiError ? err.errors?.join(", ") || err.message : "Unable to save estimate";
      toast({ title: "Save failed", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const act = async (estimate: BackendEstimate, action: "sent" | "approved" | "rejected" | "revision") => {
    setSaving(true);
    try {
      if (action === "sent") await api.updateEstimate(estimate.id, { status: "sent" });
      else await api.decideEstimate(estimate.id, action, decisionNote || undefined);
      setSelected(null);
      setDecisionNote("");
      await loadData();
      toast({ title: action === "sent" ? "Estimate marked as sent" : `Estimate ${action}` });
    } catch (error) {
      toast({ title: "Workflow update failed", description: error instanceof ApiError ? error.message : "Request failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const openPreview = async (estimate: BackendEstimate) => {
    try {
      setPreview(await api.getEstimate(estimate.id));
    } catch {
      setPreview(estimate);
    }
  };

  const previewLines = (estimate: BackendEstimate) => estimate.lineItems?.length
    ? estimate.lineItems.map((line) => ({ id: line.id, description: `${line.type}: ${line.description}`, quantity: Number(line.quantity), unitPrice: Number(line.unitPrice), discount: Number(line.discount), taxRate: Number(line.taxRate) }))
    : [
      ...(Number(estimate.laborCost) ? [{ id: "labor", description: "Services and labor", quantity: 1, unitPrice: Number(estimate.laborCost), taxRate: 0 }] : []),
      ...(Number(estimate.partsCost) ? [{ id: "parts", description: "Products and parts", quantity: 1, unitPrice: Number(estimate.partsCost), taxRate: 0 }] : []),
    ];

  const columns: Column<BackendEstimate>[] = [
    {
      key: "reference",
      header: "Estimate",
      render: (e) => (
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-accent" />
          <div>
            <p className="font-mono text-sm font-medium">{e.reference}</p>
            <p className="text-xs text-muted-foreground">{e.requestRef} · rev {e.revision}</p>
          </div>
        </div>
      ),
    },
    { key: "customerName", header: "Customer", render: (e) => <span className="text-sm">{e.customerName}</span> },
    { key: "equipmentName", header: "Equipment", render: (e) => <span className="text-sm text-muted-foreground">{e.equipmentName}</span> },
    { key: "laborCost", header: "Labor", render: (e) => <span className="text-sm">{formatCurrency(e.laborCost)}</span> },
    { key: "partsCost", header: "Parts", render: (e) => <span className="text-sm">{formatCurrency(e.partsCost)}</span> },
    { key: "total", header: "Total", render: (e) => <span className="font-semibold">{formatCurrency(e.total)}</span> },
    { key: "validUntil", header: "Valid Until", render: (e) => <span className="text-sm text-muted-foreground">{formatDate(e.validUntil)}</span> },
    { key: "status", header: "Status", render: (e) => <StatusBadge status={e.status} /> },
    { key: "actions" as keyof BackendEstimate, header: "", render: (estimate) => <Button size="icon" variant="ghost" onClick={(event) => { event.stopPropagation(); void openPreview(estimate); }}><Eye className="h-4 w-4" /></Button> },
  ];

  return (
    <RoleGuard roles={["admin", "coordinator", "estimator", "billing"]}>
      <div className="space-y-6">
        <PageHeader
          title="Estimates & Approvals"
          description="Cost estimates with customer approval, rejection and revision workflow."
          actions={
            <Button
              onClick={() => setDialogOpen(true)}
              disabled={eligibleRequests.length === 0}
              variant="brand"
            >
              <Plus className="mr-1 h-4 w-4" /> New Estimate
            </Button>
          }
        />

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading estimates…
          </div>
        ) : (
          <DataTable
            data={estimates}
            columns={columns}
            searchKeys={["reference", "customerName", "equipmentName", "requestRef"]}
            searchPlaceholder="Search estimates…"
            emptyMessage="No estimates yet. Create one from a service request."
            filters={[
              {
                label: "Status",
                options: [
                  { label: "Draft", value: "draft" },
                  { label: "Sent", value: "sent" },
                  { label: "Approved", value: "approved" },
                  { label: "Rejected", value: "rejected" },
                  { label: "Revision", value: "revision" },
                ],
                predicate: (e, v) => e.status === v,
              },
            ]}
            onRowClick={setSelected}
          />
        )}

        <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
          <DialogContent className="sm:max-w-lg">
            {selected && (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-2">
                    <DialogTitle>{selected.reference}</DialogTitle>
                    <StatusBadge status={selected.status} />
                  </div>
                </DialogHeader>
                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <Info label="Request" value={selected.requestRef} />
                  <Info label="Revision" value={String(selected.revision)} />
                  <Info label="Labor" value={formatCurrency(selected.laborCost)} />
                  <Info label="Parts" value={formatCurrency(selected.partsCost)} />
                  <Info label="Total" value={formatCurrency(selected.total)} />
                  <Info label="Valid until" value={formatDate(selected.validUntil)} />
                </div>
                <div className="grid gap-2">
                  <Label>Decision / revision note</Label>
                  <Textarea value={decisionNote} onChange={(event) => setDecisionNote(event.target.value)} placeholder="Optional context for the customer or estimator" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => void openPreview(selected)}><Eye className="mr-1 h-4 w-4" /> Preview</Button>
                  {selected.status === "draft" ? <Button onClick={() => void act(selected, "sent")} disabled={saving}><Send className="mr-1 h-4 w-4" /> Send</Button> : null}
                  {["sent", "revision"].includes(selected.status) ? <>
                    <Button className="bg-success text-success-foreground" onClick={() => void act(selected, "approved")} disabled={saving}><Check className="mr-1 h-4 w-4" /> Approve</Button>
                    <Button variant="outline" onClick={() => void act(selected, "revision")} disabled={saving}><MessageSquare className="mr-1 h-4 w-4" /> Revision</Button>
                    <Button variant="outline" className="text-destructive" onClick={() => void act(selected, "rejected")} disabled={saving}><X className="mr-1 h-4 w-4" /> Reject</Button>
                  </> : null}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
          <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto p-0">
            {preview ? <ProfessionalDocument kind="Estimate" reference={preview.reference} customerName={preview.customerName} issueDate={preview.createdAt} validOrDueLabel="Valid until" validOrDueDate={preview.validUntil} lines={previewLines(preview)} notes={[preview.terms, preview.notes].filter(Boolean).join("\n\n")} /> : null}
          </DialogContent>
        </Dialog>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>New Estimate</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label>Service request</Label>
                <Select value={form.serviceRequestId} onValueChange={(v) => setForm({ ...form, serviceRequestId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select request" /></SelectTrigger>
                  <SelectContent>
                    {eligibleRequests.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.reference} · {r.equipmentName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between"><Label>Service / product lines</Label><Button size="sm" variant="outline" onClick={() => setForm({ ...form, lines: [...form.lines, newLine(settings?.defaultTaxRate ?? 0)] })}><Plus className="mr-1 h-3.5 w-3.5" /> Line</Button></div>
                {form.lines.map((line, index) => <div key={index} className="space-y-2 rounded-xl border p-3">
                  <div className="grid gap-2 sm:grid-cols-[130px_1fr_auto]">
                    <Select value={line.type} onValueChange={(type: EstimateLineInput["type"]) => setForm({ ...form, lines: form.lines.map((item, i) => i === index ? { ...item, type } : item) })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["labor", "part", "transport", "testing", "calibration", "service", "other"].map((type) => <SelectItem key={type} value={type} className="capitalize">{type}</SelectItem>)}</SelectContent></Select>
                    <Select onValueChange={(catalogId) => { const service = catalog.find((item) => item.id === catalogId); if (!service) return; setForm({ ...form, lines: form.lines.map((item, i) => i === index ? { ...item, catalogItemId: service.id, description: service.name, unitPrice: Number(service.unitPrice), taxRate: Number(service.taxRate), type: "service" } : item) }); }}><SelectTrigger><SelectValue placeholder="Use catalog service (optional)" /></SelectTrigger><SelectContent>{catalog.map((item) => <SelectItem key={item.id} value={item.id}>{item.code} · {item.name}</SelectItem>)}</SelectContent></Select>
                    <Button size="icon" variant="ghost" disabled={form.lines.length === 1} onClick={() => setForm({ ...form, lines: form.lines.filter((_, i) => i !== index) })}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  <Input placeholder="Description" value={line.description} onChange={(event) => setForm({ ...form, lines: form.lines.map((item, i) => i === index ? { ...item, description: event.target.value } : item) })} />
                  <div className="grid grid-cols-4 gap-2"><Input aria-label="Quantity" type="number" min={0.01} value={line.quantity} onChange={(event) => setForm({ ...form, lines: form.lines.map((item, i) => i === index ? { ...item, quantity: Number(event.target.value) } : item) })} /><Input aria-label="Unit price" type="number" min={0} value={line.unitPrice} onChange={(event) => setForm({ ...form, lines: form.lines.map((item, i) => i === index ? { ...item, unitPrice: Number(event.target.value) } : item) })} /><Input aria-label="Tax rate" type="number" min={0} max={100} value={line.taxRate} onChange={(event) => setForm({ ...form, lines: form.lines.map((item, i) => i === index ? { ...item, taxRate: Number(event.target.value) } : item) })} /><Input aria-label="Line discount" type="number" min={0} value={line.discount} onChange={(event) => setForm({ ...form, lines: form.lines.map((item, i) => i === index ? { ...item, discount: Number(event.target.value) } : item) })} /></div>
                  <p className="text-xs text-muted-foreground">Quantity · Unit price · Tax % · Discount</p>
                </div>)}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="valid">Valid until</Label>
                  <Input id="valid" type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["draft", "sent", "approved", "rejected", "revision"].map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>Overall discount</Label><Input type="number" min={0} value={form.discount} onChange={(event) => setForm({ ...form, discount: Number(event.target.value) })} /></div>
                <div className="grid gap-2"><Label>Calculated total</Label><Input readOnly value={formatCurrency(Math.max(0, form.lines.reduce((sum, line) => sum + Math.max(0, line.quantity * line.unitPrice - line.discount) * (1 + line.taxRate / 100), 0) - form.discount))} /></div>
              </div>
              <div className="grid gap-2"><Label>Terms</Label><Textarea value={form.terms} onChange={(event) => setForm({ ...form, terms: event.target.value })} /></div>
              <div className="grid gap-2"><Label>Internal / customer notes</Label><Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={saveEstimate} disabled={saving || !form.serviceRequestId}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save estimate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RoleGuard>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
