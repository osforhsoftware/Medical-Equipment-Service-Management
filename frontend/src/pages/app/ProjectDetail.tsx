import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Clock3, Loader2, PackagePlus, UserPlus } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, type BackendJobActivity, type BackendJobExtra, type BackendJobWorkLog, type BackendServiceJob, type BackendUser } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { toast } from "@/lib/toast";

export default function ProjectDetail() {
  const { id = "" } = useParams();
  const [job, setJob] = useState<BackendServiceJob | null>(null);
  const [staff, setStaff] = useState<BackendUser[]>([]);
  const [activities, setActivities] = useState<BackendJobActivity[]>([]);
  const [logs, setLogs] = useState<BackendJobWorkLog[]>([]);
  const [extras, setExtras] = useState<BackendJobExtra[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [assignment, setAssignment] = useState({ userId: "", role: "engineer", isLead: false });
  const [work, setWork] = useState({ startedAt: "", endedAt: "", workPerformed: "", testingResult: "", calibrationResult: "" });
  const [extra, setExtra] = useState({ description: "", reason: "", quantity: 1, unitPrice: 0, taxRate: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [record, users, audit] = await Promise.all([api.getJob(id), api.listUsers({ isActive: true }), api.getJobActivities(id)]);
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
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const assign = async () => {
    setSaving("assign");
    try {
      await api.assignJobStaff(id, assignment);
      setAssignment({ userId: "", role: "engineer", isLead: false });
      toast({ title: "Staff assignment saved" });
    } catch (error) {
      toast.apiError(error, { fallback: "Request failed" });
    } finally { setSaving(""); }
  };

  const addLog = async () => {
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
      toast({ title: "Work log saved" });
    } catch (error) {
      toast.apiError(error, { fallback: "Request failed" });
    } finally { setSaving(""); }
  };

  const addExtra = async () => {
    setSaving("extra");
    try {
      const saved = await api.addJobExtra(id, extra);
      setExtras((current) => [saved, ...current]);
      setExtra({ description: "", reason: "", quantity: 1, unitPrice: 0, taxRate: 0 });
      toast({ title: "Additional work submitted", description: "The item is pending estimator approval." });
    } catch (error) {
      toast.apiError(error, { fallback: "Request failed" });
    } finally { setSaving(""); }
  };

  if (loading) return <div className="flex justify-center gap-2 py-20 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading project…</div>;
  if (!job) return <p className="py-20 text-center text-muted-foreground">Project not found.</p>;

  return (
    <div className="space-y-6">
      <PageHeader title={job.reference} description={`${job.customerName} · ${job.equipmentName}`} actions={<Button asChild variant="outline"><Link to="/app/projects"><ArrowLeft className="mr-1 h-4 w-4" /> Projects</Link></Button>} />
      <div className="flex items-center gap-3"><StatusBadge status={job.status} /><span className="text-sm text-muted-foreground">{job.progress}% complete · Lead: {job.engineer}</span></div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Card><CardHeader><CardTitle className="text-base"><UserPlus className="mr-2 inline h-4 w-4" />Project team</CardTitle></CardHeader><CardContent className="space-y-3">
          <Field label="Staff member"><Select value={assignment.userId} onValueChange={(userId) => setAssignment({ ...assignment, userId })}><SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger><SelectContent>{staff.map((user) => <SelectItem key={user.id} value={user.id}>{user.name} · {user.role}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Project role"><Input value={assignment.role} onChange={(event) => setAssignment({ ...assignment, role: event.target.value })} /></Field>
          <Button className="w-full" onClick={assign} disabled={saving === "assign" || !assignment.userId}>{saving === "assign" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Add to team</Button>
        </CardContent></Card>
        <Card className="xl:col-span-2"><CardHeader><CardTitle className="text-base"><Clock3 className="mr-2 inline h-4 w-4" />Work log</CardTitle></CardHeader><CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Started"><Input type="datetime-local" value={work.startedAt} onChange={(event) => setWork({ ...work, startedAt: event.target.value })} /></Field><Field label="Ended (optional — defaults to now)"><Input type="datetime-local" value={work.endedAt} onChange={(event) => setWork({ ...work, endedAt: event.target.value })} /></Field></div>
          <Field label="Work performed"><Textarea value={work.workPerformed} onChange={(event) => setWork({ ...work, workPerformed: event.target.value })} /></Field>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Testing result"><Textarea value={work.testingResult} onChange={(event) => setWork({ ...work, testingResult: event.target.value })} /></Field><Field label="Calibration result"><Textarea value={work.calibrationResult} onChange={(event) => setWork({ ...work, calibrationResult: event.target.value })} /></Field></div>
          <Button onClick={addLog} disabled={saving === "log" || !work.startedAt || !work.workPerformed.trim()}>{saving === "log" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save work log</Button>
          {logs.map((log) => <div key={log.id} className="rounded-lg border p-3 text-sm"><p>{log.workPerformed}</p><p className="mt-1 text-xs text-muted-foreground">{formatDateTime(log.startedAt)}{log.endedAt ? ` – ${formatDateTime(log.endedAt)}` : ""} · {log.minutes} minutes</p></div>)}
        </CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle className="text-base"><PackagePlus className="mr-2 inline h-4 w-4" />Additional work / parts</CardTitle></CardHeader><CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2"><Field label="Description"><Input value={extra.description} onChange={(event) => setExtra({ ...extra, description: event.target.value })} /></Field><Field label="Reason"><Input value={extra.reason} onChange={(event) => setExtra({ ...extra, reason: event.target.value })} /></Field></div>
        <div className="grid gap-3 sm:grid-cols-3"><Field label="Quantity"><Input type="number" min={0.01} value={extra.quantity} onChange={(event) => setExtra({ ...extra, quantity: Number(event.target.value) })} /></Field><Field label="Unit price"><Input type="number" min={0} value={extra.unitPrice} onChange={(event) => setExtra({ ...extra, unitPrice: Number(event.target.value) })} /></Field><Field label="Tax %"><Input type="number" min={0} value={extra.taxRate} onChange={(event) => setExtra({ ...extra, taxRate: Number(event.target.value) })} /></Field></div>
        <Button onClick={addExtra} disabled={saving === "extra" || !extra.description.trim() || !extra.reason.trim()}>{saving === "extra" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Submit for approval</Button>
        {extras.map((item) => <div key={item.id} className="flex justify-between rounded-lg border p-3 text-sm"><div><p className="font-medium">{item.description}</p><p className="text-xs text-muted-foreground">{item.reason}</p></div><div className="text-right"><StatusBadge status={item.status} /><p className="mt-1">{formatCurrency(Number(item.quantity) * Number(item.unitPrice))}</p></div></div>)}
      </CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">Project activity</CardTitle></CardHeader><CardContent className="space-y-2">{activities.map((event) => <div key={event.id} className="border-l-2 border-primary/30 pl-3 text-sm"><p className="font-medium">{event.action}</p><p className="text-xs text-muted-foreground">{event.actor} · {formatDateTime(event.createdAt)}{event.note ? ` — ${event.note}` : ""}</p></div>)}</CardContent></Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-2"><Label>{label}</Label>{children}</div>;
}
