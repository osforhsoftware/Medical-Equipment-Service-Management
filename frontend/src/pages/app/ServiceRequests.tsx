import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Plus, ChevronDown, Loader2, Pencil, Trash2, X } from "lucide-react";
import { FormFieldError } from "@/components/shared/FormFieldError";
import { RequiredMark } from "@/components/shared/RequiredMark";
import { useFormValidation } from "@/hooks/useFormValidation";
import { fieldAria, fieldErrorClass } from "@/lib/formValidation";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { TICKET_CREATE_ROLES } from "@/config/roles";
import {
  api,
  type BackendServiceRequest,
  type BackendUser,
} from "@/lib/api";
import { formatFixedOption, SERVICE_TYPE_OPTIONS } from "@/lib/fixedOptions";
import { roleLabels } from "@/data/mock";
import type { Role } from "@/data/types";
import { toast } from "@/lib/toast";

function formatServiceType(type?: string | null, typeOther?: string | null) {
  if (!type) return "—";
  return formatFixedOption(SERVICE_TYPE_OPTIONS, type, typeOther);
}

const STATUS_COLOR: Record<string, string> = {
  new: "border-info/20 bg-info/10 text-info",
  inspection: "border-warning/25 bg-warning/12 text-warning-foreground",
  estimate: "border-accent/20 bg-accent/10 text-accent",
  approval: "border-primary/20 bg-primary/10 text-primary",
  "pending-approval": "border-primary/20 bg-primary/10 text-primary",
  "in-progress": "border-accent/20 bg-accent/12 text-accent",
  inProgress: "border-accent/20 bg-accent/12 text-accent",
  "assigned-engineer": "border-accent/20 bg-accent/12 text-accent",
  completed: "border-success/20 bg-success/12 text-success",
  invoiced: "border-success/20 bg-success/12 text-success",
  closed: "border-muted-foreground/20 bg-muted text-muted-foreground",
};

/** Kanban columns map legacy + new workflow statuses into display buckets. */
const columns = [
  { key: "new", label: "New", statuses: ["new"] },
  { key: "inspection", label: "Inspection", statuses: ["inspection"] },
  { key: "estimate", label: "Estimate", statuses: ["estimate"] },
  { key: "approval", label: "Approval", statuses: ["approval", "pending_approval"] },
  {
    key: "in-progress",
    label: "In Progress",
    statuses: ["inProgress", "assigned_engineer", "change_pending_approval", "pending_final_approval"],
  },
  {
    key: "completed",
    label: "Completed",
    statuses: ["completed", "pending_invoice", "invoiced", "closed", "finished"],
  },
] as const;

const ALL_KANBAN_STATUSES = columns.flatMap((col) => col.statuses).join(",");
const KANBAN_PAGE_SIZE = 10;

/** Create-time assignment is intake only — Inspection Technician → Inspection flow. */
const CREATE_ASSIGN_ROLE: Role = "inspector";

const schema = z.object({
  customerId: z.string().min(1, "Select a customer"),
  type: z.string().optional(),
  typeOther: z.string().optional(),
  priority: z.string().min(1, "Select priority"),
  description: z.string().trim().max(500),
}).superRefine((data, ctx) => {
  if (data.type === "Other" && !data.typeOther?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["typeOther"], message: "Please specify the service type" });
  }
});

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

function sumStatusCounts(counts: Record<string, number>, statuses: readonly string[]) {
  return statuses.reduce((sum, status) => sum + (counts[status] ?? 0), 0);
}

