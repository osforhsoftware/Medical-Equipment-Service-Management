import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Clock3, Loader2, PackagePlus, UserPlus } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { z } from "zod";
import { FormFieldError } from "@/components/shared/FormFieldError";
import { RequiredMark } from "@/components/shared/RequiredMark";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useFormValidation } from "@/hooks/useFormValidation";
import { fieldAria, fieldErrorClass, fieldRules } from "@/lib/formValidation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { api, type BackendJobActivity, type BackendJobExtra, type BackendJobWorkLog, type BackendServiceJob, type BackendUser } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { toast } from "@/lib/toast";

const assignSchema = z.object({
  userId: fieldRules.selectRequired("a staff member"),
});

const workSchema = z.object({
  startedAt: fieldRules.requiredString("Start time"),
  workPerformed: fieldRules.requiredString("Work performed"),
  endedAt: fieldRules.optionalString(),
  testingResult: fieldRules.optionalString(),
  calibrationResult: fieldRules.optionalString(),
});

const extraSchema = z.object({
  description: fieldRules.requiredString("Description"),
  reason: fieldRules.requiredString("Reason"),
  quantity: z.number().gt(0, "Quantity must be greater than 0."),
  unitPrice: fieldRules.nonNegativeNumber("Unit price"),
  taxRate: fieldRules.nonNegativeNumber("Tax rate"),
});

