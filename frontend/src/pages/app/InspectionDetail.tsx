import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { FilePenLine, FileText, Loader2, Pencil, Trash2 } from "lucide-react";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { CustomerAdditionalFieldsEditor } from "@/components/customers/CustomerAdditionalFieldsEditor";
import { InspectionReportPanel } from "@/components/inspections/InspectionReportPanel";
import { InspectionSignaturePanel } from "@/components/inspections/InspectionSignaturePanel";
import { splitInspectionFindings, useInspectionReportEditor } from "@/components/inspections/useInspectionReportEditor";
import { FormFieldError } from "@/components/shared/FormFieldError";
import { RequiredMark } from "@/components/shared/RequiredMark";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import {
  ActivityTimeline,
  DetailInfoGrid,
  DetailSection,
  RecordDetailLayout,
} from "@/components/shared/RecordDetailLayout";
import { PhotoCaptionTile } from "@/components/shared/PhotoCaptionTile";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TICKET_CREATE_ROLES } from "@/config/roles";
import { useAuth } from "@/context/AuthContext";
import { useFormValidation } from "@/hooks/useFormValidation";
import { api, ApiError, type BackendInspectionReport, type BackendServiceRequest, type BackendTimelineEvent } from "@/lib/api";
import {
  parseCustomerAdditionalFields,
  sanitizeCustomerAdditionalFields,
  type CustomerAdditionalField,
} from "@/lib/customerFields";
import { formatFixedOption, SERVICE_TYPE_OPTIONS } from "@/lib/fixedOptions";
import { fieldAria, fieldErrorClass } from "@/lib/formValidation";
import { formatCurrency, formatDate, formatDateTime, formatServiceStatus } from "@/lib/format";
import { toast } from "@/lib/toast";

const editSchema = z.object({
  type: z.string().optional(),
  typeOther: z.string().optional(),
  priority: z.string().min(1, "Select priority"),
  description: z.string().trim().max(500),
}).superRefine((data, ctx) => {
  if (data.type === "Other" && !data.typeOther?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["typeOther"], message: "Please specify the service type" });
  }
});

function equipmentLabel(request: BackendServiceRequest) {
  if (request.equipmentItems?.length) {
    return request.equipmentItems.map((e) => e.equipmentName).join(" · ");
  }
  return request.equipmentName ?? "No equipment";
}

