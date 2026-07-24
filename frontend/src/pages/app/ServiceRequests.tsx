import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { Plus, AlertCircle, Loader2, X, ChevronRight, CheckCircle2, Circle, UserCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
import { useBranch } from "@/context/BranchContext";
import {
  api,
  ApiError,
  type BackendCustomer,
  type BackendEquipment,
  type BackendServiceRequest,
  type BackendTimelineEvent,
  type BackendUser,
} from "@/lib/api";
import { formatDate, formatDateTime, formatServiceStatus } from "@/lib/format";
import { roleLabels } from "@/data/mock";
import type { Role } from "@/data/types";
import { toast } from "@/hooks/use-toast";

const WORKFLOW_STEPS = [
  { status: "new", label: "New" },
  { status: "inspection", label: "Inspection" },
  { status: "estimate", label: "Estimate" },
  { status: "approval", label: "Approval" },
  { status: "inProgress", label: "In Progress" },
  { status: "invoiced", label: "Invoiced" },
  { status: "completed", label: "Completed" },
] as const;

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
  priority: z.string().min(1, "Select priority"),
  description: z.string().trim().min(10, "Describe the issue (min 10 chars)").max(500),
});

export default function ServiceRequests() {
  const { user } = useAuth();
  const { branchId } = useBranch();
  const [requests, setRequests] = useState<BackendServiceRequest[]>([]);
  const [customers, setCustomers] = useState<BackendCustomer[]>([]);
  const [equipment, setEquipment] = useState<BackendEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<BackendServiceRequest | null>(null);
  const [timeline, setTimeline] = useState<BackendTimelineEvent[]>([]);
  const [saving, setSaving] = useState(false);

  // Create form
  const [form, setForm] = useState({
    customerId: "",
    type: "",
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

  // Workflow advance dialog
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [workflowStatus, setWorkflowStatus] = useState("");
  const [workflowNote, setWorkflowNote] = useState("");
  const [workflowSaving, setWorkflowSaving] = useState(false);

  // Assign dialog
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignRole2, setAssignRole2] = useState<Role | "">("");
  const [assignStaff, setAssignStaff] = useState<BackendUser[]>([]);
  const [assignTarget, setAssignTarget] = useState<BackendUser | null>(null);
  const [assignNote, setAssignNote] = useState("");
  const [assignSaving, setAssignSaving] = useState(false);
  const [loadingAssignStaff, setLoadingAssignStaff] = useState(false);

  const canCreate = user?.role === "coordinator" || user?.role === "admin";
  const canAssign = user?.role === "admin" || user?.role === "coordinator";

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listServiceRequests({ branchId });
      setRequests(data);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to load service requests";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  const loadLookups = useCallback(async () => {
    try {
      const [c, e] = await Promise.all([
        api.listCustomers(branchId),
        api.listEquipment({ branchId }),
      ]);
      setCustomers(c.filter((x) => x.status === "active"));
      setEquipment(e);
    } catch {
      /* optional */
    }
  }, [branchId]);

  useEffect(() => { void loadRequests(); }, [loadRequests]);
  useEffect(() => { void loadLookups(); }, [loadLookups]);

  const openDetail = async (r: BackendServiceRequest) => {
    setSelected(r);
    try {
      const events = await api.getServiceRequestTimeline(r.id);
      setTimeline(events);
    } catch {
      setTimeline([]);
    }
  };

  const refreshSelected = async (id: string) => {
    const [events] = await Promise.all([
      api.getServiceRequestTimeline(id),
    ]);
    setTimeline(events);
    await loadRequests();
    const fresh = requests.find((r) => r.id === id);
    if (fresh) setSelected(fresh);
  };

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

  // Load staff for assign dialog
  useEffect(() => {
    if (!assignRole2) {
      setAssignStaff([]);
      setAssignTarget(null);
      return;
    }
    setLoadingAssignStaff(true);
    api.listUsers({ role: assignRole2, isActive: true })
      .then(setAssignStaff)
      .catch(() => setAssignStaff([]))
      .finally(() => setLoadingAssignStaff(false));
  }, [assignRole2]);

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
        ...result.data,
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
      const message = err instanceof ApiError ? err.errors?.join(", ") || err.message : "Unable to create request";
      toast({ title: "Save failed", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const resetCreateForm = () => {
    setForm({ customerId: "", type: "", priority: "", description: "", assignRole: "" });
    setSelectedEquipIds([]);
    setAssignRole("");
    setSelectedStaff(null);
    setStaffByRole([]);
  };

  const submitWorkflow = async () => {
    if (!selected || !workflowNote.trim()) return;
    setWorkflowSaving(true);
    try {
      await api.advanceWorkflow(selected.id, { status: workflowStatus, note: workflowNote });
      toast({ title: "Status updated", description: `Moved to ${workflowStatus}.` });
      setWorkflowOpen(false);
      setWorkflowNote("");
      await refreshSelected(selected.id);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to update";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setWorkflowSaving(false);
    }
  };

  const submitAssign = async () => {
    if (!selected || !assignTarget) return;
    setAssignSaving(true);
    try {
      await api.assignServiceRequest(selected.id, {
        assignedTo: assignTarget.id,
        note: assignNote || undefined,
      });
      toast({ title: "Assigned", description: `Work assigned to ${assignTarget.name}.` });
      setAssignOpen(false);
      setAssignNote("");
      setAssignRole2("");
      setAssignTarget(null);
      await refreshSelected(selected.id);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to assign";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setAssignSaving(false);
    }
  };

  const currentStepIndex = selected
    ? WORKFLOW_STEPS.findIndex((s) => s.status === selected.status || (s.status === "inProgress" && formatServiceStatus(selected.status) === "in-progress"))
    : -1;

  const filteredEquipment = equipment.filter((e) => !form.customerId || e.customerId === form.customerId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Service Requests"
        description="Coordinator-created requests tracked through the full service workflow."
        actions={
          canCreate ? (
            <Button
              onClick={() => { resetCreateForm(); setOpen(true); }}
              variant="brand"
            >
              <Plus className="mr-1 h-4 w-4" /> New Request
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
            const items = requests.filter((r) => formatServiceStatus(r.status) === col.status);
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
                        onClick={() => void openDetail(r)}
                        className="cursor-pointer space-y-2 p-3 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-elevated"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs text-muted-foreground">{r.reference}</span>
                          <StatusBadge status={r.priority} />
                        </div>
                        <p className="line-clamp-2 text-sm font-medium leading-snug">{allEquip}</p>
                        <p className="text-xs text-muted-foreground">{r.customerName}</p>
                        <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
                          <span>{r.type}</span>
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
            <DialogTitle>New Service Request</DialogTitle>
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
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                  <SelectContent>
                    {["Repair", "Maintenance", "Calibration", "Inspection", "Installation"].map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
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

      {/* ── Detail Sheet ── */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selected && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2 flex-wrap">
                  <SheetTitle>{selected.reference}</SheetTitle>
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLOR[formatServiceStatus(selected.status)] ?? ""}`}>
                    {formatServiceStatus(selected.status).replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </span>
                </div>
                <SheetDescription>
                  {selected.equipmentItems?.length
                    ? selected.equipmentItems.map((e) => e.equipmentName).join(" · ")
                    : (selected.equipmentName ?? "No equipment")}
                  {" · "}{selected.customerName}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-5 space-y-5 text-sm">
                {/* Workflow stepper */}
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Workflow Progress</p>
                  <div className="flex items-center gap-0 overflow-x-auto pb-1">
                    {WORKFLOW_STEPS.map((step, idx) => {
                      const done = idx < currentStepIndex;
                      const active = idx === currentStepIndex;
                      return (
                        <div key={step.status} className="flex items-center shrink-0">
                          <div className={`flex flex-col items-center gap-1 ${active ? "text-primary" : done ? "text-success" : "text-muted-foreground"}`}>
                            {done ? (
                              <CheckCircle2 className="h-4 w-4 text-success" />
                            ) : active ? (
                              <div className="h-4 w-4 rounded-full border-2 border-primary bg-primary/20" />
                            ) : (
                              <Circle className="h-4 w-4" />
                            )}
                            <span className="text-[10px] font-medium whitespace-nowrap">{step.label}</span>
                          </div>
                          {idx < WORKFLOW_STEPS.length - 1 && (
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground mx-0.5 shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {canCreate && currentStepIndex < WORKFLOW_STEPS.length - 1 && (
                    <Button
                      size="sm"
                      className="mt-3 bg-gradient-primary text-primary-foreground hover:opacity-90"
                      onClick={() => {
                        const next = WORKFLOW_STEPS[currentStepIndex + 1];
                        if (next) { setWorkflowStatus(next.status); setWorkflowNote(""); setWorkflowOpen(true); }
                      }}
                    >
                      Move to {WORKFLOW_STEPS[currentStepIndex + 1]?.label ?? "Next Stage"}
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Info label="Type" value={selected.type} />
                  <Info label="Priority" value={selected.priority} />
                  <Info label="Created by" value={selected.createdBy} />
                  <Info label="Assigned to" value={selected.assignedName ?? selected.assignedTo ?? "Unassigned"} />
                  <Info label="Created" value={formatDate(selected.createdAt)} />
                  <Info label="SLA due" value={formatDate(selected.slaDue)} />
                </div>

                {selected.equipmentItems && selected.equipmentItems.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Equipment ({selected.equipmentItems.length})</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.equipmentItems.map((e) => (
                        <Badge key={e.id} variant="secondary" className="text-xs">{e.equipmentName}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Description</p>
                  <p className="rounded-lg bg-muted/50 p-3">{selected.description}</p>
                </div>

                {canAssign && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => { setAssignOpen(true); setAssignRole2(""); setAssignTarget(null); setAssignNote(""); }}
                  >
                    <UserCheck className="mr-1.5 h-4 w-4" /> Assign / Reassign Staff
                  </Button>
                )}

                <div>
                  <p className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Activity Timeline</p>
                  {timeline.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No timeline events yet.</p>
                  ) : (
                    <ol className="relative space-y-4 border-l border-border pl-4">
                      {timeline.map((t) => (
                        <li key={t.id} className="relative">
                          <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
                          <p className="font-medium">{t.action}</p>
                          {t.note && <p className="text-xs text-muted-foreground">{t.note}</p>}
                          <p className="text-xs text-muted-foreground">{t.actor} · {formatDateTime(t.at)}</p>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Workflow Advance Dialog ── */}
      <Dialog open={workflowOpen} onOpenChange={setWorkflowOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Move to {workflowStatus.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}</DialogTitle>
            <DialogDescription>Add a note before advancing the workflow stage.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid gap-2">
              <Label>Note / Comment <span className="text-destructive">*</span></Label>
              <Textarea
                value={workflowNote}
                onChange={(e) => setWorkflowNote(e.target.value)}
                placeholder="Describe what was done or found…"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWorkflowOpen(false)}>Cancel</Button>
            <Button
              onClick={submitWorkflow}
              disabled={workflowSaving || !workflowNote.trim()}
              variant="brand"
            >
              {workflowSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Advance Stage
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Assign Dialog ── */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign / Reassign Staff</DialogTitle>
            <DialogDescription>Select a role then pick the staff member to assign this request to.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label>Select Role</Label>
              <Select value={assignRole2} onValueChange={(v) => { setAssignRole2(v as Role); setAssignTarget(null); }}>
                <SelectTrigger><SelectValue placeholder="Choose a role…" /></SelectTrigger>
                <SelectContent>
                  {ASSIGNABLE_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {assignRole2 && (
              <div className="grid gap-2">
                <Label>Staff — {roleLabels[assignRole2 as Role]} <span className="text-destructive">*</span></Label>
                {loadingAssignStaff ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading staff…
                  </div>
                ) : assignStaff.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No active staff for this role.</p>
                ) : (
                  <Select
                    value={assignTarget?.id ?? ""}
                    onValueChange={(v) => setAssignTarget(assignStaff.find((s) => s.id === v) ?? null)}
                  >
                    <SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger>
                    <SelectContent>
                      {assignStaff.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            <div className="grid gap-2">
              <Label>Note (optional)</Label>
              <Input
                value={assignNote}
                onChange={(e) => setAssignNote(e.target.value)}
                placeholder="Why this assignment?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button
              onClick={submitAssign}
              disabled={assignSaving || !assignTarget}
              variant="brand"
            >
              {assignSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium capitalize">{value}</p>
    </div>
  );
}
