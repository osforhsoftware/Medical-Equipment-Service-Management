import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { Plus, AlertCircle, Loader2, X } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import {
  api,
  type BackendCustomer,
  type BackendEquipment,
  type BackendServiceRequest,
  type BackendUser,
} from "@/lib/api";
import { formatServiceStatus } from "@/lib/format";
import { formatFixedOption, SERVICE_TYPE_OPTIONS } from "@/lib/fixedOptions";
import { roleLabels } from "@/data/mock";
import type { Role } from "@/data/types";
import { toast } from "@/lib/toast";

function formatServiceType(type: string, typeOther?: string | null) {
  return formatFixedOption(SERVICE_TYPE_OPTIONS, type, typeOther);
}

const STATUS_COLOR: Record<string, string> = {
  new: "border-info/20 bg-info/10 text-info",
  inspection: "border-warning/25 bg-warning/12 text-warning-foreground",
  estimate: "border-accent/20 bg-accent/10 text-accent",
  approval: "border-primary/20 bg-primary/10 text-primary",
  "in-progress": "border-accent/20 bg-accent/12 text-accent",
  inProgress: "border-accent/20 bg-accent/12 text-accent",
  completed: "border-success/20 bg-success/12 text-success",
  invoiced: "border-success/20 bg-success/12 text-success",
};

const columns = [
  { status: "new", label: "New" },
  { status: "inspection", label: "Inspection" },
  { status: "estimate", label: "Estimate" },
  { status: "approval", label: "Approval" },
  { status: "in-progress", label: "In Progress" },
  { status: "completed", label: "Completed" },
] as const;

const ASSIGNABLE_ROLES: Role[] = ["coordinator", "inspector", "estimator", "engineer", "inventory", "billing"];

const schema = z.object({
  customerId: z.string().min(1, "Select a customer"),
  type: z.string().min(1, "Select a type"),
  typeOther: z.string().optional(),
  priority: z.string().min(1, "Select priority"),
  description: z.string().trim().min(10, "Describe the issue (min 10 chars)").max(500),
}).superRefine((data, ctx) => {
  if (data.type === "Other" && !data.typeOther?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["typeOther"], message: "Please specify the service type" });
  }
});

const CLOSED_STATUSES = new Set(["completed", "invoiced", "finished"]);

function isOverdueRequest(r: BackendServiceRequest): boolean {
  if (CLOSED_STATUSES.has(r.status)) return false;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return new Date(r.slaDue) < start;
}

