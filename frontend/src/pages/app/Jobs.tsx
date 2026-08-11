import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
import { useAuth } from "@/context/AuthContext";
import { api, type BackendServiceJob, type BackendServiceRequest, type BackendUser } from "@/lib/api";
import { formatFixedOption, SERVICE_TYPE_OPTIONS } from "@/lib/fixedOptions";
import { formatJobStatus, todayInputValue } from "@/lib/format";
import { roleLabels } from "@/data/mock";
import type { Role } from "@/data/types";
import { toast } from "@/lib/toast";

const columns = [
  { status: "scheduled", label: "Scheduled" },
  { status: "in-progress", label: "In Progress" },
  { status: "parts-pending", label: "Parts Pending" },
  { status: "review", label: "Review" },
  { status: "completed", label: "Completed" },
] as const;

const ASSIGNABLE_JOB_ROLES: Role[] = ["coordinator", "engineer"];

export default function Jobs() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<BackendServiceJob[]>([]);
  const [requests, setRequests] = useState<BackendServiceRequest[]>([]);
  const [assignableStaff, setAssignableStaff] = useState<BackendUser[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ serviceRequestId: "", engineerId: "", scheduledFor: todayInputValue() });

  const isEngineer = user?.role === "engineer";
  const canCreate = user?.role === "admin" || user?.role === "coordinator";

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      setJobs(await api.listJobs());
    } catch (err) {
      toast.apiError(err, { fallback: "Failed to load jobs" });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRequests = useCallback(async () => {
    try {
      const data = await api.listServiceRequests();
      setRequests(data.filter((r) => ["approval", "estimate", "inProgress"].includes(r.status)));
    } catch {
      setRequests([]);
    }
  }, []);

  const loadAssignableStaff = useCallback(async () => {
    setLoadingStaff(true);
    try {
      const lists = await Promise.all(
        ASSIGNABLE_JOB_ROLES.map((role) => api.listUsers({ role, isActive: true })),
      );
      setAssignableStaff(lists.flat().sort((a, b) => a.name.localeCompare(b.name)));
    } catch {
      setAssignableStaff([]);
    } finally {
      setLoadingStaff(false);
    }
  }, []);

  useEffect(() => {
    void loadJobs();
    void loadRequests();
  }, [loadJobs, loadRequests]);

  useEffect(() => {
    if (dialogOpen) void loadAssignableStaff();
  }, [dialogOpen, loadAssignableStaff]);

  const openScheduleDialog = () => {
    const defaultEngineerId = assignableStaff.find((s) => s.id === user?.id)?.id ?? "";
    setForm({ serviceRequestId: "", engineerId: defaultEngineerId, scheduledFor: todayInputValue() });
    setDialogOpen(true);
  };

  const saveJob = async () => {
    if (!form.serviceRequestId || !form.engineerId) return;
    setSaving(true);
    try {
      await api.createJob({
        serviceRequestId: form.serviceRequestId,
        engineerId: form.engineerId,
        scheduledFor: form.scheduledFor,
      });
      toast({ title: "Job scheduled", description: "Service job created successfully." });
      setDialogOpen(false);
      setForm({ serviceRequestId: "", engineerId: "", scheduledFor: todayInputValue() });
      await loadJobs();
      await loadRequests();
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to create job" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <RoleGuard roles={["admin", "coordinator", "engineer"]}>
      <div className="space-y-6">
        <PageHeader
          title="Service Jobs"
          description={isEngineer ? "Your assigned jobs — open a job to update status and complete field actions." : "Track repair, maintenance and calibration jobs."}
          actions={
            canCreate ? (
              <Button onClick={openScheduleDialog} variant="brand">
                <Plus className="mr-1 h-4 w-4" /> Schedule Job
              </Button>
            ) : undefined
          }
        />

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading jobs…
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
            {columns.map((col) => {
              const items = jobs.filter((j) => formatJobStatus(j.status) === col.status);
              return (
                <div key={col.status} className="flex flex-col rounded-2xl border border-border/70 bg-card/55 p-3 shadow-sm backdrop-blur">
                  <div className="mb-3 flex items-center justify-between px-1">
                    <span className="text-sm font-semibold">{col.label}</span>
                    <span className="rounded-full border border-primary/10 bg-secondary px-2.5 py-0.5 text-xs font-semibold text-primary">{items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {items.map((j) => (
                      <Link key={j.id} to={`/app/jobs/${j.id}`} className="block">
                        <Card className="cursor-pointer space-y-2 p-3 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-elevated">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs text-muted-foreground">{j.reference}</span>
                            <StatusBadge status={formatJobStatus(j.status)} />
                          </div>
                          <p className="text-sm font-medium leading-snug">{j.equipmentName}</p>
                          <p className="text-xs text-muted-foreground">{j.customerName} · {formatFixedOption(SERVICE_TYPE_OPTIONS, j.type, j.typeOther)}</p>
                          <Progress value={j.progress} className="h-1.5" />
                        </Card>
                      </Link>
                    ))}
                    {items.length === 0 && <p className="px-1 py-6 text-center text-xs text-muted-foreground">No jobs</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Schedule Service Job</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Service request</Label>
              <Select value={form.serviceRequestId} onValueChange={(v) => setForm({ ...form, serviceRequestId: v })}>
                <SelectTrigger><SelectValue placeholder="Select request" /></SelectTrigger>
                <SelectContent>
                  {requests.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.reference} · {r.equipmentName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Assign to</Label>
              {loadingStaff ? (
                <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading staff…
                </div>
              ) : (
                <Select value={form.engineerId} onValueChange={(v) => setForm({ ...form, engineerId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select service engineer or coordinator" /></SelectTrigger>
                  <SelectContent>
                    {assignableStaff.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} · {roleLabels[s.role as Role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-xs text-muted-foreground">Only Service Engineer or Service Coordinator can be assigned.</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="scheduled">Scheduled for</Label>
              <Input id="scheduled" type="date" value={form.scheduledFor} onChange={(e) => setForm({ ...form, scheduledFor: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void saveJob()} disabled={saving || !form.serviceRequestId || !form.engineerId}>Schedule job</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleGuard>
  );
}
