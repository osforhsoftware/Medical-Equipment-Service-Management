import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { CheckCircle2, ChevronRight, Circle, FileText, Loader2, UserCheck } from "lucide-react";
import { FormFieldError } from "@/components/shared/FormFieldError";
import { RequiredMark } from "@/components/shared/RequiredMark";
import { useFormValidation } from "@/hooks/useFormValidation";
import { fieldAria, fieldErrorClass, fieldRules } from "@/lib/formValidation";
import {
  ActivityTimeline,
  DetailInfoGrid,
  DetailSection,
  RecordDetailLayout,
} from "@/components/shared/RecordDetailLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ESTIMATE_WRITE_ROLES } from "@/config/roles";
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
  { status: "new", statuses: ["new"], label: "New" },
  { status: "inspection", statuses: ["inspection"], label: "Inspection" },
  { status: "estimate", statuses: ["estimate"], label: "Estimate" },
  { status: "approval", statuses: ["approval", "pending_approval"], label: "Approval" },
  {
    status: "inProgress",
    statuses: ["inProgress", "assigned_engineer", "change_pending_approval", "pending_final_approval"],
    label: "In Progress",
  },
  { status: "invoiced", statuses: ["pending_invoice", "invoiced"], label: "Invoiced" },
  { status: "completed", statuses: ["completed", "closed", "finished"], label: "Completed" },
] as const;

const ASSIGNABLE_ROLES: Role[] = ["coordinator", "inspector", "estimator", "engineer", "inventory", "billing"];

const workflowSchema = z.object({
  note: fieldRules.requiredString("Note"),
});

const assignSchema = z.object({
  assignRole: fieldRules.selectRequired("a role"),
  assignNote: fieldRules.optionalString(),
});

function formatServiceType(type: string, typeOther?: string | null) {
  return formatFixedOption(SERVICE_TYPE_OPTIONS, type, typeOther);
}

