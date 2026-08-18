import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Plus, Loader2 } from "lucide-react";
import { FormFieldError } from "@/components/shared/FormFieldError";
import { RequiredMark } from "@/components/shared/RequiredMark";
import { useFormValidation } from "@/hooks/useFormValidation";
import { fieldAria, fieldErrorClass, fieldRules } from "@/lib/formValidation";
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
import { api, type BackendUser } from "@/lib/api";
import { formatFixedOption, SERVICE_TYPE_OPTIONS } from "@/lib/fixedOptions";
import { formatJobStatus, todayInputValue, toApiJobStatus } from "@/lib/format";
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

const scheduleSchema = z.object({
  serviceRequestId: fieldRules.selectRequired("service request"),
  engineerId: fieldRules.selectRequired("assignee"),
  scheduledFor: fieldRules.requiredString("Scheduled date"),
});

function JobColumn({ status, label }: { status: string; label: string }) {
  const apiStatus = toApiJobStatus(status);
  const query = useInfiniteQuery({
    queryKey: ["jobs", { status: apiStatus }],
    queryFn: ({ pageParam }) => api.listJobs({ status: apiStatus, page: pageParam, limit: 20 }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.hasNextPage ? last.meta.page + 1 : undefined),
  });
  const items = query.data?.pages.flatMap((page) => page.data) ?? [];
  const total = query.data?.pages[0]?.meta.total ?? items.length;

  return (
    <div className="flex flex-col rounded-lg border border-border bg-muted/30 p-3">
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="text-sm font-semibold">{label}</span>
        <span className="rounded-full border border-primary/10 bg-secondary px-2.5 py-0.5 text-xs font-semibold text-primary">{total}</span>
      </div>
      <div className="space-y-2">
        {query.isLoading ? (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">No jobs</p>
        ) : (
          items.map((j) => (
            <Link key={j.id} to={`/app/jobs/${j.id}`} className="block">
              <Card className="cursor-pointer space-y-2 p-3 hover:bg-muted/40">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-muted-foreground">{j.reference}</span>
                  <StatusBadge status={formatJobStatus(j.status)} />
                </div>
                <p className="text-sm font-medium leading-snug">{j.equipmentName}</p>
                <p className="text-xs text-muted-foreground">{j.customerName} · {formatFixedOption(SERVICE_TYPE_OPTIONS, j.type, j.typeOther)}</p>
                <Progress value={j.progress} className="h-1.5" />
              </Card>
            </Link>
          ))
        )}
        {query.hasNextPage ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => void query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
          >
            {query.isFetchingNextPage ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
            Load more
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export default function Jobs() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [assignableStaff, setAssignableStaff] = useState<BackendUser[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ serviceRequestId: "", engineerId: "", scheduledFor: todayInputValue() });
  const dialogRef = useRef<HTMLDivElement>(null);

  const scheduleValidation = useFormValidation({
    fieldOrder: ["serviceRequestId", "engineerId", "scheduledFor"],
    schema: scheduleSchema,
  });

  const isEngineer = user?.role === "engineer";
  const canCreate = user?.role === "admin" || user?.role === "coordinator";

  const requestsQuery = useQuery({
    queryKey: ["service-requests", "job-eligible"],
    queryFn: () => api.listServiceRequests({ statuses: "approval,estimate,inProgress", limit: 100, page: 1 }),
    staleTime: 30_000,
  });
  const requests = requestsQuery.data?.data ?? [];

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
    if (dialogOpen) void loadAssignableStaff();
  }, [dialogOpen, loadAssignableStaff]);

  const openScheduleDialog = () => {
    const defaultEngineerId = assignableStaff.find((s) => s.id === user?.id)?.id ?? "";
    setForm({ serviceRequestId: "", engineerId: defaultEngineerId, scheduledFor: todayInputValue() });
    scheduleValidation.reset();
    setDialogOpen(true);
  };

  const saveJob = async () => {
    if (!scheduleValidation.validateAll(form, undefined, dialogRef.current)) return;

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
      scheduleValidation.reset();
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      await queryClient.invalidateQueries({ queryKey: ["service-requests"] });
    } catch (err) {
      if (!scheduleValidation.applyApiErrors(err, dialogRef.current)) {
        toast.apiError(err, { fallback: "Unable to create job" });
      }
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {columns.map((col) => (
            <JobColumn key={col.status} status={col.status} label={col.label} />
          ))}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) scheduleValidation.reset(); setDialogOpen(open); }}>
        <DialogContent ref={dialogRef} className="sm:max-w-md">
          <DialogHeader><DialogTitle>Schedule Service Job</DialogTitle></DialogHeader>
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void saveJob();
            }}
          >
            <div className="grid gap-4 py-2">
              <div className="grid gap-2" data-field="serviceRequestId">
                <Label className={scheduleValidation.shouldShow("serviceRequestId") ? "text-destructive" : undefined}>
                  Service request
                  <RequiredMark />
                </Label>
                <Select
                  value={form.serviceRequestId}
                  onValueChange={(v) => {
                    const next = { ...form, serviceRequestId: v };
                    setForm(next);
                    scheduleValidation.clearError("serviceRequestId");
                    scheduleValidation.handleChange("serviceRequestId", next);
                  }}
                >
                  <SelectTrigger
                    id="serviceRequestId"
                    className={fieldErrorClass(scheduleValidation.shouldShow("serviceRequestId"))}
                    {...fieldAria("serviceRequestId", scheduleValidation.shouldShow("serviceRequestId") ? scheduleValidation.errors.serviceRequestId : null)}
                  >
                    <SelectValue placeholder="Select request" />
                  </SelectTrigger>
                  <SelectContent>
                    {requests.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.reference} · {r.equipmentName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {scheduleValidation.shouldShow("serviceRequestId") && (
                  <FormFieldError field="serviceRequestId" message={scheduleValidation.errors.serviceRequestId} />
                )}
              </div>
              <div className="grid gap-2" data-field="engineerId">
                <Label className={scheduleValidation.shouldShow("engineerId") ? "text-destructive" : undefined}>
                  Assign to
                  <RequiredMark />
                </Label>
                {loadingStaff ? (
                  <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading staff…
                  </div>
                ) : (
                  <Select
                    value={form.engineerId}
                    onValueChange={(v) => {
                      const next = { ...form, engineerId: v };
                      setForm(next);
                      scheduleValidation.clearError("engineerId");
                      scheduleValidation.handleChange("engineerId", next);
                    }}
                  >
                    <SelectTrigger
                      id="engineerId"
                      className={fieldErrorClass(scheduleValidation.shouldShow("engineerId"))}
                      {...fieldAria("engineerId", scheduleValidation.shouldShow("engineerId") ? scheduleValidation.errors.engineerId : null)}
                    >
                      <SelectValue placeholder="Select service engineer or coordinator" />
                    </SelectTrigger>
                    <SelectContent>
                      {assignableStaff.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} · {roleLabels[s.role as Role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {scheduleValidation.shouldShow("engineerId") && (
                  <FormFieldError field="engineerId" message={scheduleValidation.errors.engineerId} />
                )}
                <p className="text-xs text-muted-foreground">Only Service Engineer or Service Coordinator can be assigned.</p>
              </div>
              <div className="grid gap-2" data-field="scheduledFor">
                <Label htmlFor="scheduled" className={scheduleValidation.shouldShow("scheduledFor") ? "text-destructive" : undefined}>
                  Scheduled for
                  <RequiredMark />
                </Label>
                <Input
                  id="scheduled"
                  name="scheduledFor"
                  type="date"
                  value={form.scheduledFor}
                  className={fieldErrorClass(scheduleValidation.shouldShow("scheduledFor"))}
                  {...fieldAria("scheduledFor", scheduleValidation.shouldShow("scheduledFor") ? scheduleValidation.errors.scheduledFor : null)}
                  onChange={(e) => {
                    const next = { ...form, scheduledFor: e.target.value };
                    setForm(next);
                    scheduleValidation.handleChange("scheduledFor", next);
                  }}
                  onBlur={() => scheduleValidation.handleBlur("scheduledFor", form)}
                />
                {scheduleValidation.shouldShow("scheduledFor") && (
                  <FormFieldError field="scheduledFor" message={scheduleValidation.errors.scheduledFor} />
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>Schedule job</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </RoleGuard>
  );
}
