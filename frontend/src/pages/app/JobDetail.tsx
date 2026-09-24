import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { Camera, ClipboardList, Download, Loader2, PackageMinus, Pencil, PlusCircle, Trash2, UserPlus, Wrench } from "lucide-react";
import { FormFieldError } from "@/components/shared/FormFieldError";
import { RequiredMark } from "@/components/shared/RequiredMark";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import { PhotoCaptionTile } from "@/components/shared/PhotoCaptionTile";
import { CustomerAdditionalFieldsEditor } from "@/components/customers/CustomerAdditionalFieldsEditor";
import { useFormValidation } from "@/hooks/useFormValidation";
import { fieldAria, fieldErrorClass, fieldRules, type FieldErrors } from "@/lib/formValidation";
import {
  ActivityTimeline,
  DetailInfoGrid,
  DetailSection,
  RecordDetailLayout,
} from "@/components/shared/RecordDetailLayout";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { JobWorkReportPanel } from "@/components/jobs/JobWorkReportPanel";
import { pickWorkReportLog, useJobWorkReportEditor } from "@/components/jobs/useJobWorkReportEditor";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { InventoryProductSelect } from "@/components/shared/InventoryProductSelect";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { JOB_CREATE_ROLES, QA_APPROVER_ROLES, SERVICE_BILLING_ROLES, ESTIMATE_READ_ROLES } from "@/config/roles";
import { userCanAccessPath } from "@/lib/userRoles";
import {
  api,
  ApiError,
  type BackendInventoryItem,
  type BackendJobActivity,
  type BackendJobExtra,
  type BackendServiceJob,
  type BackendUser,
  type JobPhotoInput,
} from "@/lib/api";
import {
  parseCustomerAdditionalFields,
  sanitizeCustomerAdditionalFields,
  type CustomerAdditionalField,
} from "@/lib/customerFields";
import { ENGINEER_EXTRA_TYPES, billingLineTypeLabel, extraLineTotal } from "@/lib/billingCharges";
import { formatFixedOption, SERVICE_TYPE_OPTIONS } from "@/lib/fixedOptions";
import { defaultDatePlusDays, formatCurrency, formatDate, formatDateTime, formatJobStatus } from "@/lib/format";
import { formatInventoryItemClass, INVENTORY_ITEM_CLASS_OPTIONS, type InventoryItemClass } from "@/lib/inventoryItemClass";
import {
  DELIVERY_METHOD_OPTIONS,
  JOB_WORKFLOW_STAGES,
  jobWorkflowStageIndex,
  parseJobStageDetails,
} from "@/lib/jobStages";
import { roleLabels } from "@/data/mock";
import type { Role } from "@/data/types";
import { downloadServiceReportPdf } from "@/lib/serviceReport";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const JOB_STATUS_OPTIONS = [
  { value: "scheduled", label: "Scheduled" },
  { value: "inProgress", label: "In Progress" },
  { value: "partsPending", label: "Parts Pending" },
  { value: "review", label: "QA" },
  { value: "delivery", label: "Delivery" },
  { value: "completed", label: "Completed" },
] as const;

const ENGINEER_STATUS_OPTIONS = JOB_STATUS_OPTIONS.filter(
  (o) => o.value !== "completed" && o.value !== "delivery",
);

const ASSIGNABLE_JOB_ROLES: Role[] = ["coordinator", "engineer"];
const PROJECT_TEAM_ROLES: Role[] = ["admin", "coordinator", "engineer", "inspector"];

const assignTeamSchema = z.object({
  userId: fieldRules.selectRequired("a staff member"),
});

const editRegistrationSchema = z
  .object({
    type: z.string().optional(),
    typeOther: z.string().optional(),
    engineerId: fieldRules.selectRequired("assignee"),
    scheduledFor: fieldRules.requiredString("Scheduled date"),
  })
  .superRefine((data, ctx) => {
    if (data.type === "Other" && !data.typeOther?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["typeOther"], message: "Please specify the service type." });
    }
  });

export type ServiceJobDetailVariant = "job" | "project";

type ServiceJobDetailProps = {
  variant?: ServiceJobDetailVariant;
};

function toDateInput(value: string | null | undefined) {
  if (!value) return "";
  return value.slice(0, 10);
}

function toApiJobStatus(display: string) {
  if (display === "in-progress") return "inProgress";
  if (display === "parts-pending") return "partsPending";
  return display;
}

const scopeSchema = z.object({
  partsNote: fieldRules.requiredString("Scope change reason"),
});

function validatePhotos(values: { photoCount: number }): FieldErrors {
  if (values.photoCount > 0) return {};
  return { photos: "Select at least one photo." };
}

function validateStock(
  values: { stockItemId: string; stockQty: number },
  inStock: number,
): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.stockItemId) {
    errors.stockItemId = "Select an inventory item.";
  }
  if (values.stockQty < 1) {
    errors.stockQty = "Quantity must be at least 1.";
  } else if (values.stockItemId && values.stockQty > inStock) {
    errors.stockQty = `Available: ${inStock}. Use Create PO for shortage if needed.`;
  }
  return errors;
}

