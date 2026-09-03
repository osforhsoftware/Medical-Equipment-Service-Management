import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Plus, ChevronDown, Loader2 } from "lucide-react";
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
import { JOB_CREATE_ROLES } from "@/config/roles";
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

const KANBAN_PAGE_SIZE = 10;

const ASSIGNABLE_JOB_ROLES: Role[] = ["coordinator", "engineer"];
const NONE = "__none__";

const emptyForm = {
  serviceRequestId: "",
  customerId: "",
  equipmentId: "",
  type: "",
  typeOther: "",
  engineerId: "",
  scheduledFor: todayInputValue(),
};

const scheduleSchema = z
  .object({
    serviceRequestId: z.string().optional(),
    customerId: z.string().optional(),
    equipmentId: z.string().optional(),
    type: z.string().optional(),
    typeOther: z.string().optional(),
    engineerId: fieldRules.selectRequired("assignee"),
    scheduledFor: fieldRules.requiredString("Scheduled date"),
  })
  .superRefine((data, ctx) => {
    if (data.serviceRequestId) return;
    if (!data.customerId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["customerId"], message: "Select a customer." });
    }
    if (!data.equipmentId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["equipmentId"], message: "Select equipment." });
    }
    if (!data.type) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["type"], message: "Select a service type." });
    }
    if (data.type === "Other" && !data.typeOther?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["typeOther"], message: "Please specify the service type." });
    }
  });

function JobColumn({ status, label }: { status: string; label: string }) {
  const apiStatus = toApiJobStatus(status);
  const query = useInfiniteQuery({
    queryKey: ["jobs", { status: apiStatus, limit: KANBAN_PAGE_SIZE }],
    queryFn: ({ pageParam }) => api.listJobs({ status: apiStatus, page: pageParam, limit: KANBAN_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.hasNextPage ? last.meta.page + 1 : undefined),
  });
  const items = query.data?.pages.flatMap((page) => page.data) ?? [];
  const total = query.data?.pages[0]?.meta.total ?? items.length;
  const remaining = Math.max(0, total - items.length);

  return (
    <div className="flex max-h-[calc(100vh-14rem)] min-h-0 flex-col rounded-lg border border-border bg-muted/30 p-3">
      <div className="mb-3 flex shrink-0 items-center justify-between px-1">
        <span className="text-sm font-semibold">{label}</span>
        <span className="rounded-full border border-primary/10 bg-secondary px-2.5 py-0.5 text-xs font-semibold text-primary">{total}</span>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
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
      </div>
      {query.hasNextPage ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2 h-8 w-full shrink-0 text-xs"
          onClick={() => void query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
        >
          {query.isFetchingNextPage ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <ChevronDown className="mr-1 h-3.5 w-3.5" />
          )}
          See more{remaining > 0 ? ` (${remaining})` : ""}
        </Button>
      ) : null}
    </div>
  );
}