export default function ProjectDetail() {
  const { id = "" } = useParams();
  const { hasRole } = useAuth();
  const canAssignTeam = hasRole(["admin", "coordinator"]);
  const [job, setJob] = useState<BackendServiceJob | null>(null);
  const [staff, setStaff] = useState<BackendUser[]>([]);
  const [activities, setActivities] = useState<BackendJobActivity[]>([]);
  const [logs, setLogs] = useState<BackendJobWorkLog[]>([]);
  const [extras, setExtras] = useState<BackendJobExtra[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [assignment, setAssignment] = useState({ userId: "", isLead: false });
  const [work, setWork] = useState({ startedAt: "", endedAt: "", workPerformed: "", testingResult: "", calibrationResult: "" });
  const [extra, setExtra] = useState({ description: "", reason: "", quantity: 1, unitPrice: 0, taxRate: 0 });
  const assignRef = useRef<HTMLDivElement>(null);
  const workRef = useRef<HTMLDivElement>(null);
  const extraRef = useRef<HTMLDivElement>(null);

  const assignValidation = useFormValidation({
    fieldOrder: ["userId"],
    schema: assignSchema,
  });
  const workValidation = useFormValidation({
    fieldOrder: ["startedAt", "workPerformed"],
    schema: workSchema,
  });
  const extraValidation = useFormValidation({
    fieldOrder: ["description", "reason", "quantity"],
    schema: extraSchema,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [record, audit, users] = await Promise.all([
        api.getJob(id),
        api.getJobActivities(id),
        canAssignTeam ? api.listUsers({ isActive: true }) : Promise.resolve([] as BackendUser[]),
      ]);
      setJob(record);
      setLogs(record.workLogs ?? []);
      setExtras(record.extras ?? []);
      setStaff(users.filter((user) => ["admin", "coordinator", "engineer", "inspector"].includes(user.role)));
      setActivities(audit);
    } catch (error) {
      toast.apiError(error, { fallback: "Request failed" });
    } finally {
      setLoading(false);
    }
  }, [id, canAssignTeam]);

  useEffect(() => { void load(); }, [load]);

  const assign = async () => {
    if (!assignValidation.validateAll(assignment, undefined, assignRef.current)) return;
    const member = staff.find((user) => user.id === assignment.userId);
    setSaving("assign");
    try {
      await api.assignJobStaff(id, {
        userId: assignment.userId,
        role: member?.role || "member",
        isLead: assignment.isLead,
      });
      setAssignment({ userId: "", isLead: false });
      assignValidation.reset();
      toast({ title: "Staff assignment saved" });
      const record = await api.getJob(id);
      setJob(record);
    } catch (error) {
      if (!assignValidation.applyApiErrors(error, assignRef.current)) {
        toast.apiError(error, { fallback: "Request failed" });
      }
    } finally { setSaving(""); }
  };

  const addLog = async () => {
    if (!workValidation.validateAll(work, undefined, workRef.current)) return;
    setSaving("log");
    try {
      const endedAt = work.endedAt ? new Date(work.endedAt).toISOString() : new Date().toISOString();
      const saved = await api.addJobWorkLog(id, {
        startedAt: new Date(work.startedAt).toISOString(),
        endedAt,
        workPerformed: work.workPerformed,
        testingResult: work.testingResult || null,
        calibrationResult: work.calibrationResult || null,
      });
      setLogs((current) => [saved, ...current]);
      setWork({ startedAt: "", endedAt: "", workPerformed: "", testingResult: "", calibrationResult: "" });
      workValidation.reset();
      toast({ title: "Work log saved" });
    } catch (error) {
      if (!workValidation.applyApiErrors(error, workRef.current)) {
        toast.apiError(error, { fallback: "Request failed" });
      }
    } finally { setSaving(""); }
  };

  const addExtra = async () => {
    if (!extraValidation.validateAll(extra, undefined, extraRef.current)) return;
    setSaving("extra");
    try {
      const saved = await api.addJobExtra(id, extra);
      setExtras((current) => [saved, ...current]);
      setExtra({ description: "", reason: "", quantity: 1, unitPrice: 0, taxRate: 0 });
      extraValidation.reset();
      toast({ title: "Additional work submitted", description: "The item is pending estimator approval." });
    } catch (error) {
      if (!extraValidation.applyApiErrors(error, extraRef.current)) {
        toast.apiError(error, { fallback: "Request failed" });
      }
    } finally { setSaving(""); }
  };

  if (loading) return <div className="flex justify-center gap-2 py-20 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading project…</div>;
  if (!job) return <p className="py-20 text-center text-muted-foreground">Project not found.</p>;

  return (
    <div className="space-y-6">
      <PageHeader title={job.reference} description={`${job.customerName} · ${job.equipmentName}`} actions={<Button asChild variant="outline"><Link to="/app/projects"><ArrowLeft className="mr-1 h-4 w-4" /> Projects</Link></Button>} />
      <div className="flex items-center gap-3"><StatusBadge status={job.status} /><span className="text-sm text-muted-foreground">{job.progress}% complete · Lead: {job.engineer}</span></div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base"><UserPlus className="mr-2 inline h-4 w-4" />Project team</CardTitle></CardHeader>
          <CardContent ref={assignRef} className="space-y-3">
            {canAssignTeam ? (
              <form
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  void assign();
                }}
              >
                <div className="space-y-3">
                  <div className="grid gap-2" data-field="userId">
                    <Label className={assignValidation.shouldShow("userId") ? "text-destructive" : undefined}>
                      Staff member
                      <RequiredMark />
                    </Label>
                    <Select
                      value={assignment.userId}
                      onValueChange={(userId) => {
                        const next = { ...assignment, userId };
                        setAssignment(next);
                        assignValidation.handleChange("userId", next);
                      }}
                    >
                      <SelectTrigger
                        className={fieldErrorClass(assignValidation.shouldShow("userId"))}
                        {...fieldAria("userId", assignValidation.shouldShow("userId") ? assignValidation.errors.userId : null)}
                      >
                        <SelectValue placeholder="Select staff" />
                      </SelectTrigger>
                      <SelectContent>{staff.map((user) => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}</SelectContent>
                    </Select>
                    {assignValidation.shouldShow("userId") && <FormFieldError field="userId" message={assignValidation.errors.userId} />}
                  </div>
                  <Button type="submit" className="w-full" disabled={saving === "assign"}>
                    {saving === "assign" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Add to team
                  </Button>
                </div>
              </form>
            ) : null}
            {job.assignments?.length ? (
              <div className="space-y-2">
                {job.assignments.map((member) => (
                  <div key={member.id} className="rounded-lg border px-3 py-2 text-sm">
                    <p className="font-medium">{member.user?.name ?? "Team member"}{member.isLead ? " · Lead" : ""}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Lead: {job.engineer || "Not assigned"}</p>
            )}
          </CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle className="text-base"><Clock3 className="mr-2 inline h-4 w-4" />Work log</CardTitle></CardHeader>
          <CardContent ref={workRef} className="space-y-3">
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void addLog();
              }}
            >
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2" data-field="startedAt">
                    <Label htmlFor="work-started" className={workValidation.shouldShow("startedAt") ? "text-destructive" : undefined}>
                      Started
                      <RequiredMark />
                    </Label>
                    <Input
                      id="work-started"
                      name="startedAt"
                      type="datetime-local"
                      value={work.startedAt}
                      className={fieldErrorClass(workValidation.shouldShow("startedAt"))}
                      {...fieldAria("startedAt", workValidation.shouldShow("startedAt") ? workValidation.errors.startedAt : null)}
                      onChange={(event) => {
                        const next = { ...work, startedAt: event.target.value };
                        setWork(next);
                        workValidation.handleChange("startedAt", next);
                      }}
                      onBlur={() => workValidation.handleBlur("startedAt", work)}
                    />
                    {workValidation.shouldShow("startedAt") && <FormFieldError field="startedAt" message={workValidation.errors.startedAt} />}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="work-ended">Ended (optional — defaults to now)</Label>
                    <Input id="work-ended" type="datetime-local" value={work.endedAt} onChange={(event) => setWork({ ...work, endedAt: event.target.value })} />
                  </div>
                </div>
                <div className="grid gap-2" data-field="workPerformed">
                  <Label htmlFor="work-performed" className={workValidation.shouldShow("workPerformed") ? "text-destructive" : undefined}>
                    Work performed
                    <RequiredMark />
                  </Label>
                  <Textarea
                    id="work-performed"
                    name="workPerformed"
                    value={work.workPerformed}
                    className={fieldErrorClass(workValidation.shouldShow("workPerformed"))}
                    {...fieldAria("workPerformed", workValidation.shouldShow("workPerformed") ? workValidation.errors.workPerformed : null)}
                    onChange={(event) => {
                      const next = { ...work, workPerformed: event.target.value };
                      setWork(next);
                      workValidation.handleChange("workPerformed", next);
                    }}
                    onBlur={() => workValidation.handleBlur("workPerformed", work)}
                  />
                  {workValidation.shouldShow("workPerformed") && <FormFieldError field="workPerformed" message={workValidation.errors.workPerformed} />}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2"><Label htmlFor="testing-result">Testing result</Label><Textarea id="testing-result" value={work.testingResult} onChange={(event) => setWork({ ...work, testingResult: event.target.value })} /></div>
                  <div className="grid gap-2"><Label htmlFor="calibration-result">Calibration result</Label><Textarea id="calibration-result" value={work.calibrationResult} onChange={(event) => setWork({ ...work, calibrationResult: event.target.value })} /></div>
                </div>
                <Button type="submit" disabled={saving === "log"}>
                  {saving === "log" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save work log
                </Button>
              </div>
            </form>
            {logs.map((log) => <div key={log.id} className="rounded-lg border p-3 text-sm"><p>{log.workPerformed}</p><p className="mt-1 text-xs text-muted-foreground">{formatDateTime(log.startedAt)}{log.endedAt ? ` – ${formatDateTime(log.endedAt)}` : ""} · {log.minutes} minutes</p></div>)}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base"><PackagePlus className="mr-2 inline h-4 w-4" />Additional work / parts</CardTitle></CardHeader>
        <CardContent ref={extraRef} className="space-y-3">
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void addExtra();
            }}
          >
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-2" data-field="description">
                  <Label htmlFor="extra-description" className={extraValidation.shouldShow("description") ? "text-destructive" : undefined}>
                    Description
                    <RequiredMark />
                  </Label>
                  <Input
                    id="extra-description"
                    name="description"
                    value={extra.description}
                    className={fieldErrorClass(extraValidation.shouldShow("description"))}
                    {...fieldAria("description", extraValidation.shouldShow("description") ? extraValidation.errors.description : null)}
                    onChange={(event) => {
                      const next = { ...extra, description: event.target.value };
                      setExtra(next);
                      extraValidation.handleChange("description", next);
                    }}
                    onBlur={() => extraValidation.handleBlur("description", extra)}
                  />
                  {extraValidation.shouldShow("description") && <FormFieldError field="description" message={extraValidation.errors.description} />}
                </div>
                <div className="grid gap-2" data-field="reason">
                  <Label htmlFor="extra-reason" className={extraValidation.shouldShow("reason") ? "text-destructive" : undefined}>
                    Reason
                    <RequiredMark />
                  </Label>
                  <Input
                    id="extra-reason"
                    name="reason"
                    value={extra.reason}
                    className={fieldErrorClass(extraValidation.shouldShow("reason"))}
                    {...fieldAria("reason", extraValidation.shouldShow("reason") ? extraValidation.errors.reason : null)}
                    onChange={(event) => {
                      const next = { ...extra, reason: event.target.value };
                      setExtra(next);
                      extraValidation.handleChange("reason", next);
                    }}
                    onBlur={() => extraValidation.handleBlur("reason", extra)}
                  />
                  {extraValidation.shouldShow("reason") && <FormFieldError field="reason" message={extraValidation.errors.reason} />}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="grid gap-2" data-field="quantity">
                  <Label htmlFor="extra-quantity" className={extraValidation.shouldShow("quantity") ? "text-destructive" : undefined}>Quantity</Label>
                  <Input
                    id="extra-quantity"
                    name="quantity"
                    type="number"
                    min={0.01}
                    value={extra.quantity}
                    className={fieldErrorClass(extraValidation.shouldShow("quantity"))}
                    {...fieldAria("quantity", extraValidation.shouldShow("quantity") ? extraValidation.errors.quantity : null)}
                    onChange={(event) => {
                      const next = { ...extra, quantity: Number(event.target.value) };
                      setExtra(next);
                      extraValidation.handleChange("quantity", next);
                    }}
                    onBlur={() => extraValidation.handleBlur("quantity", extra)}
                  />
                  {extraValidation.shouldShow("quantity") && <FormFieldError field="quantity" message={extraValidation.errors.quantity} />}
                </div>
                <div className="grid gap-2"><Label htmlFor="extra-unit-price">Unit price</Label><Input id="extra-unit-price" type="number" min={0} value={extra.unitPrice} onChange={(event) => setExtra({ ...extra, unitPrice: Number(event.target.value) })} /></div>
                <div className="grid gap-2"><Label htmlFor="extra-tax">Tax %</Label><Input id="extra-tax" type="number" min={0} value={extra.taxRate} onChange={(event) => setExtra({ ...extra, taxRate: Number(event.target.value) })} /></div>
              </div>
              <Button type="submit" disabled={saving === "extra"}>
                {saving === "extra" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Submit for approval
              </Button>
            </div>
          </form>
          {extras.map((item) => <div key={item.id} className="flex justify-between rounded-lg border p-3 text-sm"><div><p className="font-medium">{item.description}</p><p className="text-xs text-muted-foreground">{item.reason}</p></div><div className="text-right"><StatusBadge status={item.status} /><p className="mt-1">{formatCurrency(Number(item.quantity) * Number(item.unitPrice))}</p></div></div>)}
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle className="text-base">Project activity</CardTitle></CardHeader><CardContent className="space-y-2">{activities.map((event) => <div key={event.id} className="border-l-2 border-primary/30 pl-3 text-sm"><p className="font-medium">{event.action}</p><p className="text-xs text-muted-foreground">{event.actor} · {formatDateTime(event.createdAt)}{event.note ? ` — ${event.note}` : ""}</p></div>)}</CardContent></Card>
    </div>
  );
}
