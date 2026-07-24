import { useEffect, useState } from "react";
import { Bell, Loader2, Plus, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
import { api, type BackendAmcContract } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { toast } from "@/hooks/use-toast";

type FormState = {
  reference: string;
  customerName: string;
  equipmentCount: string;
  startDate: string;
  endDate: string;
  value: string;
  visitsPerYear: string;
};

const emptyForm: FormState = {
  reference: "",
  customerName: "",
  equipmentCount: "1",
  startDate: "",
  endDate: "",
  value: "0",
  visitsPerYear: "4",
};

export default function AMC() {
  const [contracts, setContracts] = useState<BackendAmcContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.listAmcContracts();
      setContracts(data);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to load AMC contracts";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.createAmcContract({
        reference: form.reference,
        customerName: form.customerName,
        equipmentCount: parseInt(form.equipmentCount) || 1,
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
        value: parseFloat(form.value) || 0,
        visitsPerYear: parseInt(form.visitsPerYear) || 4,
        status: "active",
      });
      toast({ title: "Contract created", description: `${form.reference} added successfully.` });
      setDialogOpen(false);
      setForm(emptyForm);
      await load();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Unable to save contract";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const expiring = contracts.filter((a) => a.status === "expiring");

  const columns: Column<BackendAmcContract>[] = [
    {
      key: "reference",
      header: "Contract",
      render: (a) => (
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <div>
            <p className="font-mono text-sm font-medium">{a.reference}</p>
            <p className="text-xs text-muted-foreground">{a.customerName}</p>
          </div>
        </div>
      ),
    },
    { key: "equipmentCount", header: "Equipment", render: (a) => <span className="font-medium">{a.equipmentCount}</span> },
    {
      key: "startDate",
      header: "Term",
      render: (a) => (
        <span className="text-sm text-muted-foreground">
          {new Date(a.startDate).toLocaleDateString()} → {new Date(a.endDate).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "visitsDone",
      header: "Visits",
      render: (a) => (
        <div className="w-28">
          <div className="flex justify-between text-xs">
            <span>{a.visitsDone}/{a.visitsPerYear}</span>
          </div>
          <Progress value={(a.visitsDone / Math.max(a.visitsPerYear, 1)) * 100} className="mt-1 h-1.5" />
        </div>
      ),
    },
    { key: "value", header: "Value", render: (a) => <span className="font-semibold">{formatCurrency(Number(a.value))}</span> },
    { key: "status", header: "Status", render: (a) => <StatusBadge status={a.status} /> },
  ];

  return (
    <RoleGuard roles={["admin", "coordinator", "billing"]}>
      <div className="space-y-6">
        <PageHeader
          title="AMC Contracts"
          description="Annual Maintenance Contracts with renewal reminders."
          actions={
            <Button onClick={() => { setForm(emptyForm); setDialogOpen(true); }} variant="brand">
              <Plus className="mr-1 h-4 w-4" /> New Contract
            </Button>
          }
        />

        {expiring.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning-foreground">
            <Bell className="h-4 w-4" /> {expiring.length} contract(s) expiring soon — send renewal reminders.
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading contracts…
          </div>
        ) : (
          <DataTable
            data={contracts}
            columns={columns}
            searchKeys={["reference", "customerName"]}
            searchPlaceholder="Search contracts…"
            filters={[
              {
                label: "Status",
                options: [
                  { label: "Active", value: "active" },
                  { label: "Expiring", value: "expiring" },
                  { label: "Expired", value: "expired" },
                ],
                predicate: (a, v) => a.status === v,
              },
            ]}
            onRowClick={(a) => toast({ title: a.reference, description: `${a.customerName} · ${a.equipmentCount} equipment` })}
          />
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New AMC Contract</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Reference</Label>
                <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="AMC-2026-001" />
              </div>
              <div className="grid gap-2">
                <Label>Customer Name</Label>
                <Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Start Date</Label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>End Date</Label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label>Equipment</Label>
                <Input type="number" min="1" value={form.equipmentCount} onChange={(e) => setForm({ ...form, equipmentCount: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Value (₹)</Label>
                <Input type="number" min="0" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Visits/Year</Label>
                <Input type="number" min="1" value={form.visitsPerYear} onChange={(e) => setForm({ ...form, visitsPerYear: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Create Contract
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleGuard>
  );
}