export function ServiceJobDetail({ variant = "job" }: ServiceJobDetailProps) {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasRole, canMutate, user } = useAuth();
  const { rbacMatrix } = useSettings();
  const isProject = variant === "project";
  const backTo = isProject ? "/app/projects" : "/app/jobs";
  const backLabel = isProject ? "Back to Projects" : "Back to Jobs";
  const recordLabel = isProject ? "Project" : "Job";
  const guardRoles = isProject
    ? (["admin", "coordinator", "qa"] as Role[])
    : (["admin", "coordinator", "engineer", "qa"] as Role[]);
  const canAssignTeam = isProject && hasRole(["admin", "coordinator"]);
  const canAccessBilling =
    Boolean(user) &&
    (hasRole(SERVICE_BILLING_ROLES) || userCanAccessPath(user!, "/app/billing", rbacMatrix));
  const canAccessEstimates =
    Boolean(user) &&
    (hasRole(ESTIMATE_READ_ROLES) || userCanAccessPath(user!, "/app/estimates", rbacMatrix));
  const canAccessInspections =
    Boolean(user) && userCanAccessPath(user!, "/app/inspections", rbacMatrix);
  const canAccessTickets =
    Boolean(user) && userCanAccessPath(user!, "/app/service-tickets", rbacMatrix);
  const [job, setJob] = useState<BackendServiceJob | null>(null);
  const [activities, setActivities] = useState<BackendJobActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [partsOpen, setPartsOpen] = useState(false);
  const [editingExtraId, setEditingExtraId] = useState<string | null>(null);
  const [stockOpen, setStockOpen] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoCaptions, setPhotoCaptions] = useState<string[]>([]);
  const [partsNote, setPartsNote] = useState("");
  const [partsItemId, setPartsItemId] = useState("");
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [registrationSaving, setRegistrationSaving] = useState(false);
  const [deletingJob, setDeletingJob] = useState(false);
  const [deleteJobOpen, setDeleteJobOpen] = useState(false);
  const [deleteExtraId, setDeleteExtraId] = useState<string | null>(null);
  const [deletingExtra, setDeletingExtra] = useState(false);
  const [assignableStaff, setAssignableStaff] = useState<BackendUser[]>([]);
  const [projectTeamStaff, setProjectTeamStaff] = useState<BackendUser[]>([]);
  const [teamAssignment, setTeamAssignment] = useState({ userId: "", isLead: false });
  const [teamSaving, setTeamSaving] = useState(false);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [registrationForm, setRegistrationForm] = useState({
    type: "",
    typeOther: "",
    engineerId: "",
    scheduledFor: "",
    additionalFields: [{ label: "", value: "" }] as CustomerAdditionalField[],
  });
  const registrationDialogRef = useRef<HTMLDivElement>(null);
  const teamAssignRef = useRef<HTMLDivElement>(null);
  const [partsQty, setPartsQty] = useState(1);
  const [extraType, setExtraType] = useState<(typeof ENGINEER_EXTRA_TYPES)[number]["value"]>("product");
  const [inventory, setInventory] = useState<BackendInventoryItem[]>([]);
  const [stockItemId, setStockItemId] = useState("");
  const [stockClassFilter, setStockClassFilter] = useState<"all" | InventoryItemClass>("all");
  const [stockQty, setStockQty] = useState(1);
  const [actionSaving, setActionSaving] = useState(false);
  const [qaNotes, setQaNotes] = useState("");
  const [qaChecklistOpen, setQaChecklistOpen] = useState(false);
  const [qaChecklist, setQaChecklist] = useState({
    repairVerified: false,
    testingPassed: false,
    calibrationChecked: false,
    cleanlinessOk: false,
    docsReady: false,
  });
  const [deliveryMethod, setDeliveryMethod] = useState("site_return");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [deliveryReceivedBy, setDeliveryReceivedBy] = useState("");
  const [courierName, setCourierName] = useState("");
  const [waybillNumber, setWaybillNumber] = useState("");
  const [dispatchDate, setDispatchDate] = useState("");
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState("");
  const [downloadingReport, setDownloadingReport] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photosDialogRef = useRef<HTMLDivElement>(null);
  const scopeDialogRef = useRef<HTMLDivElement>(null);
  const stockDialogRef = useRef<HTMLDivElement>(null);

  const photosValidation = useFormValidation({
    fieldOrder: ["photos"],
    validate: validatePhotos,
  });

  const photoPreviews = useMemo(
    () => photoFiles.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [photoFiles],
  );

  useEffect(
    () => () => {
      photoPreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
    },
    [photoPreviews],
  );

  const resetPhotoDraft = () => {
    setPhotoFiles([]);
    setPhotoCaptions([]);
  };

  const scopeValidation = useFormValidation({
    fieldOrder: ["partsItemId", "partsQty", "partsNote"],
    schema: scopeSchema,
  });

  const stockValidation = useFormValidation({
    fieldOrder: ["stockItemId", "stockQty"],
  });

  const registrationValidation = useFormValidation({
    fieldOrder: ["type", "typeOther", "engineerId", "scheduledFor"],
    schema: editRegistrationSchema,
  });

  const teamValidation = useFormValidation({
    fieldOrder: ["userId"],
    schema: assignTeamSchema,
  });

  const canUpdateJob = hasRole(["engineer", "admin"]) && canMutate;
  /** Pass/fail QA + confirm delivery — only admin / coordinator / QA (and not read-only). */
  const canApproveComplete = hasRole(QA_APPROVER_ROLES) && canMutate;
  const canReviewExtras = hasRole(QA_APPROVER_ROLES) && canMutate;
  const canManageRegistration = hasRole(JOB_CREATE_ROLES);
  /** Overdue escalation notes — matches POST /jobs/:id/activities roles. */
  const canLogEscalation = hasRole(["admin", "coordinator", "engineer"]) && canMutate;
  const statusOptions = canApproveComplete ? JOB_STATUS_OPTIONS : ENGINEER_STATUS_OPTIONS;
  const awaitingQa = job?.status === "review";
  const awaitingDelivery = job?.status === "delivery";
  const canSubmitForReview =
    canUpdateJob && job && !["review", "delivery", "completed"].includes(job.status);
  const canEditWorkReport = canUpdateJob && job && job.status !== "completed";
  const hasWorkReport = Boolean(job && pickWorkReportLog(job.workLogs));
  const canDownloadServiceReport =
    hasRole(["engineer", "admin", "coordinator", "qa"]) && Boolean(job) && hasWorkReport;
  const tab = searchParams.get("tab") ?? "overview";
  const stageDetails = parseJobStageDetails(job?.stageDetails);
  const activeStageIndex = job ? jobWorkflowStageIndex(job.status) : 0;

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [record, audit, users] = await Promise.all([
        api.getJob(id),
        api.getJobActivities(id),
        canAssignTeam ? api.listUsers({ isActive: true }) : Promise.resolve([] as BackendUser[]),
      ]);
      setJob(record);
      setActivities(audit);
      if (canAssignTeam) {
        setProjectTeamStaff(
          users.filter((user) => PROJECT_TEAM_ROLES.includes(user.role as Role)),
        );
      }
    } catch (err) {
      setJob(null);
      setError(err instanceof ApiError && err.status === 404 ? null : "Please try again.");
      if (!(err instanceof ApiError && err.status === 404)) {
        toast.apiError(err, { fallback: `Failed to load ${recordLabel.toLowerCase()}` });
      }
    } finally {
      setLoading(false);
    }
  }, [id, canAssignTeam, recordLabel]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!job) return;
    const details = parseJobStageDetails(job.stageDetails);
    setQaNotes(details.qa?.notes ?? "");
    setDeliveryMethod(details.delivery?.method || "site_return");
    setDeliveryNote(details.delivery?.note ?? "");
    setDeliveryReceivedBy(details.delivery?.receivedBy ?? "");
    if (details.delivery?.courier) {
      setCourierName(details.delivery.courier.name ?? "");
      setWaybillNumber(details.delivery.courier.waybill ?? "");
      setDispatchDate(details.delivery.courier.dispatchDate ?? "");
      setEstimatedDeliveryDate(details.delivery.courier.estimatedDeliveryDate ?? "");
    }
  }, [job?.id, job?.stageDetails, job?.status]);

  const overdueDays = useMemo(() => {
    if (!job || !job.scheduledFor || job.status === "completed" || job.status === "delivery") return 0;
    const scheduledTime = new Date(job.scheduledFor).getTime();
    const now = Date.now();
    if (now > scheduledTime) {
      const diff = Math.floor((now - scheduledTime) / (1000 * 60 * 60 * 24));
      return diff > 0 ? diff : 0;
    }
    return 0;
  }, [job]);

  const handleLogEscalation = async () => {
    if (!job) return;
    try {
      await api.addJobActivity(job.id, {
        actor: "System",
        action: "Escalation Logged",
        note: `Job overdue by ${overdueDays} day(s) — escalation logged.`,
      });
      toast.success("Escalation logged", { description: `Logged for job ${job.reference}` });
      await refreshActivities(job.id);
    } catch (err) {
      toast.apiError(err, { fallback: "Failed to log escalation" });
    }
  };

  const workReport = useJobWorkReportEditor(async () => {
    await load();
  });

  const refreshActivities = async (jobId: string) => {
    try {
      setActivities(await api.getJobActivities(jobId));
    } catch {
      /* ignore */
    }
  };

  const assignProjectTeamMember = async () => {
    if (!id || !teamValidation.validateAll(teamAssignment, undefined, teamAssignRef.current)) return;
    const member = projectTeamStaff.find((user) => user.id === teamAssignment.userId);
    setTeamSaving(true);
    try {
      await api.assignJobStaff(id, {
        userId: teamAssignment.userId,
        role: member?.role || "member",
        isLead: teamAssignment.isLead,
      });
      setTeamAssignment({ userId: "", isLead: false });
      teamValidation.reset();
      toast({ title: "Staff assignment saved" });
      const record = await api.getJob(id);
      setJob(record);
      await refreshActivities(id);
    } catch (error) {
      if (!teamValidation.applyApiErrors(error, teamAssignRef.current)) {
        toast.apiError(error, { fallback: "Unable to assign staff" });
      }
    } finally {
      setTeamSaving(false);
    }
  };

  const updateJobStatus = async (status: string, progress?: number) => {
    if (!job) return;
    if (job.status === "scheduled" && status === "inProgress") {
      const pendingExtras = (job.extras ?? []).filter((e) => e.status === "pending");
      if (pendingExtras.length > 0) {
        toast.error("Work Authorization Locked", {
          description: `Cannot advance to In Progress — ${pendingExtras.length} unapproved extra(s) pending coordinator approval.`,
        });
        return;
      }
    }
    try {
      const updated = await api.updateJob(job.id, {
        status,
        ...(progress !== undefined ? { progress } : {}),
      });
      setJob(updated);
      toast({ title: "Status updated", description: `Job moved to ${JOB_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status}.` });
      await refreshActivities(job.id);
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to update job" });
    }
  };

  const openRegistrationEditor = async () => {
    if (!job) return;
    setLoadingStaff(true);
    try {
      const lists = await Promise.all(
        ASSIGNABLE_JOB_ROLES.map((role) => api.listUsers({ role, isActive: true })),
      );
      setAssignableStaff(lists.flat().sort((a, b) => a.name.localeCompare(b.name)));
      const fields = parseCustomerAdditionalFields(job.additionalFields);
      setRegistrationForm({
        type: job.type ?? "",
        typeOther: job.typeOther ?? "",
        engineerId: job.engineerId ?? "",
        scheduledFor: toDateInput(job.scheduledFor),
        additionalFields: fields.length ? fields : [{ label: "", value: "" }],
      });
      registrationValidation.reset();
      setRegistrationOpen(true);
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to load assignees" });
    } finally {
      setLoadingStaff(false);
    }
  };

  const saveRegistration = async () => {
    if (!job) return;
    if (!registrationValidation.validateAll(registrationForm, undefined, registrationDialogRef.current)) return;
    setRegistrationSaving(true);
    try {
      const updated = await api.updateJob(job.id, {
        type: registrationForm.type || undefined,
        typeOther: registrationForm.type === "Other" ? registrationForm.typeOther.trim() || null : null,
        engineerId: registrationForm.engineerId,
        scheduledFor: registrationForm.scheduledFor,
        additionalFields: sanitizeCustomerAdditionalFields(registrationForm.additionalFields),
      });
      setJob(updated);
      setRegistrationOpen(false);
      toast.success("Job registration updated");
      await refreshActivities(job.id);
    } catch (err) {
      if (!registrationValidation.applyApiErrors(err, registrationDialogRef.current)) {
        toast.apiError(err, { fallback: "Unable to update job registration" });
      }
    } finally {
      setRegistrationSaving(false);
    }
  };

  const deleteJobRegistration = async () => {
    if (!job) return;
    setDeletingJob(true);
    try {
      await api.deleteJob(job.id);
      toast.success("Job deleted", { description: job.reference });
      setDeleteJobOpen(false);
      navigate("/app/jobs");
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to delete job" });
    } finally {
      setDeletingJob(false);
    }
  };

  const submitForReview = async () => {
    if (!job) return;
    if (!pickWorkReportLog(job.workLogs)) {
      toast({
        title: "Work report required",
        description: "Fill the work report (like inspection) before submitting for QA.",
        variant: "destructive",
      });
      workReport.openReport(job);
      return;
    }
    try {
      await api.updateJob(job.id, { status: "review", progress: Math.max(job.progress, 90) });
      await downloadServiceReportPdf(job.id);
      toast({
        title: "Submitted for QA",
        description: "Service report generated. Awaiting coordinator, admin, or QA quality check.",
      });
      await load();
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to submit job for QA" });
    }
  };

  const generateServiceReport = async () => {
    if (!job) return;
    if (!pickWorkReportLog(job.workLogs)) {
      toast({
        title: "Work report required",
        description: "Fill the work report before generating the service report.",
        variant: "destructive",
      });
      workReport.openReport(job);
      return;
    }
    setDownloadingReport(true);
    try {
      await downloadServiceReportPdf(job.id);
      toast({ title: "Service report ready", description: "PDF downloaded." });
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to generate service report" });
    } finally {
      setDownloadingReport(false);
    }
  };

  const approveQaPass = async () => {
    if (!job) return;
    try {
      const updated = await api.updateJob(job.id, {
        status: "delivery",
        progress: Math.max(job.progress, 95),
        stageDetails: {
          qa: {
            result: "pass",
            notes: qaNotes.trim() || null,
            checkedAt: new Date().toISOString(),
            checklist: qaChecklist,
          },
        },
      });
      setJob(updated);
      toast({
        title: "QA passed",
        description: "Job moved to Delivery. Confirm handoff to complete and continue to billing.",
      });
      setSearchParams({ tab: "workflow" });
      await refreshActivities(job.id);
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to approve QA" });
    }
  };

  const failQaReturnToRepair = async () => {
    if (!job) return;
    try {
      const updated = await api.updateJob(job.id, {
        status: "inProgress",
        progress: Math.min(job.progress, 80),
        stageDetails: {
          qa: {
            result: "fail",
            notes: qaNotes.trim() || null,
            checkedAt: new Date().toISOString(),
          },
        },
      });
      setJob(updated);
      toast({
        title: "Returned to Repair",
        description: "QA failed — engineer can continue work and resubmit.",
      });
      await refreshActivities(job.id);
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to return job to Repair" });
    }
  };

  const confirmDelivery = async () => {
    if (!job) return;
    try {
      const updated = await api.updateJob(job.id, {
        status: "completed",
        progress: 100,
        stageDetails: {
          delivery: {
            method: deliveryMethod || null,
            note: deliveryNote.trim() || null,
            receivedBy: deliveryReceivedBy.trim() || null,
            deliveredAt: new Date().toISOString(),
            courier: courierName.trim()
              ? {
                  name: courierName.trim(),
                  waybill: waybillNumber.trim(),
                  dispatchDate,
                  estimatedDeliveryDate,
                }
              : null,
          },
        },
      });
      setJob(updated);
      toast({
        title: "Delivery confirmed",
        description: canAccessBilling
          ? "Job completed. Continue to billing to invoice and update service warranty."
          : "Job completed. Billing staff can generate the invoice when ready.",
      });
      await refreshActivities(job.id);
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to confirm delivery" });
    }
  };

  const handleUploadPhotos = async () => {
    if (!job) return;
    const values = { photoCount: photoFiles.length };
    if (!photosValidation.validateAll(values, undefined, photosDialogRef.current)) return;

    setActionSaving(true);
    try {
      const photos: JobPhotoInput[] = [];
      for (let i = 0; i < photoFiles.length; i++) {
        const uploaded = await api.uploadFile(photoFiles[i]);
        const caption = photoCaptions[i]?.trim();
        photos.push({
          fileId: uploaded.id,
          filename: uploaded.originalName,
          mimeType: uploaded.mimeType,
          ...(caption ? { caption } : {}),
        });
      }
      const result = await api.uploadJobPhotos(job.id, photos);
      setJob(result.job);
      toast({ title: "Photos uploaded", description: `${photoFiles.length} photo(s) attached.` });
      resetPhotoDraft();
      setPhotosOpen(false);
      photosValidation.reset();
      await refreshActivities(job.id);
    } catch (err) {
      if (!photosValidation.applyApiErrors(err, photosDialogRef.current)) {
        toast.apiError(err, { fallback: "Upload failed" });
      }
    } finally {
      setActionSaving(false);
    }
  };

  const resetPartsForm = () => {
    setPartsNote("");
    setPartsItemId("");
    setPartsQty(1);
    setExtraType("product");
    setEditingExtraId(null);
    scopeValidation.reset();
  };

  const handleScopeChange = async () => {
    if (!job) return;
    const values = { partsNote };
    const extraErrors: FieldErrors = {};
    if (partsQty < 1) extraErrors.partsQty = "Quantity must be at least 1.";
    if (!scopeValidation.validateAll(values, extraErrors, scopeDialogRef.current)) return;

    setActionSaving(true);
    try {
      const selectedItem = inventory.find((item) => item.id === partsItemId);
      const payload = {
        inventoryItemId: selectedItem?.id ?? null,
        description: selectedItem?.name ?? partsNote.trim().slice(0, 120),
        type: extraType,
        reason: partsNote.trim(),
        quantity: partsQty,
        unitPrice: Number(selectedItem?.unitCost ?? 0),
        taxRate: 0,
      };

      if (editingExtraId) {
        await api.updateJobExtra(editingExtraId, payload);
        toast({
          title: "Parts / scope request updated",
          description: selectedItem
            ? "Stock purchase request quantity and item were updated."
            : undefined,
        });
      } else {
        await api.addJobExtra(job.id, payload);
        await api.requestJobParts(job.id, partsNote.trim());
        toast({
          title: "Parts / scope request submitted",
          description: selectedItem
            ? "The requested parts were sent to purchasing and the service coordinator."
            : "Sent to the service coordinator for approval.",
        });
      }

      resetPartsForm();
      setPartsOpen(false);
      await refreshActivities(job.id);
      const refreshed = await api.getJob(job.id);
      setJob(refreshed);
    } catch (err) {
      if (!scopeValidation.applyApiErrors(err, scopeDialogRef.current)) {
        toast.apiError(err, { fallback: editingExtraId ? "Unable to update request" : "Request failed" });
      }
    } finally {
      setActionSaving(false);
    }
  };

  const openPartsDialog = async () => {
    resetPartsForm();
    setPartsOpen(true);
    try {
      setInventory((await api.listInventory({ limit: 100, page: 1 })).data);
    } catch {
      setInventory([]);
    }
  };

  const openEditExtra = async (item: BackendJobExtra) => {
    setEditingExtraId(item.id);
    setPartsNote(item.reason || item.description);
    setPartsItemId(item.inventoryItemId ?? item.inventoryItem?.id ?? "");
    setPartsQty(Number(item.quantity) || 1);
    const type = (item.type || "product") as typeof extraType;
    setExtraType(ENGINEER_EXTRA_TYPES.some((option) => option.value === type) ? type : "product");
    scopeValidation.reset();
    setPartsOpen(true);
    try {
      setInventory((await api.listInventory({ limit: 100, page: 1 })).data);
    } catch {
      setInventory([]);
    }
  };

  const deleteExtra = async () => {
    if (!deleteExtraId) return;
    setDeletingExtra(true);
    try {
      await api.deleteJobExtra(deleteExtraId);
      toast({ title: "Parts / scope request deleted" });
      setDeleteExtraId(null);
      await load();
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to delete request" });
    } finally {
      setDeletingExtra(false);
    }
  };

  const approveExtra = async (extraId: string) => {
    setActionSaving(true);
    try {
      await api.approveJobExtra(extraId);
      toast({ title: "Parts / scope request approved" });
      await load();
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to approve request" });
    } finally {
      setActionSaving(false);
    }
  };

  const openStockDialog = async () => {
    setStockOpen(true);
    setStockItemId("");
    setStockClassFilter("all");
    setStockQty(1);
    stockValidation.reset();
    try {
      setInventory((await api.listInventory({ limit: 100, page: 1 })).data);
    } catch {
      setInventory([]);
    }
  };

  const stockInventoryOptions = useMemo(
    () =>
      stockClassFilter === "all"
        ? inventory
        : inventory.filter((item) => (item.itemClass ?? "spare_part") === stockClassFilter),
    [inventory, stockClassFilter],
  );

  const handleDeductStock = async () => {
    if (!job) return;
    const item = inventory.find((i) => i.id === stockItemId);
    const inStock = item?.inStock ?? 0;
    const values = { stockItemId, stockQty };
    const fieldErrors = validateStock(values, inStock);
    if (Object.keys(fieldErrors).length > 0) {
      stockValidation.validateAll(values, fieldErrors, stockDialogRef.current);
      return;
    }

    setActionSaving(true);
    try {
      const result = await api.deductJobStock(job.id, { inventoryItemId: stockItemId, quantity: stockQty });
      setJob(result.job);
      toast({ title: "Stock deducted", description: `${stockQty} × ${item!.name} deducted.` });
      setStockOpen(false);
      stockValidation.reset();
      await refreshActivities(job.id);
    } catch (err) {
      if (!stockValidation.applyApiErrors(err, stockDialogRef.current)) {
        toast.apiError(err, { fallback: "Deduction failed" });
      }
    } finally {
      setActionSaving(false);
    }
  };

  const handleShortagePurchase = async () => {
    const item = inventory.find((candidate) => candidate.id === stockItemId);
    if (!item || !job) return;
    if (stockQty <= item.inStock) return;
    setActionSaving(true);
    try {
      await api.createItemizedPurchaseOrder({
        supplier: item.supplier,
        expectedDate: defaultDatePlusDays(7),
        lines: [{
          inventoryItemId: item.id,
          sku: item.sku,
          description: `${item.name} — shortage for ${job.reference}`,
          quantityOrdered: stockQty - item.inStock,
          unitCost: Number(item.unitCost),
          taxRate: 0,
        }],
      });
      setStockOpen(false);
      toast({ title: "Purchase order created", description: `Shortage of ${stockQty - item.inStock} × ${item.name} sent to purchasing.` });
    } catch (error) {
      toast.apiError(error, { fallback: "Request failed" });
    } finally {
      setActionSaving(false);
    }
  };

  const selectedApiStatus = job ? toApiJobStatus(formatJobStatus(job.status)) : "";
  const extras = job?.extras ?? [];
  const workLogs = job?.workLogs ?? [];
  const photos = job?.photos ?? [];

  return (
    <RoleGuard roles={guardRoles}>
      <RecordDetailLayout
        backTo={backTo}
        backLabel={backLabel}
        title={job?.reference ?? recordLabel}
        subtitle={job ? `${job.equipmentName} · ${job.customerName}` : undefined}
        status={job ? formatJobStatus(job.status) : undefined}
        meta={job ? [
          { label: "Scheduled", value: formatDate(job.scheduledFor) },
          { label: "Ticket", value: job.requestRef },
          ...(isProject ? [{ label: "Lead", value: job.engineer || "Not assigned" }] : []),
        ] : undefined}
        loading={loading}
        error={error}
        notFound={!loading && !error && !job}
        notFoundTitle={`${recordLabel} not found`}
        notFoundDescription={`The requested ${recordLabel.toLowerCase()} could not be found.`}
        onRetry={() => void load()}
        actions={
          job ? (
            <div className="flex flex-wrap gap-2">
              {isProject && hasRole(["admin", "coordinator", "engineer"]) ? (
                <Button variant="outline" asChild>
                  <Link to={`/app/jobs/${job.id}`}>Open service job</Link>
                </Button>
              ) : null}
              {!isProject && hasRole(["admin", "coordinator", "estimator"]) ? (
                <Button variant="outline" asChild>
                  <Link to={`/app/projects/${job.id}`}>Open project</Link>
                </Button>
              ) : null}
              {job.serviceRequestId ? (
                <>
                  {canAccessTickets ? (
                    <Button variant="outline" asChild>
                      <Link to={`/app/service-tickets/${job.serviceRequestId}`}>Open service ticket</Link>
                    </Button>
                  ) : null}
                  {canAccessInspections ? (
                    <Button variant="outline" asChild>
                      <Link to={`/app/inspections/${job.serviceRequestId}`}>Open inspection</Link>
                    </Button>
                  ) : null}
                </>
              ) : null}
              {job.estimateId && canAccessEstimates ? (
                <Button variant="outline" asChild>
                  <Link to={`/app/estimates/${job.estimateId}`}>Open estimate</Link>
                </Button>
              ) : null}
              {job.status === "completed" && canAccessBilling ? (
                <Button variant="brand" asChild>
                  <Link to={`/app/billing/jobs/${job.id}`}>Continue to billing</Link>
                </Button>
              ) : null}
              {canDownloadServiceReport ? (
                <Button
                  variant="outline"
                  disabled={downloadingReport}
                  onClick={() => void generateServiceReport()}
                >
                  {downloadingReport ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-1.5 h-4 w-4" />
                  )}
                  {downloadingReport ? "Generating…" : "Download Service Report"}
                </Button>
              ) : null}
              {canManageRegistration ? (
                <>
                  <Button variant="outline" onClick={() => void openRegistrationEditor()}>
                    <Pencil className="mr-1.5 h-4 w-4" />
                    Edit registration
                  </Button>
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    disabled={deletingJob}
                    onClick={() => setDeleteJobOpen(true)}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    Delete
                  </Button>
                </>
              ) : null}
              {job.status !== "completed" ? (
                <>
                  {canEditWorkReport ? (
                    <Button variant="outline" onClick={() => workReport.openReport(job)}>
                      <ClipboardList className="mr-1.5 h-4 w-4" />
                      {hasWorkReport ? "Update Work Report" : "Work Report"}
                    </Button>
                  ) : null}
                  {canSubmitForReview ? (
                    <Button onClick={() => void submitForReview()}>
                      Submit for QA & Report
                    </Button>
                  ) : awaitingQa && canApproveComplete ? (
                    <>
                      <Button variant="outline" onClick={() => void failQaReturnToRepair()}>
                        QA Fail — Return to Repair
                      </Button>
                      <Button onClick={() => void approveQaPass()}>
                        QA Pass — Send to Delivery
                      </Button>
                    </>
                  ) : awaitingQa ? (
                    <Button disabled variant="outline">
                      Awaiting QA approval
                    </Button>
                  ) : awaitingDelivery && canApproveComplete ? (
                    <Button onClick={() => void confirmDelivery()}>
                      Confirm Delivery & Complete
                    </Button>
                  ) : awaitingDelivery ? (
                    <Button disabled variant="outline">
                      Awaiting delivery confirmation
                    </Button>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : undefined
        }
        activeTab={tab}
        onTabChange={(value) => setSearchParams(value === "overview" ? {} : { tab: value })}
        tabs={job ? [
          {
            id: "overview",
            label: "Overview",
            content: (
              <div className="space-y-4">
                {overdueDays > 0 && (
                  <Alert variant="destructive" className="flex items-center justify-between">
                    <div>
                      <AlertTitle className="font-semibold">⚠ Job Overdue by {overdueDays} Day(s)</AlertTitle>
                      <AlertDescription>
                        Scheduled date was {formatDate(job.scheduledFor)}. Escalation is required for delayed jobs.
                      </AlertDescription>
                    </div>
                    {canLogEscalation ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-destructive/40 text-destructive hover:bg-destructive/10 shrink-0 ml-3"
                        onClick={() => void handleLogEscalation()}
                      >
                        Log Escalation
                      </Button>
                    ) : null}
                  </Alert>
                )}

                {job.status === "scheduled" && (job.extras ?? []).some((e) => e.status === "pending") && (
                  <Alert className="border-amber-500/50 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 [&>svg]:text-amber-600">
                    <AlertTitle className="font-semibold text-amber-800 dark:text-amber-300">
                      Work Authorization Lock
                    </AlertTitle>
                    <AlertDescription>
                      {(job.extras ?? []).filter((e) => e.status === "pending").length} unapproved extra(s) pending coordinator approval. Status advancement to "In Progress" is locked until approved.
                    </AlertDescription>
                  </Alert>
                )}

                <DetailSection title="Workflow">
                  <ol className="grid gap-3 sm:grid-cols-3">
                    {JOB_WORKFLOW_STAGES.map((stage, index) => {
                      const done = activeStageIndex > index || job.status === "completed";
                      const current = activeStageIndex === index && job.status !== "completed";
                      return (
                        <li
                          key={stage.id}
                          className={cn(
                            "rounded-lg border px-3 py-3",
                            done && "border-success/30 bg-[hsl(var(--success-light))]",
                            current && "border-primary/40 bg-primary-light",
                            !done && !current && "bg-muted/40",
                          )}
                        >
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Step {index + 1}
                          </p>
                          <p className="mt-1 font-semibold">{stage.label}</p>
                          <p className="text-xs text-muted-foreground">{stage.description}</p>
                          <p className="mt-2 text-xs font-medium">
                            {done ? "Done" : current ? "In progress" : "Upcoming"}
                          </p>
                        </li>
                      );
                    })}
                  </ol>
                </DetailSection>
                <DetailSection title="Progress">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Completion</span>
                    <span className="font-medium">{job.progress}%</span>
                  </div>
                  <Progress value={job.progress} className="h-2" />
                </DetailSection>
                <DetailSection title={isProject ? "Project details" : "Job details"}>
                  <DetailInfoGrid
                    items={[
                      { label: "Type", value: formatFixedOption(SERVICE_TYPE_OPTIONS, job.type, job.typeOther) },
                      { label: "Customer", value: job.customerName },
                      { label: "Equipment", value: job.equipmentName },
                      { label: "Lead", value: job.engineer || "Not assigned" },
                      { label: "Scheduled", value: formatDate(job.scheduledFor) },
                      { label: "Service ticket", value: job.serviceRequestId ? (
                        <Link className="text-primary hover:underline normal-case" to={`/app/service-tickets/${job.serviceRequestId}`}>
                          {job.requestRef}
                        </Link>
                      ) : "Not linked" },
                      { label: "Created", value: formatDate(job.createdAt) },
                      { label: "Updated", value: formatDate(job.updatedAt) },
                    ]}
                  />
                </DetailSection>
                {parseCustomerAdditionalFields(job.additionalFields).length > 0 ? (
                  <DetailSection title="Additional registration fields">
                    <DetailInfoGrid
                      items={parseCustomerAdditionalFields(job.additionalFields).map((field) => ({
                        label: field.label,
                        value: field.value || "—",
                      }))}
                    />
                  </DetailSection>
                ) : null}
                {photos.length > 0 ? (
                  <DetailSection title="Photos">
                    <div className="flex flex-wrap gap-3">
                      {photos.map((photo) => {
                        const src = photo.fileId ? api.fileDownloadUrl(photo.fileId) : "";
                        if (!src) return null;
                        return (
                          <PhotoCaptionTile
                            key={photo.id}
                            src={src}
                            alt={photo.filename}
                            caption={photo.caption ?? ""}
                            href={src}
                            readOnly
                            className="w-24 sm:w-28"
                          />
                        );
                      })}
                    </div>
                  </DetailSection>
                ) : null}
              </div>
            ),
          },
          {
            id: "workflow",
            label: "Repair / QA / Delivery",
            content: (
              <div className="space-y-4">
                <DetailSection title="Repair">
                  <p className="text-sm text-muted-foreground">
                    Field work, parts, and the work report happen in Repair. Submit for QA when ready.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {canEditWorkReport ? (
                      <Button variant="outline" onClick={() => workReport.openReport(job)}>
                        <ClipboardList className="mr-1.5 h-4 w-4" />
                        {hasWorkReport ? "Update Work Report" : "Work Report"}
                      </Button>
                    ) : null}
                    {canDownloadServiceReport ? (
                      <Button
                        variant="outline"
                        disabled={downloadingReport}
                        onClick={() => void generateServiceReport()}
                      >
                        {downloadingReport ? (
                          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="mr-1.5 h-4 w-4" />
                        )}
                        {downloadingReport ? "Generating…" : "Download Service Report"}
                      </Button>
                    ) : null}
                    {canSubmitForReview ? (
                      <Button onClick={() => void submitForReview()}>Submit for QA & Report</Button>
                    ) : null}
                  </div>
                  {stageDetails.qa?.result === "fail" ? (
                    <p className="mt-3 text-sm text-destructive">
                      Last QA result: Fail{stageDetails.qa.notes ? ` — ${stageDetails.qa.notes}` : ""}
                    </p>
                  ) : null}
                </DetailSection>

                <DetailSection title="QA">
                  <p className="mb-3 text-sm text-muted-foreground">
                    Quality check by coordinator, admin, or QA staff before equipment leaves for delivery.
                  </p>
                  <div className="grid gap-3">
                    {awaitingQa && canApproveComplete && (
                      <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                        <Label className="text-xs font-semibold uppercase text-muted-foreground">
                          QA Independent Quality Checklist (All Required)
                        </Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={qaChecklist.repairVerified}
                              onChange={(e) => setQaChecklist({ ...qaChecklist, repairVerified: e.target.checked })}
                              className="rounded"
                            />
                            <span>1. Repair & Part Replacement Verified</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={qaChecklist.testingPassed}
                              onChange={(e) => setQaChecklist({ ...qaChecklist, testingPassed: e.target.checked })}
                              className="rounded"
                            />
                            <span>2. Functional Testing Passed</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={qaChecklist.calibrationChecked}
                              onChange={(e) => setQaChecklist({ ...qaChecklist, calibrationChecked: e.target.checked })}
                              className="rounded"
                            />
                            <span>3. Calibration & Specs Checked</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={qaChecklist.cleanlinessOk}
                              onChange={(e) => setQaChecklist({ ...qaChecklist, cleanlinessOk: e.target.checked })}
                              className="rounded"
                            />
                            <span>4. Cleanliness & Decontamination OK</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer sm:col-span-2">
                            <input
                              type="checkbox"
                              checked={qaChecklist.docsReady}
                              onChange={(e) => setQaChecklist({ ...qaChecklist, docsReady: e.target.checked })}
                              className="rounded"
                            />
                            <span>5. Service Report & Documentation Ready</span>
                          </label>
                        </div>
                      </div>
                    )}
                    <div className="grid gap-2">
                      <Label htmlFor="qa-notes">QA notes</Label>
                      <Textarea
                        id="qa-notes"
                        value={qaNotes}
                        onChange={(e) => setQaNotes(e.target.value)}
                        placeholder="Checks performed, issues found…"
                        disabled={!awaitingQa || !canApproveComplete}
                        rows={3}
                      />
                    </div>
                    {stageDetails.qa?.result === "pass" ? (
                      <p className="text-sm text-success">
                        QA passed{stageDetails.qa.checkedAt ? ` · ${formatDateTime(stageDetails.qa.checkedAt)}` : ""}
                        {stageDetails.qa.notes ? ` — ${stageDetails.qa.notes}` : ""}
                      </p>
                    ) : null}
                    {awaitingQa && canApproveComplete ? (
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => void failQaReturnToRepair()}>
                          Fail — Return to Repair
                        </Button>
                        <Button
                          disabled={!Object.values(qaChecklist).every(Boolean)}
                          onClick={() => void approveQaPass()}
                        >
                          Pass — Send to Delivery
                        </Button>
                      </div>
                    ) : awaitingQa ? (
                      <p className="text-sm text-muted-foreground">Waiting for coordinator, admin, or QA approval.</p>
                    ) : job.status === "scheduled" || job.status === "inProgress" || job.status === "partsPending" ? (
                      <p className="text-sm text-muted-foreground">QA unlocks after Repair is submitted.</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">QA step finished for this job.</p>
                    )}
                  </div>
                </DetailSection>

                <DetailSection title="Delivery">
                  <p className="mb-3 text-sm text-muted-foreground">
                    Confirm handoff to the customer. Completing delivery marks the job done and opens billing.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2 sm:col-span-1">
                      <Label>Delivery method</Label>
                      <Select
                        value={deliveryMethod}
                        onValueChange={setDeliveryMethod}
                        disabled={!awaitingDelivery || !canApproveComplete}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                        <SelectContent>
                          {DELIVERY_METHOD_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="delivery-received-by">Received by</Label>
                      <Input
                        id="delivery-received-by"
                        value={deliveryReceivedBy}
                        onChange={(e) => setDeliveryReceivedBy(e.target.value)}
                        placeholder="Customer contact name"
                        disabled={!awaitingDelivery || !canApproveComplete}
                      />
                    </div>

                    {/* Courier Tracking fields */}
                    <div className="grid gap-2 sm:col-span-2 rounded-lg border border-border p-3 bg-muted/20">
                      <Label className="text-xs font-semibold uppercase text-muted-foreground">Courier / Shipping Tracking Details (Optional)</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                        <div>
                          <Label className="text-xs">Courier Name</Label>
                          <Input
                            value={courierName}
                            onChange={(e) => setCourierName(e.target.value)}
                            placeholder="e.g. DHL, FedEx, Local Freight"
                            disabled={!awaitingDelivery || !canApproveComplete}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Waybill / Tracking #</Label>
                          <Input
                            value={waybillNumber}
                            onChange={(e) => setWaybillNumber(e.target.value)}
                            placeholder="e.g. WB-9482019"
                            disabled={!awaitingDelivery || !canApproveComplete}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Dispatch Date</Label>
                          <Input
                            type="date"
                            value={dispatchDate}
                            onChange={(e) => setDispatchDate(e.target.value)}
                            disabled={!awaitingDelivery || !canApproveComplete}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Estimated Delivery Date</Label>
                          <Input
                            type="date"
                            value={estimatedDeliveryDate}
                            onChange={(e) => setEstimatedDeliveryDate(e.target.value)}
                            disabled={!awaitingDelivery || !canApproveComplete}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-2 sm:col-span-2">
                      <Label htmlFor="delivery-note">Delivery note</Label>
                      <Textarea
                        id="delivery-note"
                        value={deliveryNote}
                        onChange={(e) => setDeliveryNote(e.target.value)}
                        placeholder="Tracking, site notes, accessories returned…"
                        disabled={!awaitingDelivery || !canApproveComplete}
                        rows={3}
                      />
                    </div>
                  </div>
                  {stageDetails.delivery?.deliveredAt ? (
                    <p className="mt-3 text-sm">
                      Delivered {formatDateTime(stageDetails.delivery.deliveredAt)}
                      {stageDetails.delivery.receivedBy ? ` · Received by ${stageDetails.delivery.receivedBy}` : ""}
                    </p>
                  ) : null}
                  {awaitingDelivery && canApproveComplete ? (
                    <Button className="mt-3" onClick={() => void confirmDelivery()}>
                      Confirm Delivery & Complete
                    </Button>
                  ) : job.status === "completed" && canAccessBilling ? (
                    <Button className="mt-3" variant="brand" asChild>
                      <Link to={`/app/billing/jobs/${job.id}`}>Continue to billing</Link>
                    </Button>
                  ) : awaitingDelivery ? (
                    <p className="mt-3 text-sm text-muted-foreground">Waiting for coordinator/admin delivery confirmation.</p>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">Delivery unlocks after QA pass.</p>
                  )}
                </DetailSection>
              </div>
            ),
          },
          {
            id: "work",
            label: "Work",
            content: (
              <DetailSection title="Work logs">
                {workLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No work logs recorded yet.</p>
                ) : (
                  <div className="space-y-3">
                    {workLogs.map((log) => (
                      <div key={log.id} className="rounded-lg border p-3 text-sm">
                        <p>{log.workPerformed}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDateTime(log.startedAt)}
                          {log.endedAt ? ` – ${formatDateTime(log.endedAt)}` : ""} · {log.minutes} minutes
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </DetailSection>
            ),
          },
          {
            id: "parts",
            label: "Parts",
            content: (
              <DetailSection title="Additional parts / scope">
                {extras.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No extra parts or scope changes yet.</p>
                ) : (
                  <div className="space-y-3">
                    {extras.map((item) => (
                      <div key={item.id} className="flex justify-between gap-3 rounded-lg border p-3 text-sm">
                        <div>
                          <p className="font-medium">{item.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {billingLineTypeLabel(item.type || "product")} · {Number(item.quantity)} × {formatCurrency(item.unitPrice)}
                          </p>
                          <p className="text-xs text-muted-foreground">{item.reason}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <StatusBadge status={item.status} />
                          <span className="text-xs font-medium">{formatCurrency(extraLineTotal(item))}</span>
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {item.status === "pending" && (canUpdateJob || canReviewExtras) ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={actionSaving}
                                  onClick={() => void openEditExtra(item)}
                                >
                                  <Pencil className="mr-1 h-3.5 w-3.5" />
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-destructive hover:text-destructive"
                                  disabled={actionSaving || deletingExtra}
                                  onClick={() => setDeleteExtraId(item.id)}
                                >
                                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                                  Delete
                                </Button>
                              </>
                            ) : null}
                            {canReviewExtras && item.status === "pending" ? (
                              <Button
                                size="sm"
                                disabled={actionSaving}
                                onClick={() => void approveExtra(item.id)}
                              >
                                Approve
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </DetailSection>
            ),
          },
          {
            id: "activity",
            label: "Activity",
            content: (
              <DetailSection title="Activity timeline">
                <ActivityTimeline
                  items={activities.map((a) => ({
                    id: a.id,
                    title: a.action,
                    detail: a.note,
                    meta: `${a.actor} · ${formatDateTime(a.createdAt)}`,
                  }))}
                />
              </DetailSection>
            ),
          },
          ...(isProject
            ? [
                {
                  id: "team",
                  label: "Team",
                  content: (
                    <DetailSection title="Project team">
                      <div ref={teamAssignRef} className="space-y-4">
                        {canAssignTeam ? (
                          <form
                            noValidate
                            className="space-y-3 rounded-lg border p-4"
                            onSubmit={(e) => {
                              e.preventDefault();
                              void assignProjectTeamMember();
                            }}
                          >
                            <div className="grid gap-2" data-field="userId">
                              <Label className={teamValidation.shouldShow("userId") ? "text-destructive" : undefined}>
                                Staff member
                                <RequiredMark />
                              </Label>
                              <Select
                                value={teamAssignment.userId}
                                onValueChange={(userId) => {
                                  const next = { ...teamAssignment, userId };
                                  setTeamAssignment(next);
                                  teamValidation.handleChange("userId", next);
                                }}
                              >
                                <SelectTrigger
                                  className={fieldErrorClass(teamValidation.shouldShow("userId"))}
                                  {...fieldAria(
                                    "userId",
                                    teamValidation.shouldShow("userId") ? teamValidation.errors.userId : null,
                                  )}
                                >
                                  <SelectValue placeholder="Select staff" />
                                </SelectTrigger>
                                <SelectContent>
                                  {projectTeamStaff.map((user) => (
                                    <SelectItem key={user.id} value={user.id}>
                                      {user.name} · {roleLabels[user.role as Role] ?? user.role}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {teamValidation.shouldShow("userId") ? (
                                <FormFieldError field="userId" message={teamValidation.errors.userId} />
                              ) : null}
                            </div>
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={teamAssignment.isLead}
                                onChange={(e) =>
                                  setTeamAssignment((prev) => ({ ...prev, isLead: e.target.checked }))
                                }
                              />
                              Assign as lead
                            </label>
                            <Button type="submit" disabled={teamSaving}>
                              {teamSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                              Add to team
                            </Button>
                          </form>
                        ) : null}
                        {job.assignments?.length ? (
                          <div className="space-y-2">
                            {job.assignments.map((member) => (
                              <div key={member.id} className="rounded-lg border px-3 py-2 text-sm">
                                <p className="font-medium">
                                  {member.user?.name ?? "Team member"}
                                  {member.isLead ? " · Lead" : ""}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {roleLabels[(member.user?.role ?? member.role) as Role] ?? member.role}
                                  {" · "}
                                  Assigned {formatDate(member.assignedAt)}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Lead: {job.engineer || "Not assigned"}. No additional team members yet.
                          </p>
                        )}
                      </div>
                    </DetailSection>
                  ),
                },
              ]
            : []),
        ] : undefined}
        sidebar={job ? (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wrench className="h-4 w-4" /> Status & actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {job.status === "completed" ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {canAccessBilling
                        ? "Delivery is complete. Download the service report, or continue to Billing to generate the invoice and record service warranty on the equipment."
                        : "Delivery is complete. Download the service report if needed. Billing is handled by billing staff."}
                    </p>
                    {canDownloadServiceReport ? (
                      <Button
                        variant="outline"
                        className="w-full"
                        disabled={downloadingReport}
                        onClick={() => void generateServiceReport()}
                      >
                        {downloadingReport ? (
                          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="mr-1.5 h-4 w-4" />
                        )}
                        {downloadingReport ? "Generating…" : "Download Service Report"}
                      </Button>
                    ) : null}
                    {canAccessBilling ? (
                      <Button className="w-full" asChild>
                        <Link to={`/app/billing/jobs/${job.id}`}>Open billing for this job</Link>
                      </Button>
                    ) : null}
                    {job.serviceRequestId && canAccessTickets ? (
                      <Button variant="outline" className="w-full" asChild>
                        <Link to={`/app/service-tickets/${job.serviceRequestId}`}>Open linked ticket</Link>
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <>
                    {awaitingQa ? (
                      <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-foreground">
                        {canApproveComplete
                          ? "Work submitted for QA. Pass to send to Delivery, or fail to return to Repair."
                          : "Work submitted for QA. A coordinator, admin, or QA staff member must pass QA before Delivery."}
                      </p>
                    ) : null}
                    {awaitingDelivery ? (
                      <p className="rounded-md border border-info/30 bg-info/10 px-3 py-2 text-sm text-foreground">
                        {canAccessBilling
                          ? "QA passed. Confirm Delivery to complete the job and continue to billing."
                          : "QA passed. Confirm Delivery to complete the job."}
                      </p>
                    ) : null}
                    {(canUpdateJob || canApproveComplete) && job.status !== "completed" ? (
                      <div className="space-y-2">
                        <Label>Update status</Label>
                        <Select
                          value={selectedApiStatus}
                          onValueChange={(v) => void updateJobStatus(v)}
                          disabled={Boolean((awaitingQa || awaitingDelivery) && !canApproveComplete)}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {statusOptions.map((o) => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}
                    {canUpdateJob && job.status !== "completed" ? (
                      <div className="grid grid-cols-2 gap-2">
                        <ActionBtn
                          icon={ClipboardList}
                          label={hasWorkReport ? "Edit work report" : "Work report"}
                          onClick={() => workReport.openReport(job)}
                        />
                        <ActionBtn icon={PlusCircle} label="Parts / scope" onClick={() => void openPartsDialog()} />
                        <ActionBtn icon={PackageMinus} label="Stock" onClick={() => void openStockDialog()} />
                        <ActionBtn icon={Camera} label="Quick photos" onClick={() => { photosValidation.reset(); resetPhotoDraft(); setPhotosOpen(true); }} />
                      </div>
                    ) : null}
                    {awaitingQa && canApproveComplete ? (
                      <div className="grid gap-2">
                        <Button className="w-full" variant="outline" onClick={() => void failQaReturnToRepair()}>
                          QA Fail — Return to Repair
                        </Button>
                        <Button className="w-full" onClick={() => void approveQaPass()}>
                          QA Pass — Send to Delivery
                        </Button>
                      </div>
                    ) : null}
                    {awaitingDelivery && canApproveComplete ? (
                      <Button className="w-full" onClick={() => void confirmDelivery()}>
                        Confirm Delivery & Complete
                      </Button>
                    ) : null}
                    {canSubmitForReview ? (
                      <Button className="w-full" variant="outline" onClick={() => void submitForReview()}>
                        Submit for QA & Report
                      </Button>
                    ) : null}
                  </>
                )}
              </CardContent>
            </Card>
            {isProject ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <UserPlus className="h-4 w-4" /> Team
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {job.assignments?.length ? (
                    job.assignments.slice(0, 5).map((member) => (
                      <div key={member.id} className="text-sm">
                        <p className="font-medium">
                          {member.user?.name ?? "Team member"}
                          {member.isLead ? " · Lead" : ""}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">{job.engineer || "No team assigned"}</p>
                  )}
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setSearchParams({ tab: "team" })}
                  >
                    Manage team
                  </Button>
                </CardContent>
              </Card>
            ) : null}
          </div>
        ) : undefined}
      />

      <Dialog open={photosOpen} onOpenChange={(open) => { if (!open) { photosValidation.reset(); resetPhotoDraft(); } setPhotosOpen(open); }}>
        <DialogContent ref={photosDialogRef} className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Upload Photos</DialogTitle></DialogHeader>
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void handleUploadPhotos();
            }}
          >
            <div className="grid gap-4 py-2" data-field="photos">
              <p className="text-sm text-muted-foreground">
                Attach before/after photos. Each image has a time or note field.
              </p>
              <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                setPhotoFiles(files);
                setPhotoCaptions(files.map(() => ""));
                photosValidation.clearError("photos");
                photosValidation.handleChange("photos", { photoCount: files.length });
                e.target.value = "";
              }} />
              <Button
                type="button"
                variant="outline"
                className={fieldErrorClass(photosValidation.shouldShow("photos"), "w-full")}
                {...fieldAria("photos", photosValidation.shouldShow("photos") ? photosValidation.errors.photos : null)}
                onClick={() => photoInputRef.current?.click()}
              >
                <Camera className="mr-2 h-4 w-4" />
                {photoFiles.length > 0 ? `${photoFiles.length} photo(s) selected` : "Choose photos"}
              </Button>
              {photoPreviews.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {photoPreviews.map(({ file, url }, index) => (
                    <PhotoCaptionTile
                      key={`${file.name}-${file.lastModified}-${index}`}
                      src={url}
                      alt={file.name}
                      caption={photoCaptions[index] ?? ""}
                      onCaptionChange={(value) => {
                        setPhotoCaptions((prev) => {
                          const next = [...prev];
                          next[index] = value;
                          return next;
                        });
                      }}
                      onRemove={() => {
                        const nextFiles = photoFiles.filter((_, i) => i !== index);
                        setPhotoFiles(nextFiles);
                        setPhotoCaptions((prev) => prev.filter((_, i) => i !== index));
                        photosValidation.handleChange("photos", { photoCount: nextFiles.length });
                      }}
                    />
                  ))}
                </div>
              ) : null}
              {photosValidation.shouldShow("photos") && (
                <FormFieldError field="photos" message={photosValidation.errors.photos} />
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setPhotosOpen(false); resetPhotoDraft(); }}>Cancel</Button>
              <Button type="submit" disabled={actionSaving}>
                {actionSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Upload"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={partsOpen} onOpenChange={(open) => {
        if (!open) resetPartsForm();
        setPartsOpen(open);
      }}>
        <DialogContent ref={scopeDialogRef} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingExtraId ? "Edit additional products / equipment" : "Request additional products / equipment"}
            </DialogTitle>
          </DialogHeader>
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void handleScopeChange();
            }}
          >
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label>Item type</Label>
                <Select value={extraType} onValueChange={(value) => setExtraType(value as typeof extraType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENGINEER_EXTRA_TYPES.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2" data-field="partsItemId">
                <Label>Inventory product (optional)</Label>
                <InventoryProductSelect
                  items={inventory}
                  value={partsItemId}
                  onValueChange={(id) => setPartsItemId(id)}
                  placeholder="Select a product, if required"
                  getOptionLabel={(item) =>
                    `${item.name} (${item.sku}) — ${Math.max(0, item.inStock - item.reserved)} available`
                  }
                />
              </div>
              <div className="grid gap-2" data-field="partsQty">
                <Label htmlFor="parts-qty">Quantity</Label>
                <Input
                  id="parts-qty"
                  type="number"
                  min={1}
                  value={partsQty}
                  className={fieldErrorClass(scopeValidation.shouldShow("partsQty"))}
                  onChange={(event) => {
                    setPartsQty(Number(event.target.value));
                    scopeValidation.clearError("partsQty");
                  }}
                />
                {scopeValidation.shouldShow("partsQty") ? (
                  <FormFieldError field="partsQty" message={scopeValidation.errors.partsQty} />
                ) : null}
              </div>
              <div className="grid gap-2" data-field="partsNote">
              <Label htmlFor="parts-note" className={scopeValidation.shouldShow("partsNote") ? "text-destructive" : undefined}>
                Parts / scope details
                <RequiredMark />
              </Label>
              <Textarea
                id="parts-note"
                name="partsNote"
                placeholder="Extra parts, quantity, or scope change reason…"
                value={partsNote}
                rows={4}
                className={fieldErrorClass(scopeValidation.shouldShow("partsNote"))}
                {...fieldAria("partsNote", scopeValidation.shouldShow("partsNote") ? scopeValidation.errors.partsNote : null)}
                onChange={(e) => {
                  setPartsNote(e.target.value);
                  scopeValidation.handleChange("partsNote", { partsNote: e.target.value });
                }}
                onBlur={() => scopeValidation.handleBlur("partsNote", { partsNote })}
              />
              {scopeValidation.shouldShow("partsNote") && (
                <FormFieldError field="partsNote" message={scopeValidation.errors.partsNote} />
              )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPartsOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={actionSaving}>
                {actionSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingExtraId ? "Save changes" : "Submit"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={stockOpen} onOpenChange={(open) => { if (!open) stockValidation.reset(); setStockOpen(open); }}>
        <DialogContent ref={stockDialogRef} className="sm:max-w-md">
          <DialogHeader><DialogTitle>Deduct Stock</DialogTitle></DialogHeader>
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (stockItemId && stockQty > (inventory.find((item) => item.id === stockItemId)?.inStock ?? 0)) {
                void handleShortagePurchase();
              } else {
                void handleDeductStock();
              }
            }}
          >
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label>Item class</Label>
                <Select
                  value={stockClassFilter}
                  onValueChange={(value) => {
                    setStockClassFilter(value as "all" | InventoryItemClass);
                    setStockItemId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All classes</SelectItem>
                    {INVENTORY_ITEM_CLASS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2" data-field="stockItemId">
                <Label className={stockValidation.shouldShow("stockItemId") ? "text-destructive" : undefined}>
                  Inventory item
                  <RequiredMark />
                </Label>
                <InventoryProductSelect
                  id="stockItemId"
                  items={stockInventoryOptions}
                  value={stockItemId}
                  onValueChange={(v) => {
                    setStockItemId(v);
                    stockValidation.clearError("stockItemId");
                    stockValidation.clearError("stockQty");
                  }}
                  placeholder="Select item"
                  getOptionLabel={(i) =>
                    `${formatInventoryItemClass(i.itemClass)} · ${i.name} (${i.sku}) — ${i.inStock} in stock`
                  }
                  triggerClassName={fieldErrorClass(stockValidation.shouldShow("stockItemId"))}
                />
                {stockValidation.shouldShow("stockItemId") && (
                  <FormFieldError field="stockItemId" message={stockValidation.errors.stockItemId} />
                )}
              </div>
              <div className="grid gap-2" data-field="stockQty">
                <Label htmlFor="stock-qty" className={stockValidation.shouldShow("stockQty") ? "text-destructive" : undefined}>
                  Quantity
                  <RequiredMark />
                </Label>
                <Input
                  id="stock-qty"
                  name="stockQty"
                  type="number"
                  min={1}
                  value={stockQty}
                  className={fieldErrorClass(stockValidation.shouldShow("stockQty"))}
                  {...fieldAria("stockQty", stockValidation.shouldShow("stockQty") ? stockValidation.errors.stockQty : null)}
                  onChange={(e) => {
                    setStockQty(Number(e.target.value));
                    stockValidation.clearError("stockQty");
                  }}
                  onBlur={() => {
                    const item = inventory.find((i) => i.id === stockItemId);
                    const fieldErrors = validateStock({ stockItemId, stockQty }, item?.inStock ?? 0);
                    if (fieldErrors.stockQty) {
                      stockValidation.validateAll({ stockItemId, stockQty }, fieldErrors, stockDialogRef.current);
                    }
                  }}
                />
                {stockValidation.shouldShow("stockQty") && (
                  <FormFieldError field="stockQty" message={stockValidation.errors.stockQty} />
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStockOpen(false)}>Cancel</Button>
              {stockItemId && stockQty > (inventory.find((item) => item.id === stockItemId)?.inStock ?? 0) ? (
                <Button type="submit" disabled={actionSaving}>
                  {actionSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Create PO for shortage
                </Button>
              ) : (
                <Button type="submit" disabled={actionSaving}>
                  {actionSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Deduct"}
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <JobWorkReportPanel
        open={Boolean(workReport.job)}
        onClose={workReport.closePanel}
        job={workReport.job}
        existingLog={workReport.existingLog}
        existingPhotos={workReport.existingPhotos}
        saving={workReport.saving}
        onSubmit={() => void workReport.submitReport()}
        workPerformed={workReport.workPerformed}
        setWorkPerformed={workReport.setWorkPerformed}
        testingResult={workReport.testingResult}
        setTestingResult={workReport.setTestingResult}
        calibrationResult={workReport.calibrationResult}
        setCalibrationResult={workReport.setCalibrationResult}
        recommendation={workReport.recommendation}
        setRecommendation={workReport.setRecommendation}
        setNewImages={workReport.setNewImages}
        imageCaptions={workReport.imageCaptions}
        setImageCaptions={workReport.setImageCaptions}
        newImagePreviews={workReport.newImagePreviews}
      />

      <Dialog
        open={registrationOpen}
        onOpenChange={(open) => {
          if (!open) registrationValidation.reset();
          setRegistrationOpen(open);
        }}
      >
        <DialogContent ref={registrationDialogRef} className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit job registration</DialogTitle>
            <DialogDescription>
              Update schedule, assignee, type, or optional fields. Linked inspection, estimate, and billing history are not removed by this edit.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2" data-field="type">
              <Label>Service type</Label>
              <Select
                value={registrationForm.type || undefined}
                onValueChange={(v) => {
                  const next = {
                    ...registrationForm,
                    type: v,
                    typeOther: v === "Other" ? registrationForm.typeOther : "",
                  };
                  setRegistrationForm(next);
                  registrationValidation.clearError("type");
                  if (v !== "Other") registrationValidation.clearError("typeOther");
                  registrationValidation.handleChange("type", next);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {registrationForm.type === "Other" ? (
              <div className="grid gap-2" data-field="typeOther">
                <Label className={registrationValidation.shouldShow("typeOther") ? "text-destructive" : undefined}>
                  Specify type
                  <RequiredMark />
                </Label>
                <Input
                  value={registrationForm.typeOther}
                  className={fieldErrorClass(registrationValidation.shouldShow("typeOther"))}
                  {...fieldAria(
                    "typeOther",
                    registrationValidation.shouldShow("typeOther") ? registrationValidation.errors.typeOther : null,
                  )}
                  onChange={(e) => {
                    const next = { ...registrationForm, typeOther: e.target.value };
                    setRegistrationForm(next);
                    registrationValidation.handleChange("typeOther", next);
                  }}
                  onBlur={() => registrationValidation.handleBlur("typeOther", registrationForm)}
                />
                {registrationValidation.shouldShow("typeOther") && (
                  <FormFieldError field="typeOther" message={registrationValidation.errors.typeOther} />
                )}
              </div>
            ) : null}
            <div className="grid gap-2" data-field="engineerId">
              <Label className={registrationValidation.shouldShow("engineerId") ? "text-destructive" : undefined}>
                Assign to
                <RequiredMark />
              </Label>
              {loadingStaff ? (
                <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading staff…
                </div>
              ) : (
                <Select
                  value={registrationForm.engineerId}
                  onValueChange={(v) => {
                    const next = { ...registrationForm, engineerId: v };
                    setRegistrationForm(next);
                    registrationValidation.clearError("engineerId");
                    registrationValidation.handleChange("engineerId", next);
                  }}
                >
                  <SelectTrigger
                    className={fieldErrorClass(registrationValidation.shouldShow("engineerId"))}
                    {...fieldAria(
                      "engineerId",
                      registrationValidation.shouldShow("engineerId") ? registrationValidation.errors.engineerId : null,
                    )}
                  >
                    <SelectValue placeholder="Select assignee" />
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
              {registrationValidation.shouldShow("engineerId") && (
                <FormFieldError field="engineerId" message={registrationValidation.errors.engineerId} />
              )}
            </div>
            <div className="grid gap-2" data-field="scheduledFor">
              <Label className={registrationValidation.shouldShow("scheduledFor") ? "text-destructive" : undefined}>
                Scheduled for
                <RequiredMark />
              </Label>
              <Input
                type="date"
                value={registrationForm.scheduledFor}
                className={fieldErrorClass(registrationValidation.shouldShow("scheduledFor"))}
                {...fieldAria(
                  "scheduledFor",
                  registrationValidation.shouldShow("scheduledFor") ? registrationValidation.errors.scheduledFor : null,
                )}
                onChange={(e) => {
                  const next = { ...registrationForm, scheduledFor: e.target.value };
                  setRegistrationForm(next);
                  registrationValidation.handleChange("scheduledFor", next);
                }}
                onBlur={() => registrationValidation.handleBlur("scheduledFor", registrationForm)}
              />
              {registrationValidation.shouldShow("scheduledFor") && (
                <FormFieldError field="scheduledFor" message={registrationValidation.errors.scheduledFor} />
              )}
            </div>
            <CustomerAdditionalFieldsEditor
              value={registrationForm.additionalFields}
              onChange={(additionalFields) => setRegistrationForm({ ...registrationForm, additionalFields })}
              title="Additional registration fields"
              description="Optional custom fields (site contact, accessories, PO reference, etc.)."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegistrationOpen(false)}>Cancel</Button>
            <Button onClick={() => void saveRegistration()} disabled={registrationSaving} variant="brand">
              {registrationSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={deleteJobOpen}
        onOpenChange={setDeleteJobOpen}
        title={`Delete ${recordLabel.toLowerCase()}?`}
        description={
          <div className="space-y-2">
            <p>
              Delete {recordLabel.toLowerCase()}{" "}
              <span className="font-medium text-foreground">{job?.reference}</span>? This cannot be
              undone.
            </p>
            <p>
              Jobs with invoices, stock deductions, extras, work logs, or QA/delivery/completed status
              cannot be deleted.
            </p>
          </div>
        }
        confirmLabel={`Delete ${recordLabel.toLowerCase()}`}
        loading={deletingJob}
        onConfirm={() => void deleteJobRegistration()}
      />

      <DeleteConfirmDialog
        open={!!deleteExtraId}
        onOpenChange={(open) => {
          if (!open) setDeleteExtraId(null);
        }}
        title="Delete parts / scope request?"
        description="Delete this pending parts / scope request? This cannot be undone."
        confirmLabel="Delete request"
        loading={deletingExtra}
        onConfirm={() => void deleteExtra()}
      />
    </RoleGuard>
  );
}

function ActionBtn({ icon: Icon, label, onClick }: { icon: typeof Camera; label: string; onClick: () => void }) {
  return (
    <Button variant="outline" className="h-auto flex-col gap-1.5 py-3" onClick={onClick}>
      <Icon className="h-4 w-4" />
      <span className="text-xs">{label}</span>
    </Button>
  );
}

export default function JobDetail() {
  return <ServiceJobDetail variant="job" />;
}
