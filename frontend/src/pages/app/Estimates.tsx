import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, FileText, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable, type Column } from "@/components/shared/DataTable";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { ApiError } from "@/lib/api";
import { useBranch } from "@/context/BranchContext";
import { api, type BackendEstimate, type BackendServiceRequest } from "@/lib/api";
import { defaultDatePlusDays, formatDate, formatCurrency } from "@/lib/format";
import { toast } from "@/hooks/use-toast";

export default function Estimates() {
  const { branchId } = useBranch();
  const [estimates, setEstimates] = useState<BackendEstimate[]>([]);
  const [requests, setRequests] = useState<BackendServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<BackendEstimate | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    serviceRequestId: "",
    laborCost: "",
    partsCost: "",
    validUntil: defaultDatePlusDays(14),
    status: "draft",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [est, sr] = await Promise.all([
        api.listEstimates(),
        api.listServiceRequests({ branchId }),
      ]);
      setEstimates(est);
      setRequests(sr.filter((r) => ["inspection", "estimate", "approval", "new"].includes(r.status)));
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
    if (!form.serviceRequestId) return;
    setSaving(true);
    try {
      await api.createEstimate({
        serviceRequestId: form.serviceRequestId,
        laborCost: Number(form.laborCost) || 0,
        partsCost: Number(form.partsCost) || 0,
        validUntil: form.validUntil,
        status: form.status,
      });
      toast({ title: "Estimate created", description: "Estimate saved to the database." });
      setDialogOpen(false);
      setForm({ serviceRequestId: "", laborCost: "", partsCost: "", validUntil: defaultDatePlusDays(14), status: "draft" });
      await loadData();
    } catch (err) {
      const message = err instanceof ApiError ? err.errors?.join(", ") || err.message : "Unable to save estimate";
      toast({ title: "Save failed", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

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
              className="bg-gradient-primary text-primary-foreground hover:opacity-90"
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

        <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
          <SheetContent className="w-full overflow-y-auto sm:max-w-md">
            {selected && (
              <>
                <SheetHeader>
                  <div className="flex items-center gap-2">
                    <SheetTitle>{selected.reference}</SheetTitle>
                    <StatusBadge status={selected.status} />
                  </div>
                  <SheetDescription>{selected.customerName} · {selected.equipmentName}</SheetDescription>
                </SheetHeader>
                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <Info label="Request" value={selected.requestRef} />
                  <Info label="Revision" value={String(selected.revision)} />
                  <Info label="Labor" value={formatCurrency(selected.laborCost)} />
                  <Info label="Parts" value={formatCurrency(selected.partsCost)} />
                  <Info label="Total" value={formatCurrency(selected.total)} />
                  <Info label="Valid until" value={formatDate(selected.validUntil)} />
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
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
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="labor">Labor cost (₹)</Label>
                  <Input id="labor" type="number" min={0} value={form.laborCost} onChange={(e) => setForm({ ...form, laborCost: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="parts">Parts cost (₹)</Label>
                  <Input id="parts" type="number" min={0} value={form.partsCost} onChange={(e) => setForm({ ...form, partsCost: e.target.value })} />
                </div>
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
