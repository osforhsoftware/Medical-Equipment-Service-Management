import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { CheckCircle2, ChevronRight, Circle, Loader2, UserCheck } from "lucide-react";
import {
  ActivityTimeline,
  DetailInfoGrid,
  DetailSection,
  RecordDetailLayout,
} from "@/components/shared/RecordDetailLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import {
  api,
  ApiError,
  type BackendServiceRequest,
  type BackendTimelineEvent,
  type BackendUser,
} from "@/lib/api";
import { formatFixedOption, SERVICE_TYPE_OPTIONS } from "@/lib/fixedOptions";
import { formatDate, formatDateTime, formatServiceStatus } from "@/lib/format";
import { roleLabels } from "@/data/mock";
import type { Role } from "@/data/types";
import { toast } from "@/lib/toast";

const WORKFLOW_STEPS = [
  { status: "new", label: "New" },
  { status: "inspection", label: "Inspection" },
  { status: "estimate", label: "Estimate" },
  { status: "approval", label: "Approval" },
  { status: "inProgress", label: "In Progress" },
  { status: "invoiced", label: "Invoiced" },
  { status: "completed", label: "Completed" },
] as const;

const ASSIGNABLE_ROLES: Role[] = ["coordinator", "inspector", "estimator", "engineer", "inventory", "billing"];

function formatServiceType(type: string, typeOther?: string | null) {
  return formatFixedOption(SERVICE_TYPE_OPTIONS, type, typeOther);
}