export default function Jobs() {
  const queryClient = useQueryClient();
  const { user, hasRole } = useAuth();
  const [assignableStaff, setAssignableStaff] = useState<BackendUser[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const dialogRef = useRef<HTMLDivElement>(null);

  const scheduleValidation = useFormValidation({
    fieldOrder: ["serviceRequestId", "customerId", "equipmentId", "type", "typeOther", "engineerId", "scheduledFor"],
    schema: scheduleSchema,
  });

  const isEngineer = hasRole(["engineer"]) && !hasRole(["admin", "coordinator"]);
  const canCreate = hasRole(JOB_CREATE_ROLES);

  const requestsQuery = useQuery({
    queryKey: ["service-requests", "job-eligible"],
    queryFn: () => api.listServiceRequests({ statuses: "approval,pending_approval,estimate,inProgress,assigned_engineer", limit: 100, page: 1 }),
    staleTime: 30_000,
  });
  const requests = requestsQuery.data?.data ?? [];
  const ticketless = !form.serviceRequestId;

  const customersQuery = useQuery({
    queryKey: ["customers", "options"],
    queryFn: () => api.listCustomersOptions(),
    enabled: dialogOpen && ticketless,
    staleTime: 30_000,
  });
  const equipmentQuery = useQuery({
    queryKey: ["equipment", "options", form.customerId],
    queryFn: () => api.listEquipmentOptions({ customerId: form.customerId }),
    enabled: dialogOpen && ticketless && Boolean(form.customerId),
    staleTime: 30_000,
  });
  const customers = customersQuery.data ?? [];
  const equipment = equipmentQuery.data ?? [];

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
    setForm({ ...emptyForm, engineerId: defaultEngineerId, scheduledFor: todayInputValue() });
    scheduleValidation.reset();
    setDialogOpen(true);
  };

  const saveJob = async () => {
    if (!scheduleValidation.validateAll(form, undefined, dialogRef.current)) return;

    setSaving(true);
    try {
      await api.createJob({
        ...(form.serviceRequestId
          ? { serviceRequestId: form.serviceRequestId }
          : {
              customerId: form.customerId,
              equipmentId: form.equipmentId,
              type: form.type,
              typeOther: form.type === "Other" ? form.typeOther.trim() || null : null,
            }),
        engineerId: form.engineerId,
        scheduledFor: form.scheduledFor,
      });
      toast({ title: "Job scheduled", description: "Service job created successfully." });
      setDialogOpen(false);
      setForm(emptyForm);
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
        <DialogContent ref={dialogRef} className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
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
                <Label>Service ticket</Label>
                <Select
                  value={form.serviceRequestId || NONE}
                  onValueChange={(v) => {
                    const ticketId = v === NONE ? "" : v;
                    const next = {
                      ...form,
                      serviceRequestId: ticketId,
                      customerId: ticketId ? "" : form.customerId,
                      equipmentId: ticketId ? "" : form.equipmentId,
                      type: ticketId ? "" : form.type,
                      typeOther: ticketId ? "" : form.typeOther,
                    };
                    setForm(next);
                    scheduleValidation.clearError("serviceRequestId");
                    scheduleValidation.clearError("customerId");
                    scheduleValidation.clearError("equipmentId");
                    scheduleValidation.clearError("type");
                    scheduleValidation.handleChange("serviceRequestId", next);
                  }}
                >
                  <SelectTrigger id="serviceRequestId">
                    <SelectValue placeholder="Select request (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>No service ticket</SelectItem>
                    {requests.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.reference} · {r.equipmentName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Optional. You can assign a job directly to a customer.</p>
              </div>
              {ticketless ? (
                <>
                  <div className="grid gap-2" data-field="customerId">
                    <Label className={scheduleValidation.shouldShow("customerId") ? "text-destructive" : undefined}>
                      Customer
                      <RequiredMark />
                    </Label>
                    <Select
                      value={form.customerId || undefined}
                      onValueChange={(v) => {
                        const next = { ...form, customerId: v, equipmentId: "" };
                        setForm(next);
                        scheduleValidation.clearError("customerId");
                        scheduleValidation.clearError("equipmentId");
                        scheduleValidation.handleChange("customerId", next);
                      }}
                    >
                      <SelectTrigger
                        id="customerId"
                        className={fieldErrorClass(scheduleValidation.shouldShow("customerId"))}
                        {...fieldAria("customerId", scheduleValidation.shouldShow("customerId") ? scheduleValidation.errors.customerId : null)}
                      >
                        <SelectValue placeholder="Select customer" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {scheduleValidation.shouldShow("customerId") && (
                      <FormFieldError field="customerId" message={scheduleValidation.errors.customerId} />
                    )}
                  </div>
                  <div className="grid gap-2" data-field="equipmentId">
                    <Label className={scheduleValidation.shouldShow("equipmentId") ? "text-destructive" : undefined}>
                      Equipment
                      <RequiredMark />
                    </Label>
                    <Select
                      value={form.equipmentId || undefined}
                      onValueChange={(v) => {
                        const next = { ...form, equipmentId: v };
                        setForm(next);
                        scheduleValidation.clearError("equipmentId");
                        scheduleValidation.handleChange("equipmentId", next);
                      }}
                      disabled={!form.customerId}
                    >
                      <SelectTrigger
                        id="equipmentId"
                        className={fieldErrorClass(scheduleValidation.shouldShow("equipmentId"))}
                        {...fieldAria("equipmentId", scheduleValidation.shouldShow("equipmentId") ? scheduleValidation.errors.equipmentId : null)}
                      >
                        <SelectValue placeholder={form.customerId ? "Select equipment" : "Select a customer first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {equipment.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name}{item.assetTag ? ` · ${item.assetTag}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {scheduleValidation.shouldShow("equipmentId") && (
                      <FormFieldError field="equipmentId" message={scheduleValidation.errors.equipmentId} />
                    )}
                  </div>
                  <div className="grid gap-2" data-field="type">
                    <Label className={scheduleValidation.shouldShow("type") ? "text-destructive" : undefined}>
                      Service type
                      <RequiredMark />
                    </Label>
                    <Select
                      value={form.type || undefined}
                      onValueChange={(v) => {
                        const next = { ...form, type: v, typeOther: v === "Other" ? form.typeOther : "" };
                        setForm(next);
                        scheduleValidation.clearError("type");
                        if (v !== "Other") scheduleValidation.clearError("typeOther");
                        scheduleValidation.handleChange("type", next);
                      }}
                    >
                      <SelectTrigger
                        id="type"
                        className={fieldErrorClass(scheduleValidation.shouldShow("type"))}
                        {...fieldAria("type", scheduleValidation.shouldShow("type") ? scheduleValidation.errors.type : null)}
                      >
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {SERVICE_TYPE_OPTIONS.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {scheduleValidation.shouldShow("type") && (
                      <FormFieldError field="type" message={scheduleValidation.errors.type} />
                    )}
                  </div>
                  {form.type === "Other" ? (
                    <div className="grid gap-2" data-field="typeOther">
                      <Label htmlFor="typeOther" className={scheduleValidation.shouldShow("typeOther") ? "text-destructive" : undefined}>
                        Specify type
                        <RequiredMark />
                      </Label>
                      <Input
                        id="typeOther"
                        name="typeOther"
                        value={form.typeOther}
                        className={fieldErrorClass(scheduleValidation.shouldShow("typeOther"))}
                        {...fieldAria("typeOther", scheduleValidation.shouldShow("typeOther") ? scheduleValidation.errors.typeOther : null)}
                        onChange={(e) => {
                          const next = { ...form, typeOther: e.target.value };
                          setForm(next);
                          scheduleValidation.handleChange("typeOther", next);
                        }}
                        onBlur={() => scheduleValidation.handleBlur("typeOther", form)}
                      />
                      {scheduleValidation.shouldShow("typeOther") && (
                        <FormFieldError field="typeOther" message={scheduleValidation.errors.typeOther} />
                      )}
                    </div>
                  ) : null}
                </>
              ) : null}
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
