import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ExternalLink, Loader2, UserPlus } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { api, type BackendServiceJob, type BackendUser } from "@/lib/api";
import { toast } from "@/lib/toast";

const assignSchema = z.object({
  userId: fieldRules.selectRequired("a staff member"),
});

export default function ProjectDetail() {
  const { id = "" } = useParams();
  const { hasRole } = useAuth();
  const canAssignTeam = hasRole(["admin", "coordinator"]);
  const [job, setJob] = useState<BackendServiceJob | null>(null);
  const [staff, setStaff] = useState<BackendUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assignment, setAssignment] = useState({ userId: "", isLead: false });
  const assignRef = useRef<HTMLDivElement>(null);

  const assignValidation = useFormValidation({
    fieldOrder: ["userId"],
    schema: assignSchema,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [record, users] = await Promise.all([
        api.getJob(id),
        canAssignTeam ? api.listUsers({ isActive: true }) : Promise.resolve([] as BackendUser[]),
      ]);
      setJob(record);
      setStaff(users.filter((user) => ["admin", "coordinator", "engineer", "inspector"].includes(user.role)));
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
    setSaving(true);
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
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center gap-2 py-20 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading project…</div>;
  if (!job) return <p className="py-20 text-center text-muted-foreground">Project not found.</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={job.reference}
        description={`${job.customerName} · ${job.equipmentName}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to={`/app/jobs/${job.id}`}>
                <ExternalLink className="mr-1 h-4 w-4" /> Open service job
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/app/projects"><ArrowLeft className="mr-1 h-4 w-4" /> Projects</Link>
            </Button>
          </div>
        }
      />
      <div className="flex items-center gap-3">
        <StatusBadge status={job.status} />
        <span className="text-sm text-muted-foreground">{job.progress}% complete · Lead: {job.engineer}</span>
      </div>
      <Card className="max-w-xl">
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
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Add to team
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
    </div>
  );
}