export default function ServiceRequestDetail() {
  const { id = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [request, setRequest] = useState<BackendServiceRequest | null>(null);
  const [timeline, setTimeline] = useState<BackendTimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [workflowStatus, setWorkflowStatus] = useState("");
  const [workflowNote, setWorkflowNote] = useState("");
  const [workflowSaving, setWorkflowSaving] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignRole, setAssignRole] = useState<Role | "">("");
  const [assignStaff, setAssignStaff] = useState<BackendUser[]>([]);
  const [assignTarget, setAssignTarget] = useState<BackendUser | null>(null);
  const [assignNote, setAssignNote] = useState("");
  const [assignSaving, setAssignSaving] = useState(false);
  const [loadingAssignStaff, setLoadingAssignStaff] = useState(false);
  const tab = searchParams.get("tab") ?? "overview";

  const canCreate = user?.role === "coordinator" || user?.role === "admin";
  const canAssign = user?.role === "admin" || user?.role === "coordinator";

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [record, events] = await Promise.all([
        api.getServiceRequest(id),
        api.getServiceRequestTimeline(id),
      ]);
      setRequest(record);
      setTimeline(events);
    } catch (err) {
      setRequest(null);
      setError(err instanceof ApiError && err.status === 404 ? null : "Please try again.");
      if (!(err instanceof ApiError && err.status === 404)) {
        toast.apiError(err, { fallback: "Failed to load service ticket" });
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!assignOpen || !assignRole) {
      setAssignStaff([]);
      return;
    }
    setLoadingAssignStaff(true);
    void api.listUsers({ role: assignRole, isActive: true })
      .then(setAssignStaff)
      .catch(() => setAssignStaff([]))
      .finally(() => setLoadingAssignStaff(false));
  }, [assignOpen, assignRole]);

  const currentStepIndex = WORKFLOW_STEPS.findIndex((s) => s.status === request?.status || formatServiceStatus(request?.status ?? "") === s.status);

  const submitWorkflow = async () => {
    if (!request || !workflowStatus || !workflowNote.trim()) return;
    setWorkflowSaving(true);
    try {
      const updated = await api.advanceWorkflow(request.id, { status: workflowStatus, note: workflowNote.trim() });
      setRequest(updated);
      setWorkflowOpen(false);
      setWorkflowNote("");
      toast({ title: "Workflow advanced" });
      setTimeline(await api.getServiceRequestTimeline(request.id));
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to advance workflow" });
    } finally {
      setWorkflowSaving(false);
    }
  };

  const submitAssign = async () => {
    if (!request || !assignTarget) return;
    setAssignSaving(true);
    try {
      const updated = await api.assignServiceRequest(request.id, {
        assignedTo: assignTarget.id,
        note: assignNote.trim() || undefined,
      });
      setRequest(updated);
      setAssignOpen(false);
      setAssignTarget(null);
      setAssignNote("");
      setAssignRole("");
      toast({ title: "Staff assigned", description: assignTarget.name });
      setTimeline(await api.getServiceRequestTimeline(request.id));
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to assign" });
    } finally {
      setAssignSaving(false);
    }
  };

  return (
    <>
      <RecordDetailLayout
        backTo="/app/service-tickets"
        backLabel="Back to Service Tickets"
        title={request?.reference ?? "Service ticket"}
        subtitle={request ? (
          <>
            {request.equipmentItems?.length
              ? request.equipmentItems.map((e) => e.equipmentName).join(" · ")
              : (request.equipmentName ?? "No equipment")}
            {" · "}{request.customerName}
          </>
        ) : undefined}
        status={request ? formatServiceStatus(request.status) : undefined}
        meta={request ? [
          { label: "Priority", value: request.priority },
          { label: "Assigned", value: request.assignedName ?? request.assignedTo ?? "Unassigned" },
          { label: "SLA due", value: formatDate(request.slaDue) },
        ] : undefined}
        loading={loading}
        error={error}
        notFound={!loading && !error && !request}
        notFoundTitle="Service ticket not found"
        notFoundDescription="The requested service ticket could not be found."
        onRetry={() => void load()}
        actions={request?.customerId ? (
          <Button asChild variant="outline">
            <Link to={`/app/customers/${request.customerId}`}>View customer</Link>
          </Button>
        ) : undefined}
        activeTab={tab}
        onTabChange={(value) => setSearchParams(value === "overview" ? {} : { tab: value })}
        tabs={request ? [
          {
            id: "overview",
            label: "Overview",
            content: (
              <div className="space-y-4">
                <DetailSection title="Workflow progress">
                  <div className="flex items-center gap-0 overflow-x-auto pb-1">
                    {WORKFLOW_STEPS.map((step, idx) => {
                      const done = idx < currentStepIndex;
                      const active = idx === currentStepIndex;
                      return (
                        <div key={step.status} className="flex items-center shrink-0">
                          <div className={`flex flex-col items-center gap-1 ${active ? "text-primary" : done ? "text-success" : "text-muted-foreground"}`}>
                            {done ? <CheckCircle2 className="h-4 w-4 text-success" /> : active ? <div className="h-4 w-4 rounded-full border-2 border-primary bg-primary/20" /> : <Circle className="h-4 w-4" />}
                            <span className="text-[10px] font-medium whitespace-nowrap">{step.label}</span>
                          </div>
                          {idx < WORKFLOW_STEPS.length - 1 && <ChevronRight className="mx-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                        </div>
                      );
                    })}
                  </div>
                </DetailSection>
                <DetailSection title="Ticket details">
                  <DetailInfoGrid
                    items={[
                      { label: "Type", value: formatServiceType(request.type, request.typeOther) },
                      { label: "Priority", value: request.priority },
                      { label: "Created by", value: request.createdBy },
                      { label: "Assigned to", value: request.assignedName ?? request.assignedTo ?? "Unassigned" },
                      { label: "Created", value: formatDate(request.createdAt) },
                      { label: "SLA due", value: formatDate(request.slaDue) },
                      { label: "Customer", value: request.customerId ? (
                        <Link className="text-primary hover:underline normal-case" to={`/app/customers/${request.customerId}`}>{request.customerName}</Link>
                      ) : request.customerName },
                    ]}
                  />
                </DetailSection>
                {request.equipmentItems && request.equipmentItems.length > 0 ? (
                  <DetailSection title={`Equipment (${request.equipmentItems.length})`}>
                    <div className="flex flex-wrap gap-1.5">
                      {request.equipmentItems.map((e) => (
                        <Badge key={e.id} variant="secondary" className="text-xs">
                          {e.equipmentId ? <Link to={`/app/equipment/${e.equipmentId}`}>{e.equipmentName}</Link> : e.equipmentName}
                        </Badge>
                      ))}
                    </div>
                  </DetailSection>
                ) : null}
                <DetailSection title="Description">
                  <p className="rounded-lg bg-muted/50 p-3 text-sm">{request.description}</p>
                </DetailSection>
              </div>
            ),
          },
          {
            id: "activity",
            label: "Activity",
            content: (
              <DetailSection title="Activity timeline">
                <ActivityTimeline
                  items={timeline.map((t) => ({
                    id: t.id,
                    title: t.action,
                    detail: t.note,
                    meta: `${t.actor} · ${formatDateTime(t.at)}`,
                  }))}
                />
              </DetailSection>
            ),
          },
        ] : undefined}
        sidebar={request ? (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Actions</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {canCreate && currentStepIndex >= 0 && currentStepIndex < WORKFLOW_STEPS.length - 1 ? (
                <Button
                  className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90"
                  onClick={() => {
                    const next = WORKFLOW_STEPS[currentStepIndex + 1];
                    if (next) {
                      setWorkflowStatus(next.status);
                      setWorkflowNote("");
                      setWorkflowOpen(true);
                    }
                  }}
                >
                  Move to {WORKFLOW_STEPS[currentStepIndex + 1]?.label ?? "Next"}
                </Button>
              ) : null}
              {canAssign ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setAssignOpen(true);
                    setAssignRole("");
                    setAssignTarget(null);
                    setAssignNote("");
                  }}
                >
                  <UserCheck className="mr-1.5 h-4 w-4" /> Assign / Reassign
                </Button>
              ) : null}
              {request.status === "estimate" || request.status === "inspection" || request.status === "approval" ? (
                <Button asChild variant="outline" className="w-full">
                  <Link to={`/app/estimates/${request.id}/build`}>Open estimate builder</Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : undefined}
      />

      <Dialog open={workflowOpen} onOpenChange={setWorkflowOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Advance workflow</DialogTitle>
            <DialogDescription>Add a note before advancing the workflow stage.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label>Note / Comment</Label>
            <Textarea value={workflowNote} onChange={(e) => setWorkflowNote(e.target.value)} rows={4} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWorkflowOpen(false)}>Cancel</Button>
            <Button onClick={() => void submitWorkflow()} disabled={workflowSaving || !workflowNote.trim()} variant="brand">
              {workflowSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Advance Stage
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign / Reassign Staff</DialogTitle>
            <DialogDescription>Select a role then pick the staff member.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label>Select Role</Label>
              <Select value={assignRole} onValueChange={(v) => { setAssignRole(v as Role); setAssignTarget(null); }}>
                <SelectTrigger><SelectValue placeholder="Choose a role…" /></SelectTrigger>
                <SelectContent>
                  {ASSIGNABLE_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {assignRole ? (
              <div className="grid gap-2">
                <Label>Staff — {roleLabels[assignRole as Role]}</Label>
                {loadingAssignStaff ? (
                  <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading staff…
                  </div>
                ) : (
                  <Select
                    value={assignTarget?.id ?? ""}
                    onValueChange={(v) => setAssignTarget(assignStaff.find((s) => s.id === v) ?? null)}
                  >
                    <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                    <SelectContent>
                      {assignStaff.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label>Note</Label>
              <Textarea value={assignNote} onChange={(e) => setAssignNote(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button onClick={() => void submitAssign()} disabled={assignSaving || !assignTarget}>
              {assignSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