export default function ServiceRequestDetail() {
  const { id = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasRole } = useAuth();
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
  const workflowDialogRef = useRef<HTMLDivElement>(null);
  const assignDialogRef = useRef<HTMLDivElement>(null);
  const tab = searchParams.get("tab") ?? "overview";

  const workflowValidation = useFormValidation({
    fieldOrder: ["note"],
    schema: workflowSchema,
  });

  const assignValidation = useFormValidation({
    fieldOrder: ["assignRole", "assignTarget"],
    schema: assignSchema,
  });

  const canCreate = hasRole(["admin", "coordinator"]);
  const canAssign = hasRole(["admin", "coordinator"]);
  const canBuildEstimate = hasRole(ESTIMATE_WRITE_ROLES);
  const canApproveEstimate = hasRole(["admin", "coordinator"]);

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

  const currentStepIndex = WORKFLOW_STEPS.findIndex((step) =>
    (step.statuses as readonly string[]).includes(request?.status ?? ""),
  );
  const isEstimateStage = request?.status === "estimate";
  const isInspectionStage = request?.status === "inspection";
  const isApprovalStage = ["approval", "pending_approval"].includes(request?.status ?? "");

  const submitWorkflow = async () => {
    if (!request || !workflowStatus) return;
    const values = { note: workflowNote };
    if (!workflowValidation.validateAll(values, undefined, workflowDialogRef.current)) return;

    setWorkflowSaving(true);
    try {
      const updated = await api.advanceWorkflow(request.id, { status: workflowStatus, note: workflowNote.trim() });
      setRequest(updated);
      setWorkflowOpen(false);
      setWorkflowNote("");
      workflowValidation.reset();
      toast({ title: "Workflow advanced" });
      setTimeline(await api.getServiceRequestTimeline(request.id));
    } catch (err) {
      if (!workflowValidation.applyApiErrors(err, workflowDialogRef.current)) {
        toast.apiError(err, { fallback: "Unable to advance workflow" });
      }
    } finally {
      setWorkflowSaving(false);
    }
  };

  const submitAssign = async () => {
    if (!request) return;
    const values = { assignRole, assignNote };
    const extraErrors: Record<string, string> = {};
    if (assignRole && !assignTarget) {
      extraErrors.assignTarget = "Select a staff member.";
    }
    if (!assignValidation.validateAll(values, extraErrors, assignDialogRef.current)) return;

    setAssignSaving(true);
    try {
      const updated = await api.assignServiceRequest(request.id, {
        assignedTo: assignTarget!.id,
        role: assignRole || undefined,
        note: assignNote.trim() || undefined,
      });
      setRequest(updated);
      setAssignOpen(false);
      setAssignTarget(null);
      setAssignNote("");
      setAssignRole("");
      assignValidation.reset();
      toast({
        title: "Staff assigned",
        description: assignRole === "estimator" && request.status === "inspection"
          ? `${assignTarget!.name} assigned. Ticket moved to Estimate.`
          : assignTarget!.name,
      });
      setTimeline(await api.getServiceRequestTimeline(request.id));
    } catch (err) {
      if (!assignValidation.applyApiErrors(err, assignDialogRef.current)) {
        toast.apiError(err, { fallback: "Unable to assign" });
      }
    } finally {
      setAssignSaving(false);
    }
  };

  const confirmCompletedWork = async () => {
    if (!request) return;
    setWorkflowSaving(true);
    try {
      const updated = await api.grantTicketFinalApproval(request.id, {
        note: "Completed work confirmed by the service coordinator.",
      });
      setRequest(updated);
      setTimeline(await api.getServiceRequestTimeline(request.id));
      toast({ title: "Completed work confirmed", description: "The ticket is ready for invoicing." });
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to confirm completed work" });
    } finally {
      setWorkflowSaving(false);
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
          { label: "Estimate staff", value: request.assignedEstimatorName ?? "Unassigned" },
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
                  {isEstimateStage && canBuildEstimate ? (
                    <Alert className="mt-4">
                      <FileText className="h-4 w-4" />
                      <AlertTitle>Estimate stage</AlertTitle>
                      <AlertDescription>
                        {request.assignedEstimatorName
                          ? `${request.assignedEstimatorName} should build the quotation, then use Send for Approval to continue to Approval.`
                          : "Assign Estimate Staff, then build the quotation and send it for approval to continue."}
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  {isInspectionStage && canBuildEstimate ? (
                    <Alert className="mt-4">
                      <FileText className="h-4 w-4" />
                      <AlertTitle>Inspection in progress</AlertTitle>
                      <AlertDescription>
                        Once the inspection report is submitted, this ticket moves to Estimate. You can prepare the quotation in the estimate builder at any time.
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  {isApprovalStage && canApproveEstimate ? (
                    <Alert className="mt-4">
                      <FileText className="h-4 w-4" />
                      <AlertTitle>Awaiting approval</AlertTitle>
                      <AlertDescription>
                        Review the estimate, assign an engineer, and approve to move this ticket into service.
                      </AlertDescription>
                    </Alert>
                  ) : null}
                </DetailSection>
                <DetailSection title="Ticket details">
                  <DetailInfoGrid
                    items={[
                      { label: "Type", value: formatServiceType(request.type, request.typeOther) },
                      { label: "Priority", value: request.priority },
                      { label: "Created by", value: request.createdBy },
                      { label: "Assigned to", value: request.assignedName ?? request.assignedTo ?? "Unassigned" },
                      { label: "Inspection technician", value: request.assignedInspectorName ?? "—" },
                      { label: "Estimate staff", value: request.assignedEstimatorName ?? "—" },
                      { label: "Service engineer", value: request.assignedEngineerName ?? "—" },
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
              {canCreate && currentStepIndex >= 0 && currentStepIndex < 2 ? (
                <Button
                  className="w-full"
                  onClick={() => {
                    const next = WORKFLOW_STEPS[currentStepIndex + 1];
                    if (next) {
                      setWorkflowStatus(next.status);
                      setWorkflowNote("");
                      workflowValidation.reset();
                      setWorkflowOpen(true);
                    }
                  }}
                >
                  Move to {WORKFLOW_STEPS[currentStepIndex + 1]?.label ?? "Next"}
                </Button>
              ) : null}
              {canAssign && isEstimateStage && !request.assignedEstimatorId ? (
                <Button
                  variant="brand"
                  className="w-full"
                  onClick={() => {
                    setAssignOpen(true);
                    setAssignRole("estimator");
                    setAssignTarget(null);
                    setAssignNote("");
                    assignValidation.reset();
                  }}
                >
                  <UserCheck className="mr-1.5 h-4 w-4" /> Assign estimate staff
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
                    assignValidation.reset();
                  }}
                >
                  <UserCheck className="mr-1.5 h-4 w-4" /> Assign / Reassign
                </Button>
              ) : null}
              {canBuildEstimate && (isEstimateStage || isInspectionStage) ? (
                <Button asChild variant={isEstimateStage ? "brand" : "outline"} className="w-full">
                  <Link to={`/app/estimates/${request.id}/build`}>
                    {isEstimateStage ? "Build estimate & send for approval" : "Open estimate builder"}
                  </Link>
                </Button>
              ) : null}
              {canApproveEstimate && ["approval", "pending_approval"].includes(request.status) ? (
                <Button asChild variant="outline" className="w-full">
                  <Link to={`/app/estimates?status=pendingAdminApproval&search=${encodeURIComponent(request.reference)}`}>
                    Review estimate & assign engineer
                  </Link>
                </Button>
              ) : null}
              {canApproveEstimate && request.status === "pending_final_approval" ? (
                <Button
                  className="w-full"
                  disabled={workflowSaving}
                  onClick={() => void confirmCompletedWork()}
                >
                  {workflowSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Confirm completed work
                </Button>
              ) : null}
              <Button asChild variant="outline" className="w-full">
                <Link to={`/app/inspections/${request.id}`}>View inspection details</Link>
              </Button>
            </CardContent>
          </Card>
        ) : undefined}
      />

      <Dialog open={workflowOpen} onOpenChange={(open) => { if (!open) workflowValidation.reset(); setWorkflowOpen(open); }}>
        <DialogContent ref={workflowDialogRef} className="max-w-md">
          <DialogHeader>
            <DialogTitle>Advance workflow</DialogTitle>
            <DialogDescription>Add a note before advancing the workflow stage.</DialogDescription>
          </DialogHeader>
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void submitWorkflow();
            }}
          >
            <div className="grid gap-2 py-2" data-field="note">
              <Label htmlFor="workflow-note" className={workflowValidation.shouldShow("note") ? "text-destructive" : undefined}>
                Note / Comment
                <RequiredMark />
              </Label>
              <Textarea
                id="workflow-note"
                name="note"
                value={workflowNote}
                rows={4}
                className={fieldErrorClass(workflowValidation.shouldShow("note"))}
                {...fieldAria("note", workflowValidation.shouldShow("note") ? workflowValidation.errors.note : null)}
                onChange={(e) => {
                  setWorkflowNote(e.target.value);
                  workflowValidation.handleChange("note", { note: e.target.value });
                }}
                onBlur={() => workflowValidation.handleBlur("note", { note: workflowNote })}
              />
              {workflowValidation.shouldShow("note") && (
                <FormFieldError field="note" message={workflowValidation.errors.note} />
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setWorkflowOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={workflowSaving} variant="brand">
                {workflowSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Advance Stage
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={assignOpen} onOpenChange={(open) => { if (!open) assignValidation.reset(); setAssignOpen(open); }}>
        <DialogContent ref={assignDialogRef} className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign / Reassign Staff</DialogTitle>
            <DialogDescription>Select a role then pick the staff member.</DialogDescription>
          </DialogHeader>
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void submitAssign();
            }}
          >
            <div className="space-y-4 py-2">
              <div className="grid gap-2" data-field="assignRole">
                <Label className={assignValidation.shouldShow("assignRole") ? "text-destructive" : undefined}>
                  Select Role
                  <RequiredMark />
                </Label>
                <Select
                  value={assignRole}
                  onValueChange={(v) => {
                    setAssignRole(v as Role);
                    setAssignTarget(null);
                    assignValidation.clearError("assignRole");
                    assignValidation.clearError("assignTarget");
                    assignValidation.handleChange("assignRole", { assignRole: v, assignNote });
                  }}
                >
                  <SelectTrigger
                    id="assignRole"
                    className={fieldErrorClass(assignValidation.shouldShow("assignRole"))}
                    {...fieldAria("assignRole", assignValidation.shouldShow("assignRole") ? assignValidation.errors.assignRole : null)}
                  >
                    <SelectValue placeholder="Choose a role…" />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNABLE_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {assignValidation.shouldShow("assignRole") && (
                  <FormFieldError field="assignRole" message={assignValidation.errors.assignRole} />
                )}
              </div>
              {assignRole ? (
                <div className="grid gap-2" data-field="assignTarget">
                  <Label className={assignValidation.shouldShow("assignTarget") ? "text-destructive" : undefined}>
                    Staff — {roleLabels[assignRole as Role]}
                    <RequiredMark />
                  </Label>
                  {loadingAssignStaff ? (
                    <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading staff…
                    </div>
                  ) : assignStaff.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-1">
                      No active {roleLabels[assignRole as Role]} accounts. Add one in Users, or pick this role as an extra role on an existing staff member.
                    </p>
                  ) : (
                    <Select
                      value={assignTarget?.id ?? ""}
                      onValueChange={(v) => {
                        setAssignTarget(assignStaff.find((s) => s.id === v) ?? null);
                        assignValidation.clearError("assignTarget");
                      }}
                    >
                      <SelectTrigger
                        id="assignTarget"
                        className={fieldErrorClass(assignValidation.shouldShow("assignTarget"))}
                        {...fieldAria("assignTarget", assignValidation.shouldShow("assignTarget") ? assignValidation.errors.assignTarget : null)}
                      >
                        <SelectValue placeholder="Select staff" />
                      </SelectTrigger>
                      <SelectContent>
                        {assignStaff.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {assignValidation.shouldShow("assignTarget") && (
                    <FormFieldError field="assignTarget" message={assignValidation.errors.assignTarget} />
                  )}
                </div>
              ) : null}
              <div className="grid gap-2" data-field="assignNote">
                <Label htmlFor="assign-note">Note</Label>
                <Textarea
                  id="assign-note"
                  name="assignNote"
                  value={assignNote}
                  rows={2}
                  onChange={(e) => {
                    setAssignNote(e.target.value);
                    assignValidation.handleChange("assignNote", { assignRole, assignNote: e.target.value });
                  }}
                  onBlur={() => assignValidation.handleBlur("assignNote", { assignRole, assignNote })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={assignSaving}>
                {assignSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Assign
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