function TicketColumn({
  columnKey,
  label,
  statuses,
  overdueOnly,
  count,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  columnKey: string;
  label: string;
  statuses: readonly string[];
  overdueOnly: boolean;
  count: number;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (ticket: BackendServiceRequest) => void;
  onDelete: (ticket: BackendServiceRequest) => void;
}) {
  const navigate = useNavigate();
  const query = useInfiniteQuery({
    queryKey: ["service-requests", { statuses: statuses.join(","), overdue: overdueOnly, limit: KANBAN_PAGE_SIZE }],
    queryFn: ({ pageParam }) =>
      api.listServiceRequests({
        statuses: statuses.join(","),
        page: pageParam,
        limit: KANBAN_PAGE_SIZE,
        overdue: overdueOnly || undefined,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.hasNextPage ? last.meta.page + 1 : undefined),
  });
  const items = query.data?.pages.flatMap((page) => page.data) ?? [];
  // Guard against infinite-query page overlap (e.g. non-deterministic ordering on identical timestamps).
  // Keep the first occurrence order stable.
  const itemsDeduped = Array.from(new Map(items.map((it) => [it.id, it])).values());
  const remaining = Math.max(0, count - itemsDeduped.length);
  const colorClass = STATUS_COLOR[columnKey] ?? STATUS_COLOR[statuses[0] ?? ""] ?? "";

  return (
    <div className="flex max-h-[calc(100vh-14rem)] min-h-0 min-w-0 flex-col rounded-lg border border-border bg-muted/30 p-3">
      <div className="mb-3 flex shrink-0 items-center justify-between px-1">
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${colorClass}`}>{label}</span>
        <span className="rounded-full border border-primary/10 bg-secondary px-2.5 py-0.5 text-xs font-semibold text-primary">
          {count}
        </span>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        {query.isLoading ? (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">Loading…</p>
        ) : query.isError ? (
          <p className="px-1 py-6 text-center text-xs text-destructive">
            Failed to load tickets. Restart the backend if you recently updated the database.
          </p>
        ) : itemsDeduped.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">No requests</p>
        ) : (
          itemsDeduped.map((r) => {
            const allEquip = r.equipmentItems?.length
              ? r.equipmentItems.map((e) => e.equipmentName).join(", ")
              : (r.equipmentName ?? "No equipment");
            return (
              <Card
                key={r.id}
                onClick={() => navigate(`/app/service-tickets/${r.id}`)}
                className="cursor-pointer space-y-2 p-3 hover:bg-muted/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{r.reference}</span>
                  <div className="flex items-center gap-1">
                    <StatusBadge status={r.priority} />
                    {canEdit || canDelete ? (
                      <div
                        className="flex items-center"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        {canEdit ? (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            aria-label={`Edit ${r.reference}`}
                            onClick={() => onEdit(r)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                        {canDelete ? (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            aria-label={`Delete ${r.reference}`}
                            onClick={() => onDelete(r)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
                <p className="line-clamp-2 text-sm font-medium leading-snug">{allEquip}</p>
                <p className="text-xs text-muted-foreground">{r.customerName}</p>
                <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
                  <span>{formatServiceType(r.type, r.typeOther)}</span>
                  <span className="truncate max-w-[90px] text-right">{r.assignedName ?? r.assignedTo ?? "Unassigned"}</span>
                </div>
              </Card>
            );
          })
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

export default function ServiceRequests() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const [searchParams] = useSearchParams();
  const overdueOnly = searchParams.get("filter") === "overdue";
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<BackendServiceRequest | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Create form
  const [form, setForm] = useState({
    customerId: "",
    type: "",
    typeOther: "",
    priority: "",
    description: "",
  });
  const [editForm, setEditForm] = useState({
    type: "",
    typeOther: "",
    priority: "",
    description: "",
  });
  const [selectedEquipIds, setSelectedEquipIds] = useState<string[]>([]);
  const [inspectors, setInspectors] = useState<BackendUser[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<BackendUser | null>(null);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const editDialogRef = useRef<HTMLDivElement>(null);
  const {
    errors,
    shouldShow,
    reset: resetValidation,
    validateAll,
    handleBlur,
    handleChange,
    applyApiErrors,
    clearError,
  } = useFormValidation({
    fieldOrder: [
      "customerId",
      "equipment",
      "type",
      "typeOther",
      "priority",
      "description",
      "assignedStaff",
    ],
    schema,
  });
  const editValidation = useFormValidation({
    fieldOrder: ["type", "typeOther", "priority", "description"],
    schema: editSchema,
  });

  const canCreate = hasRole(TICKET_CREATE_ROLES);
  const canEdit = hasRole(TICKET_CREATE_ROLES);
  const canDelete = hasRole(TICKET_CREATE_ROLES);

  const customersQuery = useQuery({
    queryKey: ["customers", "options"],
    queryFn: () => api.listCustomersOptions(),
    staleTime: 60_000,
    enabled: open,
  });

  const equipmentQuery = useQuery({
    queryKey: ["equipment", "options", form.customerId],
    queryFn: () => api.listEquipmentOptions(form.customerId ? { customerId: form.customerId } : undefined),
    staleTime: 60_000,
    enabled: open,
  });

  const countsQuery = useQuery({
    queryKey: ["service-requests", "status-counts", { overdue: overdueOnly }],
    queryFn: () =>
      api.getServiceRequestStatusCounts({
        overdue: overdueOnly || undefined,
        statuses: ALL_KANBAN_STATUSES,
      }),
    staleTime: 15_000,
  });

  const customers = (customersQuery.data ?? []).filter((x) => x.status === "active");
  const equipment = equipmentQuery.data ?? [];
  const statusCounts = countsQuery.data ?? {};

  // Multi-equipment toggling
  const toggleEquip = (id: string) => {
    setSelectedEquipIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  // Load inspection technicians when the create dialog opens
  useEffect(() => {
    if (!open) return;
    setLoadingStaff(true);
    api.listUsers({ role: CREATE_ASSIGN_ROLE, isActive: true })
      .then(setInspectors)
      .catch(() => setInspectors([]))
      .finally(() => setLoadingStaff(false));
  }, [open]);

  const submit = async () => {
    const extraErrors: Record<string, string> = {};
    if (selectedEquipIds.length === 0) {
      extraErrors.equipment = "Select at least one equipment item.";
    }

    if (!validateAll(form, extraErrors, dialogRef.current)) return;

    const parsed = schema.safeParse(form);
    if (!parsed.success) return;

    setSaving(true);
    try {
      await api.createServiceRequest({
        customerId: parsed.data.customerId,
        type: parsed.data.type || undefined,
        typeOther: parsed.data.type === "Other" ? parsed.data.typeOther?.trim() || null : null,
        priority: parsed.data.priority,
        description: parsed.data.description,
        equipmentIds: selectedEquipIds,
        ...(selectedStaff
          ? {
              assignedTo: selectedStaff.id,
              assignedName: selectedStaff.name,
              role: CREATE_ASSIGN_ROLE,
            }
          : {}),
      });
      toast.success("Service request created", {
        description: selectedStaff
          ? "Ticket is in New and ready for the Inspection flow."
          : "Ticket added to New. Assign an inspection technician when ready, or rely on auto-assign.",
      });
      resetValidation();
      setOpen(false);
      resetCreateForm();
      await queryClient.invalidateQueries({ queryKey: ["service-requests"] });
    } catch (err) {
      if (!applyApiErrors(err, dialogRef.current)) {
        toast.apiError(err, { fallback: "Unable to create request" });
      }
    } finally {
      setSaving(false);
    }
  };

  const resetCreateForm = () => {
    setForm({ customerId: "", type: "", typeOther: "", priority: "", description: "" });
    setSelectedEquipIds([]);
    setSelectedStaff(null);
    resetValidation();
  };

  const openEditTicket = (ticket: BackendServiceRequest) => {
    setEditingTicket(ticket);
    setEditForm({
      type: ticket.type ?? "",
      typeOther: ticket.typeOther ?? "",
      priority: ticket.priority,
      description: ticket.description ?? "",
    });
    editValidation.reset();
    setEditOpen(true);
  };

  const submitEdit = async () => {
    if (!editingTicket) return;
    if (!editValidation.validateAll(editForm, undefined, editDialogRef.current)) return;
    const parsed = editSchema.safeParse(editForm);
    if (!parsed.success) return;

    setSaving(true);
    try {
      await api.updateServiceRequest(editingTicket.id, {
        type: parsed.data.type || null,
        typeOther: parsed.data.type === "Other" ? parsed.data.typeOther?.trim() || null : null,
        priority: parsed.data.priority,
        description: parsed.data.description,
      });
      toast.success("Ticket updated");
      setEditOpen(false);
      setEditingTicket(null);
      editValidation.reset();
      await queryClient.invalidateQueries({ queryKey: ["service-requests"] });
    } catch (err) {
      if (!editValidation.applyApiErrors(err, editDialogRef.current)) {
        toast.apiError(err, { fallback: "Unable to update ticket" });
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteTicket = async (ticket: BackendServiceRequest) => {
    if (!window.confirm(`Delete ticket ${ticket.reference}? This cannot be undone.`)) return;
    setDeletingId(ticket.id);
    try {
      await api.deleteServiceRequest(ticket.id);
      toast.success("Ticket deleted", { description: ticket.reference });
      await queryClient.invalidateQueries({ queryKey: ["service-requests"] });
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to delete ticket" });
    } finally {
      setDeletingId(null);
    }
  };

  const filteredEquipment = equipment.filter((e) => !form.customerId || e.customerId === form.customerId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Service Tickets"
        description={
          overdueOnly
            ? "Open tickets past their SLA due date."
            : "End-to-end service tickets from intake through inspection, estimate, job, and billing."
        }
        actions={
          canCreate ? (
            <Button
              onClick={() => { resetCreateForm(); setOpen(true); }}
              variant="brand"
            >
              <Plus className="mr-1 h-4 w-4" /> New Ticket
            </Button>
          ) : undefined
        }
      />

      {countsQuery.isLoading && !countsQuery.data ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading service requests…
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {columns.map((col) => (
            <TicketColumn
              key={col.key}
              columnKey={col.key}
              label={col.label}
              statuses={col.statuses}
              overdueOnly={overdueOnly}
              count={sumStatusCounts(statusCounts, col.statuses)}
              canEdit={canEdit}
              canDelete={canDelete}
              onEdit={openEditTicket}
              onDelete={(ticket) => void deleteTicket(ticket)}
            />
          ))}
        </div>
      )}

      {/* ── Create Dialog ── */}
      <Dialog open={open} onOpenChange={(o) => { if (!o) resetCreateForm(); setOpen(o); }}>
        <DialogContent ref={dialogRef} className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Service Ticket</DialogTitle>
            <DialogDescription>Created on behalf of a customer.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2" data-field="customerId">
              <Label className={shouldShow("customerId") ? "text-destructive" : undefined}>
                Customer
                <RequiredMark />
              </Label>
              <Select
                value={form.customerId}
                onValueChange={(v) => {
                  setForm({ ...form, customerId: v });
                  setSelectedEquipIds([]);
                  clearError("customerId");
                  clearError("equipment");
                  handleChange("customerId", { ...form, customerId: v });
                }}
              >
                <SelectTrigger
                  id="customerId"
                  className={fieldErrorClass(shouldShow("customerId"))}
                  {...fieldAria("customerId", shouldShow("customerId") ? errors.customerId : null)}
                >
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {shouldShow("customerId") && <FormFieldError field="customerId" message={errors.customerId} />}
            </div>

            {/* Multi-select equipment */}
            <div className="grid gap-2" data-field="equipment">
              <Label className={shouldShow("equipment") ? "text-destructive" : undefined}>
                Equipment
                <RequiredMark />
                <span className="ml-1 text-xs font-normal text-muted-foreground">(select one or more)</span>
              </Label>
              {selectedEquipIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedEquipIds.map((id) => {
                    const eq = equipment.find((e) => e.id === id);
                    return (
                      <span key={id} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                        {eq?.name ?? id}
                        <button type="button" onClick={() => toggleEquip(id)} className="ml-0.5 hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              <div
                className={fieldErrorClass(
                  shouldShow("equipment"),
                  "max-h-36 overflow-y-auto rounded-lg border border-border",
                )}
                {...fieldAria("equipment", shouldShow("equipment") ? errors.equipment : null)}
              >
                {filteredEquipment.length === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground">
                    {form.customerId ? "No equipment for this customer." : "Select a customer first."}
                  </p>
                ) : (
                  filteredEquipment.map((e) => {
                    const checked = selectedEquipIds.includes(e.id);
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => {
                          toggleEquip(e.id);
                          clearError("equipment");
                        }}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-muted/50 ${checked ? "bg-primary/5" : ""}`}
                      >
                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? "border-primary bg-primary" : "border-border"}`}>
                          {checked && <span className="h-2 w-2 rounded-sm bg-white" />}
                        </span>
                        <span className="font-medium">{e.name}</span>
                        <span className="ml-auto text-xs text-muted-foreground">{e.assetTag}</span>
                      </button>
                    );
                  })
                )}
              </div>
              {shouldShow("equipment") && <FormFieldError field="equipment" message={errors.equipment} />}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2" data-field="type">
                <Label className={shouldShow("type") ? "text-destructive" : undefined}>
                  Type
                </Label>
                <Select
                  value={form.type || undefined}
                  onValueChange={(v) => {
                    const next = { ...form, type: v, typeOther: v === "Other" ? form.typeOther : "" };
                    setForm(next);
                    clearError("type");
                    if (v !== "Other") clearError("typeOther");
                    handleChange("type", next);
                  }}
                >
                  <SelectTrigger
                    id="type"
                    className={fieldErrorClass(shouldShow("type"))}
                    {...fieldAria("type", shouldShow("type") ? errors.type : null)}
                  >
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPE_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {shouldShow("type") && <FormFieldError field="type" message={errors.type} />}
              </div>
              <div className="grid gap-2" data-field="priority">
                <Label className={shouldShow("priority") ? "text-destructive" : undefined}>
                  Priority
                  <RequiredMark />
                </Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) => {
                    const next = { ...form, priority: v };
                    setForm(next);
                    clearError("priority");
                    handleChange("priority", next);
                  }}
                >
                  <SelectTrigger
                    id="priority"
                    className={fieldErrorClass(shouldShow("priority"))}
                    {...fieldAria("priority", shouldShow("priority") ? errors.priority : null)}
                  >
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {["low", "medium", "high", "critical"].map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {shouldShow("priority") && <FormFieldError field="priority" message={errors.priority} />}
              </div>
            </div>
            {form.type === "Other" && (
              <div className="grid gap-2" data-field="typeOther">
                <Label htmlFor="sr-type-other" className={shouldShow("typeOther") ? "text-destructive" : undefined}>
                  Specify type
                  <RequiredMark />
                </Label>
                <Input
                  id="sr-type-other"
                  value={form.typeOther}
                  onChange={(e) => {
                    const next = { ...form, typeOther: e.target.value };
                    setForm(next);
                    handleChange("typeOther", next);
                  }}
                  onBlur={() => handleBlur("typeOther", form)}
                  className={fieldErrorClass(shouldShow("typeOther"))}
                  {...fieldAria("typeOther", shouldShow("typeOther") ? errors.typeOther : null)}
                  placeholder="e.g. Relocation, Decommission"
                />
                {shouldShow("typeOther") && <FormFieldError field="typeOther" message={errors.typeOther} />}
              </div>
            )}

            <div className="grid gap-2" data-field="description">
              <Label className={shouldShow("description") ? "text-destructive" : undefined}>
                Description
              </Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => {
                  const next = { ...form, description: e.target.value.slice(0, 500) };
                  setForm(next);
                  handleChange("description", next);
                }}
                onBlur={() => handleBlur("description", form)}
                className={fieldErrorClass(shouldShow("description"))}
                {...fieldAria("description", shouldShow("description") ? errors.description : null)}
                placeholder="Describe the reported issue…"
                rows={3}
              />
              <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
                <span className="tabular-nums">{form.description.length} / 500</span>
              </div>
              {shouldShow("description") && <FormFieldError field="description" message={errors.description} />}
            </div>

            {/* Intake → Inspection flow only (no direct engineer/estimator assign on create) */}
            <div className="rounded-lg border border-border p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Assign Inspection Technician{" "}
                <span className="font-normal normal-case text-muted-foreground">
                  (optional — starts Inspection flow; assign later if needed)
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                New tickets go to Inspection first. Estimate and engineer assignment happen in later steps.
              </p>
              <div className="grid gap-2" data-field="assignedStaff">
                <Label className={shouldShow("assignedStaff") ? "text-destructive" : undefined}>
                  {roleLabels[CREATE_ASSIGN_ROLE]}
                </Label>
                {loadingStaff ? (
                  <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading staff…
                  </div>
                ) : inspectors.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-1">
                    No active inspection technicians. Leave blank to use auto-assign, or add one in Users.
                  </p>
                ) : (
                  <Select
                    value={selectedStaff?.id ?? "__unassigned__"}
                    onValueChange={(v) => {
                      if (!v || v === "__unassigned__") {
                        setSelectedStaff(null);
                        clearError("assignedStaff");
                        return;
                      }
                      const staff = inspectors.find((s) => s.id === v) ?? null;
                      setSelectedStaff(staff);
                      clearError("assignedStaff");
                    }}
                  >
                    <SelectTrigger
                      id="assignedStaff"
                      className={fieldErrorClass(shouldShow("assignedStaff"))}
                      {...fieldAria(
                        "assignedStaff",
                        shouldShow("assignedStaff") ? errors.assignedStaff : null,
                      )}
                    >
                      <SelectValue placeholder="Select inspection technician (or leave blank)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__unassigned__">Unassigned (assign later)</SelectItem>
                      {inspectors.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {shouldShow("assignedStaff") && (
                  <FormFieldError field="assignedStaff" message={errors.assignedStaff} />
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetCreateForm(); setOpen(false); }}>Cancel</Button>
            <Button onClick={submit} disabled={saving} variant="brand">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog
        open={editOpen}
        onOpenChange={(o) => {
          if (!o) {
            setEditingTicket(null);
            editValidation.reset();
          }
          setEditOpen(o);
        }}
      >
        <DialogContent ref={editDialogRef} className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit ticket</DialogTitle>
            <DialogDescription>
              {editingTicket
                ? `Update type, priority, or description for ${editingTicket.reference}.`
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={() => void submitEdit()} disabled={saving || Boolean(deletingId)} variant="brand">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