export default function ServiceRequests() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const overdueOnly = searchParams.get("filter") === "overdue";
  const [requests, setRequests] = useState<BackendServiceRequest[]>([]);
  const [customers, setCustomers] = useState<BackendCustomer[]>([]);
  const [equipment, setEquipment] = useState<BackendEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Create form
  const [form, setForm] = useState({
    customerId: "",
    type: "",
    typeOther: "",
    priority: "",
    description: "",
    assignRole: "" as Role | "",
  });
  const [selectedEquipIds, setSelectedEquipIds] = useState<string[]>([]);
  const [assignRole, setAssignRole] = useState<Role | "">("");
  const [staffByRole, setStaffByRole] = useState<BackendUser[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<BackendUser | null>(null);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const canCreate = user?.role === "coordinator" || user?.role === "admin";

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listServiceRequests();
      setRequests(data);
    } catch (err) {
      toast.apiError(err, { fallback: "Failed to load service requests" });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLookups = useCallback(async () => {
    try {
      const [c, e] = await Promise.all([
        api.listCustomers(),
        api.listEquipment(),
      ]);
      setCustomers(c.filter((x) => x.status === "active"));
      setEquipment(e);
    } catch {
      /* optional */
    }
  }, []);

  useEffect(() => { void loadRequests(); }, [loadRequests]);
  useEffect(() => { void loadLookups(); }, [loadLookups]);

  // Multi-equipment toggling
  const toggleEquip = (id: string) => {
    setSelectedEquipIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  // Load staff when assignRole changes (create form)
  useEffect(() => {
    if (!assignRole) {
      setStaffByRole([]);
      setSelectedStaff(null);
      return;
    }
    setLoadingStaff(true);
    api.listUsers({ role: assignRole, isActive: true })
      .then(setStaffByRole)
      .catch(() => setStaffByRole([]))
      .finally(() => setLoadingStaff(false));
  }, [assignRole]);

  const submit = async () => {
    const result = schema.safeParse(form);
    if (!result.success) {
      const e: Record<string, string> = {};
      result.error.issues.forEach((i) => (e[i.path[0] as string] = i.message));
      setErrors(e);
      return;
    }
    if (selectedEquipIds.length === 0) {
      setErrors((e) => ({ ...e, equipment: "Select at least one equipment item" }));
      return;
    }
    if (assignRole && !selectedStaff) {
      setErrors((e) => ({ ...e, assignedStaff: "Select a staff member or clear the role" }));
      return;
    }
    setSaving(true);
    try {
      await api.createServiceRequest({
        customerId: result.data.customerId,
        type: result.data.type,
        typeOther: result.data.type === "Other" ? result.data.typeOther?.trim() || null : null,
        priority: result.data.priority,
        description: result.data.description,
        equipmentIds: selectedEquipIds,
        ...(selectedStaff
          ? { assignedTo: selectedStaff.id, assignedName: selectedStaff.name }
          : {}),
      });
      toast({ title: "Service request created", description: "Request added to the New column." });
      setErrors({});
      setOpen(false);
      resetCreateForm();
      await loadRequests();
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to create request" });
    } finally {
      setSaving(false);
    }
  };

  const resetCreateForm = () => {
    setForm({ customerId: "", type: "", typeOther: "", priority: "", description: "", assignRole: "" });
    setSelectedEquipIds([]);
    setAssignRole("");
    setSelectedStaff(null);
    setStaffByRole([]);
  };

  const filteredEquipment = equipment.filter((e) => !form.customerId || e.customerId === form.customerId);
  const visibleRequests = overdueOnly ? requests.filter(isOverdueRequest) : requests;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Service Tickets"
        description={
          overdueOnly
            ? "Open tickets past their SLA due date."
            : "End-to-end service tickets from intake through inspection, estimate, job, and billing."
        }
        actions={
          canCreate ? (
            <Button
              onClick={() => { resetCreateForm(); setOpen(true); }}
              variant="brand"
            >
              <Plus className="mr-1 h-4 w-4" /> New Ticket
            </Button>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <AlertCircle className="h-3.5 w-3.5" /> Only coordinators create requests
            </span>
          )
        }
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading service requests…
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {columns.map((col) => {
            const items = visibleRequests.filter((r) => formatServiceStatus(r.status) === col.status);
            const colorClass = STATUS_COLOR[col.status] ?? "";
            return (
              <div key={col.status} className="flex min-w-0 flex-col rounded-2xl border border-border/70 bg-card/55 p-3 shadow-sm backdrop-blur">
                <div className="mb-3 flex items-center justify-between px-1">
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${colorClass}`}>{col.label}</span>
                  <span className="rounded-full border border-primary/10 bg-secondary px-2.5 py-0.5 text-xs font-semibold text-primary">
                    {items.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {items.map((r) => {
                    const allEquip = r.equipmentItems?.length
                      ? r.equipmentItems.map((e) => e.equipmentName).join(", ")
                      : (r.equipmentName ?? "No equipment");
                    return (
                      <Card
                        key={r.id}
                        onClick={() => navigate(`/app/service-tickets/${r.id}`)}
                        className="cursor-pointer space-y-2 p-3 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-elevated"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs text-muted-foreground">{r.reference}</span>
                          <StatusBadge status={r.priority} />
                        </div>
                        <p className="line-clamp-2 text-sm font-medium leading-snug">{allEquip}</p>
                        <p className="text-xs text-muted-foreground">{r.customerName}</p>
                        <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
                          <span>{formatServiceType(r.type, r.typeOther)}</span>
                          <span className="truncate max-w-[90px] text-right">{r.assignedName ?? r.assignedTo ?? "Unassigned"}</span>
                        </div>
                      </Card>
                    );
                  })}
                  {items.length === 0 && (
                    <p className="px-1 py-6 text-center text-xs text-muted-foreground">No requests</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create Dialog ── */}
      <Dialog open={open} onOpenChange={(o) => { if (!o) resetCreateForm(); setOpen(o); }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Service Ticket</DialogTitle>
            <DialogDescription>Created on behalf of a customer.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Customer</Label>
              <Select value={form.customerId} onValueChange={(v) => { setForm({ ...form, customerId: v }); setSelectedEquipIds([]); }}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.customerId && <p className="text-xs text-destructive">{errors.customerId}</p>}
            </div>

            {/* Multi-select equipment */}
            <div className="grid gap-2">
              <Label>Equipment <span className="text-muted-foreground text-xs">(select one or more)</span></Label>
              {selectedEquipIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedEquipIds.map((id) => {
                    const eq = equipment.find((e) => e.id === id);
                    return (
                      <span key={id} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                        {eq?.name ?? id}
                        <button type="button" onClick={() => toggleEquip(id)} className="ml-0.5 hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              <div className="max-h-36 overflow-y-auto rounded-lg border border-border">
                {filteredEquipment.length === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground">
                    {form.customerId ? "No equipment for this customer." : "Select a customer first."}
                  </p>
                ) : (
                  filteredEquipment.map((e) => {
                    const checked = selectedEquipIds.includes(e.id);
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => toggleEquip(e.id)}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-muted/50 ${checked ? "bg-primary/5" : ""}`}
                      >
                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? "border-primary bg-primary" : "border-border"}`}>
                          {checked && <span className="h-2 w-2 rounded-sm bg-white" />}
                        </span>
                        <span className="font-medium">{e.name}</span>
                        <span className="ml-auto text-xs text-muted-foreground">{e.assetTag}</span>
                      </button>
                    );
                  })
                )}
              </div>
              {errors.equipment && <p className="text-xs text-destructive">{errors.equipment}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) =>
                    setForm({ ...form, type: v, typeOther: v === "Other" ? form.typeOther : "" })
                  }
                >
                  <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPE_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.type && <p className="text-xs text-destructive">{errors.type}</p>}
              </div>
              <div className="grid gap-2">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
                  <SelectContent>
                    {["low", "medium", "high", "critical"].map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.priority && <p className="text-xs text-destructive">{errors.priority}</p>}
              </div>
            </div>
            {form.type === "Other" && (
              <div className="grid gap-2">
                <Label htmlFor="sr-type-other">Specify type</Label>
                <Input
                  id="sr-type-other"
                  value={form.typeOther}
                  onChange={(e) => setForm({ ...form, typeOther: e.target.value })}
                  placeholder="e.g. Relocation, Decommission"
                />
                {errors.typeOther && <p className="text-xs text-destructive">{errors.typeOther}</p>}
              </div>
            )}

            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Describe the reported issue…"
                rows={3}
              />
              {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
            </div>

            {/* Role-based assignment */}
            <div className="rounded-lg border border-border p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Assign Work <span className="font-normal normal-case text-muted-foreground">(optional — assign later if needed)</span>
              </p>
              <div className="grid gap-2">
                <Label>Select Role</Label>
                <Select
                  value={assignRole}
                  onValueChange={(v) => {
                    setAssignRole(v as Role);
                    setSelectedStaff(null);
                    setErrors((e) => ({ ...e, assignRole: "", assignedStaff: "" }));
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Choose a role…" /></SelectTrigger>
                  <SelectContent>
                    {ASSIGNABLE_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.assignRole && <p className="text-xs text-destructive">{errors.assignRole}</p>}
              </div>
              {assignRole && (
                <div className="grid gap-2">
                  <Label>
                    Assign to — {roleLabels[assignRole as Role]}
                  </Label>
                  {loadingStaff ? (
                    <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading staff…
                    </div>
                  ) : staffByRole.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-1">No active staff for this role.</p>
                  ) : (
                    <Select
                      value={selectedStaff?.id ?? ""}
                      onValueChange={(v) => {
                        const staff = staffByRole.find((s) => s.id === v) ?? null;
                        setSelectedStaff(staff);
                        setErrors((e) => ({ ...e, assignedStaff: "" }));
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger>
                      <SelectContent>
                        {staffByRole.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {errors.assignedStaff && <p className="text-xs text-destructive">{errors.assignedStaff}</p>}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetCreateForm(); setOpen(false); }}>Cancel</Button>
            <Button onClick={submit} disabled={saving} variant="brand">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