export default function InspectionDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const [searchParams] = useSearchParams();
  const fromHistory = searchParams.get("from") === "history";
  const [request, setRequest] = useState<BackendServiceRequest | null>(null);
  const [report, setReport] = useState<BackendInspectionReport | null>(null);
  const [timeline, setTimeline] = useState<BackendTimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    type: "",
    typeOther: "",
    priority: "",
    description: "",
    additionalFields: [{ label: "", value: "" }] as CustomerAdditionalField[],
  });
  const editDialogRef = useRef<HTMLDivElement>(null);
  const editValidation = useFormValidation({
    fieldOrder: ["type", "typeOther", "priority", "description"],
    schema: editSchema,
  });
  const canEdit = hasRole(TICKET_CREATE_ROLES);
  const canDelete = hasRole(TICKET_CREATE_ROLES);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [record, inspection, events] = await Promise.all([
        api.getServiceRequest(id),
        api.getInspectionReport(id).catch(() => null),
        api.getServiceRequestTimeline(id).catch(() => [] as BackendTimelineEvent[]),
      ]);
      setRequest(record);
      setReport(inspection ?? record.inspectionReport);
      setTimeline(events);
    } catch (err) {
      setRequest(null);
      setReport(null);
      setError(err instanceof ApiError && err.status === 404 ? null : "Please try again.");
      if (!(err instanceof ApiError && err.status === 404)) {
        toast.apiError(err, { fallback: "Failed to load inspection details" });
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const editor = useInspectionReportEditor(load);
  const split = splitInspectionFindings(report?.findings ?? "");
  const canInspect = Boolean(request) && ["new", "inspection", "estimate"].includes(request!.status);
  const inspectLabel = report ? "Update report" : "Conduct inspection";

  const openEditTicket = () => {
    if (!request) return;
    const fields = parseCustomerAdditionalFields(request.additionalFields);
    setEditForm({
      type: request.type ?? "",
      typeOther: request.typeOther ?? "",
      priority: request.priority,
      description: request.description ?? "",
      additionalFields: fields.length ? fields : [{ label: "", value: "" }],
    });
    editValidation.reset();
    setEditOpen(true);
  };

  const submitEdit = async () => {
    if (!request) return;
    if (!editValidation.validateAll(editForm, undefined, editDialogRef.current)) return;
    const parsed = editSchema.safeParse(editForm);
    if (!parsed.success) return;

    setEditSaving(true);
    try {
      const updated = await api.updateServiceRequest(request.id, {
        type: parsed.data.type || null,
        typeOther: parsed.data.type === "Other" ? parsed.data.typeOther?.trim() || null : null,
        priority: parsed.data.priority,
        description: parsed.data.description,
        additionalFields: sanitizeCustomerAdditionalFields(editForm.additionalFields),
      });
      setRequest(updated);
      toast.success("Ticket updated");
      setEditOpen(false);
      editValidation.reset();
    } catch (err) {
      if (!editValidation.applyApiErrors(err, editDialogRef.current)) {
        toast.apiError(err, { fallback: "Unable to update ticket" });
      }
    } finally {
      setEditSaving(false);
    }
  };

  const deleteTicket = async () => {
    if (!request) return;
    setDeleting(true);
    try {
      await api.deleteServiceRequest(request.id);
      toast.success("Ticket deleted", { description: request.reference });
      setDeleteOpen(false);
      navigate(fromHistory ? "/app/inspections?view=history" : "/app/inspections");
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to delete ticket" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <RoleGuard roles={["admin", "coordinator", "inspector"]}>
      <RecordDetailLayout
        backTo={fromHistory ? "/app/inspections?view=history" : "/app/inspections"}
        backLabel={fromHistory ? "Back to inspection history" : "Back to inspections"}
        title={request?.reference ?? "Inspection"}
        subtitle={request ? `${equipmentLabel(request)} · ${request.customerName}` : undefined}
        status={request?.status}
        meta={request ? [
          { label: "Priority", value: request.priority },
          { label: "Assigned", value: request.assignedName ?? "Unassigned" },
          { label: "SLA due", value: formatDate(request.slaDue) },
        ] : undefined}
        loading={loading}
        error={error}
        notFound={!loading && !error && !request}
        notFoundTitle="Inspection not found"
        notFoundDescription="This inspection ticket could not be found."
        onRetry={() => void load()}
        actions={request ? (
          <div className="flex flex-wrap items-center gap-2">
            {canEdit ? (
              <Button variant="outline" onClick={openEditTicket}>
                <Pencil className="mr-1.5 h-4 w-4" />
                Edit
              </Button>
            ) : null}
            {canDelete ? (
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                disabled={deleting}
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Delete
              </Button>
            ) : null}
            {report ? (
              <Button variant="outline" asChild>
                <Link to={`/app/inspections/${request.id}/report${fromHistory ? "?from=history" : ""}`}>
                  <FileText className="mr-1.5 h-4 w-4" />
                  Full report
                </Link>
              </Button>
            ) : null}
            {canInspect ? (
              <Button variant="brand" onClick={() => void editor.startInspection(request)}>
                <FilePenLine className="mr-1.5 h-4 w-4" />
                {inspectLabel}
              </Button>
            ) : null}
          </div>
        ) : undefined}
        sidebar={request ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Related</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button asChild variant="outline" className="w-full">
                <Link to={`/app/service-tickets/${request.id}`}>Open service ticket</Link>
              </Button>
              {request.customerId ? (
                <Button asChild variant="outline" className="w-full">
                  <Link to={`/app/customers/${request.customerId}`}>View customer</Link>
                </Button>
              ) : null}
              {request.status === "estimate" || request.status === "approval" || request.status === "pending_approval" ? (
                <Button asChild variant="outline" className="w-full">
                  <Link to={`/app/estimates/${request.id}/build`}>Open estimate builder</Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : undefined}
      >
        {request ? (
          <div className="space-y-4">
            <DetailSection title="Ticket details">
              <DetailInfoGrid
                items={[
                  { label: "Type", value: request.type ? formatFixedOption(SERVICE_TYPE_OPTIONS, request.type, request.typeOther) : "—" },
                  { label: "Priority", value: request.priority },
                  { label: "Status", value: formatServiceStatus(request.status) },
                  { label: "Created by", value: request.createdBy },
                  { label: "Assigned to", value: request.assignedName ?? "Unassigned" },
                  { label: "Created", value: formatDateTime(request.createdAt) },
                  { label: "Updated", value: formatDateTime(request.updatedAt) },
                  { label: "SLA due", value: formatDate(request.slaDue) },
                  {
                    label: "Customer",
                    value: request.customerId ? (
                      <Link className="text-primary hover:underline normal-case" to={`/app/customers/${request.customerId}`}>
                        {request.customerName}
                      </Link>
                    ) : request.customerName,
                  },
                ]}
              />
            </DetailSection>

            {request.equipmentItems?.length ? (
              <DetailSection title={`Equipment (${request.equipmentItems.length})`}>
                <div className="flex flex-wrap gap-1.5">
                  {request.equipmentItems.map((item) => (
                    <Badge key={item.id} variant="secondary" className="text-xs">
                      {item.equipmentId ? (
                        <Link to={`/app/equipment/${item.equipmentId}`}>{item.equipmentName}</Link>
                      ) : (
                        item.equipmentName
                      )}
                    </Badge>
                  ))}
                </div>
              </DetailSection>
            ) : null}

            <DetailSection title="Request description">
              <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm">
                {request.description || "No description provided."}
              </p>
            </DetailSection>

            {report ? (
              <>
                <DetailSection title="Inspection report">
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <StatusBadge status={report.severity} />
                    <span className="text-sm text-muted-foreground">
                      Filed by {report.reportedBy} · {formatDateTime(report.reportedAt)}
                      {report.submittedAt ? ` · Submitted ${formatDateTime(report.submittedAt)}` : " · Draft"}
                      {report.version ? ` · v${report.version}` : ""}
                    </span>
                  </div>
                  <DetailInfoGrid
                    items={[
                      { label: "Severity", value: report.severity },
                      { label: "Reported by", value: report.reportedBy },
                      { label: "Reported at", value: formatDateTime(report.reportedAt) },
                      { label: "Submitted at", value: report.submittedAt ? formatDateTime(report.submittedAt) : "Not submitted" },
                    ]}
                  />
                </DetailSection>

                <DetailSection title="Findings & observations">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {split.findings.trim() || "No findings recorded."}
                  </p>
                </DetailSection>

                {split.workDetails.trim() ? (
                  <DetailSection title="Work details">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{split.workDetails}</p>
                  </DetailSection>
                ) : null}

                <DetailSection title="Recommendation">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {report.recommendation.trim() || "No recommendation recorded."}
                  </p>
                </DetailSection>

                {parseCustomerAdditionalFields(report.additionalFields).length > 0 ? (
                  <DetailSection title="Additional fields">
                    <DetailInfoGrid
                      items={parseCustomerAdditionalFields(report.additionalFields).filter(f => f.label !== "Inspector Signature" && f.label !== "Admin Signature").map((field) => ({
                        label: field.label,
                        value: field.value || "—",
                      }))}
                    />
                  </DetailSection>
                ) : null}

                {(() => {
                  const fields = parseCustomerAdditionalFields(report.additionalFields);
                  const inspSig = fields.find((f) => f.label === "Inspector Signature")?.value;
                  const admSig = fields.find((f) => f.label === "Admin Signature")?.value;
                  if (!inspSig && !admSig) return null;
                  return (
                    <DetailSection title="Signatures">
                      <InspectionSignaturePanel
                        readOnly
                        signatures={{
                          inspectorSignature: {
                            name: report.reportedBy,
                            dataUrl: inspSig || null,
                            capturedAt: inspSig ? (report.submittedAt ? String(report.submittedAt) : String(report.reportedAt)) : null,
                          },
                          approvalSignature: {
                            name: "Admin / Coordinator",
                            dataUrl: admSig || null,
                            capturedAt: admSig ? (report.submittedAt ? String(report.submittedAt) : String(report.reportedAt)) : null,
                          },
                        }}
                      />
                    </DetailSection>
                  );
                })()}

                {report.attachments?.length ? (
                  <DetailSection title={`Photos (${report.attachments.length})`}>
                    <div className="flex flex-wrap gap-3">
                      {report.attachments.map((att) => (
                        <PhotoCaptionTile
                          key={att.id}
                          src={api.fileDownloadUrl(att.fileId)}
                          alt={att.file?.originalName ?? att.caption ?? "Inspection image"}
                          caption={att.caption ?? ""}
                          href={api.fileDownloadUrl(att.fileId)}
                          readOnly
                          className="w-32 sm:w-36"
                        />
                      ))}
                    </div>
                  </DetailSection>
                ) : null}

                {report.recommendations?.length ? (
                  <DetailSection title="Recommended parts & work">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-border text-xs text-muted-foreground">
                            <th className="pb-2 pr-3 font-medium">Item</th>
                            <th className="pb-2 pr-3 font-medium">Type</th>
                            <th className="pb-2 pr-3 font-medium">Qty</th>
                            <th className="pb-2 pr-3 font-medium">Priority</th>
                            <th className="pb-2 font-medium">Est. cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.recommendations.map((item) => (
                            <tr key={item.id} className="border-b border-border/60 last:border-0">
                              <td className="py-2.5 pr-3">
                                <p className="font-medium">{item.title}</p>
                                {item.description ? (
                                  <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
                                ) : null}
                              </td>
                              <td className="py-2.5 pr-3 capitalize">{item.type}</td>
                              <td className="py-2.5 pr-3">{item.quantity}</td>
                              <td className="py-2.5 pr-3">
                                <StatusBadge status={item.priority} className="text-[10px]" />
                              </td>
                              <td className="py-2.5">{formatCurrency(item.estimatedCost)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </DetailSection>
                ) : null}
              </>
            ) : (
              <DetailSection title="Inspection report">
                <p className="text-sm text-muted-foreground">No inspection report has been filed yet.</p>
                {canInspect ? (
                  <Button className="mt-3" variant="brand" onClick={() => void editor.startInspection(request)}>
                    <FilePenLine className="mr-1.5 h-4 w-4" />
                    Conduct inspection
                  </Button>
                ) : null}
              </DetailSection>
            )}

            <DetailSection title="Activity">
              <ActivityTimeline
                items={timeline.map((event) => ({
                  id: event.id,
                  title: event.action,
                  detail: event.note,
                  meta: `${event.actor} · ${formatDateTime(event.at)}`,
                }))}
                emptyMessage="No activity recorded for this inspection yet."
              />
            </DetailSection>
          </div>
        ) : null}
      </RecordDetailLayout>

      <InspectionReportPanel
        open={!!editor.active}
        onClose={editor.closePanel}
        active={editor.active}
        existingReport={editor.existingReport}
        loadingReport={editor.loadingReport}
        saving={editor.saving}
        onSubmit={() => void editor.submitReport()}
        findings={editor.findings}
        setFindings={editor.setFindings}
        recommendation={editor.recommendation}
        setRecommendation={editor.setRecommendation}
        workDetails={editor.workDetails}
        setWorkDetails={editor.setWorkDetails}
        severity={editor.severity}
        setSeverity={editor.setSeverity}
        additionalFields={editor.additionalFields}
        setAdditionalFields={editor.setAdditionalFields}
        machineImages={editor.machineImages}
        setMachineImages={editor.setMachineImages}
        setMachineImage={editor.setMachineImage}
        imageCaptions={editor.imageCaptions}
        setImageCaptions={editor.setImageCaptions}
        newImagePreviews={editor.newImagePreviews}
      />

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          if (!open) editValidation.reset();
          setEditOpen(open);
        }}
      >
        <DialogContent ref={editDialogRef} className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit ticket</DialogTitle>
            <DialogDescription>
              {request
                ? `Update registration details for ${request.reference}.`
                : "Update ticket details."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2" data-field="type">
                <Label>Type</Label>
                <Select
                  value={editForm.type || undefined}
                  onValueChange={(v) => {
                    const next = { ...editForm, type: v, typeOther: v === "Other" ? editForm.typeOther : "" };
                    setEditForm(next);
                    editValidation.clearError("type");
                    if (v !== "Other") editValidation.clearError("typeOther");
                    editValidation.handleChange("type", next);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPE_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2" data-field="priority">
                <Label className={editValidation.shouldShow("priority") ? "text-destructive" : undefined}>
                  Priority
                  <RequiredMark />
                </Label>
                <Select
                  value={editForm.priority}
                  onValueChange={(v) => {
                    const next = { ...editForm, priority: v };
                    setEditForm(next);
                    editValidation.clearError("priority");
                    editValidation.handleChange("priority", next);
                  }}
                >
                  <SelectTrigger
                    className={fieldErrorClass(editValidation.shouldShow("priority"))}
                    {...fieldAria("priority", editValidation.shouldShow("priority") ? editValidation.errors.priority : null)}
                  >
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {["low", "medium", "high", "critical"].map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editValidation.shouldShow("priority") && (
                  <FormFieldError field="priority" message={editValidation.errors.priority} />
                )}
              </div>
            </div>
            {editForm.type === "Other" && (
              <div className="grid gap-2" data-field="typeOther">
                <Label className={editValidation.shouldShow("typeOther") ? "text-destructive" : undefined}>
                  Specify type
                  <RequiredMark />
                </Label>
                <Input
                  value={editForm.typeOther}
                  onChange={(e) => {
                    const next = { ...editForm, typeOther: e.target.value };
                    setEditForm(next);
                    editValidation.handleChange("typeOther", next);
                  }}
                  onBlur={() => editValidation.handleBlur("typeOther", editForm)}
                  className={fieldErrorClass(editValidation.shouldShow("typeOther"))}
                  {...fieldAria("typeOther", editValidation.shouldShow("typeOther") ? editValidation.errors.typeOther : null)}
                  placeholder="e.g. Relocation, Decommission"
                />
                {editValidation.shouldShow("typeOther") && (
                  <FormFieldError field="typeOther" message={editValidation.errors.typeOther} />
                )}
              </div>
            )}
            <div className="grid gap-2" data-field="description">
              <Label>Description</Label>
              <Textarea
                value={editForm.description}
                onChange={(e) => {
                  const next = { ...editForm, description: e.target.value.slice(0, 500) };
                  setEditForm(next);
                  editValidation.handleChange("description", next);
                }}
                onBlur={() => editValidation.handleBlur("description", editForm)}
                className={fieldErrorClass(editValidation.shouldShow("description"))}
                {...fieldAria("description", editValidation.shouldShow("description") ? editValidation.errors.description : null)}
                rows={3}
              />
              {editValidation.shouldShow("description") && (
                <FormFieldError field="description" message={editValidation.errors.description} />
              )}
            </div>
            <CustomerAdditionalFieldsEditor
              value={editForm.additionalFields}
              onChange={(additionalFields) => setEditForm({ ...editForm, additionalFields })}
              title="Additional registration fields"
              description="Optional custom fields (site contact, accessories received, PO reference, etc.)."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={() => void submitEdit()} disabled={editSaving || deleting} variant="brand">
              {editSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete ticket?"
        description={
          <p>
            Delete ticket{" "}
            <span className="font-medium text-foreground">{request?.reference}</span>? This cannot be
            undone.
          </p>
        }
        confirmLabel="Delete ticket"
        loading={deleting}
        onConfirm={() => void deleteTicket()}
      />
    </RoleGuard>
  );
}
