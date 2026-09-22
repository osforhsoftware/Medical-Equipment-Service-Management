import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Plus, ChevronDown, CalendarDays, LayoutGrid, List, Loader2, X, FileSpreadsheet } from "lucide-react";
import { endOfMonth, format, parse, startOfMonth } from "date-fns";
import { FormFieldError } from "@/components/shared/FormFieldError";
import { RequiredMark } from "@/components/shared/RequiredMark";
import {
  SavedViewsSidebar,
  TICKETS_SAVED_VIEWS,
  parseSavedView,
  type SavedViewKey,
} from "@/components/shared/SavedViewsSidebar";
import { TicketsCalendar } from "@/components/tickets/TicketsCalendar";
import { useFormValidation } from "@/hooks/useFormValidation";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useListingUrlState } from "@/hooks/useListingUrlState";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { fieldAria, fieldErrorClass } from "@/lib/formValidation";
import { EMPTY_PAGINATION_META } from "@/lib/listing";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable, type Column } from "@/components/shared/DataTable";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAuth } from "@/context/AuthContext";
import { TICKET_CREATE_ROLES } from "@/config/roles";
import { CustomerAdditionalFieldsEditor } from "@/components/customers/CustomerAdditionalFieldsEditor";
import {
  api,
  type BackendServiceRequest,
  type BackendUser,
} from "@/lib/api";
import {
  sanitizeCustomerAdditionalFields,
  type CustomerAdditionalField,
} from "@/lib/customerFields";
import { formatFixedOption, SERVICE_TYPE_OPTIONS } from "@/lib/fixedOptions";
import { roleLabels } from "@/data/mock";
import type { Role } from "@/data/types";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { downloadSpreadsheet } from "@/lib/exportSpreadsheet";
import { formatDate } from "@/lib/format";

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
const BILLING_STATUSES = ["pending_invoice", "invoiced"] as const;
const KANBAN_PAGE_SIZE = 5;
const CALENDAR_PAGE_SIZE = 100;

type TicketViewMode = "board" | "table" | "calendar";

function parseTicketViewMode(value: string | null): TicketViewMode {
  if (value === "table" || value === "calendar") return value;
  return "board";
}

function parseMonthParam(value: string | null): Date {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const parsed = parse(`${value}-01`, "yyyy-MM-dd", new Date());
    if (!Number.isNaN(parsed.getTime())) return startOfMonth(parsed);
  }
  return startOfMonth(new Date());
}

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

function sumStatusCounts(counts: Record<string, number>, statuses: readonly string[]) {
  return statuses.reduce((sum, status) => sum + (counts[status] ?? 0), 0);
}

function equipmentLabel(r: BackendServiceRequest) {
  if (r.equipmentItems?.length) {
    return r.equipmentItems.map((e) => e.equipmentName).join(", ");
  }
  return r.equipmentName ?? "No equipment";
}

function assignedTechnicianLabel(r: BackendServiceRequest) {
  return (
    r.assignedName
    ?? r.assignedEngineerName
    ?? r.assignedInspectorName
    ?? r.assignedEstimatorName
    ?? "Unassigned"
  );
}

function statusBucketLabel(status: string) {
  const bucket = columns.find((col) => (col.statuses as readonly string[]).includes(status));
  return bucket?.label ?? status.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusesForBucket(bucketKey: string | undefined) {
  if (!bucketKey || bucketKey === "all") return ALL_KANBAN_STATUSES;
  const bucket = columns.find((col) => col.key === bucketKey);
  return bucket ? bucket.statuses.join(",") : ALL_KANBAN_STATUSES;
}

function TicketColumn({
  columnKey,
  label,
  statuses,
  overdueOnly,
  mineOnly,
  completedScope,
  count,
  priority,
  search,
}: {
  columnKey: string;
  label: string;
  statuses: readonly string[];
  overdueOnly: boolean;
  mineOnly?: boolean;
  completedScope?: "recent" | "archive" | "all";
  count: number;
  priority?: string;
  search?: string;
}) {
  const navigate = useNavigate();
  const query = useInfiniteQuery({
    queryKey: ["service-requests", {
      statuses: statuses.join(","),
      overdue: overdueOnly,
      mine: mineOnly,
      completedScope: completedScope ?? "all",
      limit: KANBAN_PAGE_SIZE,
      priority: priority || undefined,
      search: search || undefined,
    }],
    queryFn: ({ pageParam }) =>
      api.listServiceRequests({
        statuses: statuses.join(","),
        page: pageParam,
        limit: KANBAN_PAGE_SIZE,
        overdue: overdueOnly || undefined,
        mine: mineOnly || undefined,
        completedScope: completedScope ?? "all",
        priority: priority || undefined,
        search: search || undefined,
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
    <div className="flex max-h-[calc(100vh-14rem)] min-h-0 min-w-[280px] sm:min-w-0 flex-1 shrink-0 snap-center flex-col rounded-xl border border-border bg-muted/30 p-3 shadow-2xs">
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
          itemsDeduped.map((r) => (
            <Card
              key={r.id}
              onClick={() => navigate(`/app/service-tickets/${r.id}`)}
              className="cursor-pointer space-y-2 p-3 hover:bg-muted/40"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-xs text-muted-foreground">{r.reference}</span>
                <StatusBadge status={r.priority} />
              </div>
              <p className="line-clamp-2 text-sm font-medium leading-snug">{equipmentLabel(r)}</p>
              <p className="text-xs text-muted-foreground">{r.customerName}</p>
              <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
                <span>{formatServiceType(r.type, r.typeOther)}</span>
                <span className="truncate max-w-[90px] text-right">{assignedTechnicianLabel(r)}</span>
              </div>
            </Card>
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

export default function ServiceRequests() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const savedFromUrl = parseSavedView(searchParams.get("saved"));
  const viewMode = parseTicketViewMode(searchParams.get("view"));
  const savedView: SavedViewKey =
    savedFromUrl !== "all"
      ? savedFromUrl
      : searchParams.get("filter") === "overdue"
        ? "overdue"
        : viewMode === "calendar"
          ? "calendar"
          : "all";
  const overdueOnly = savedView === "overdue";
  const mineOnly = savedView === "my";
  const completedScope = "all" as const;
  const calendarMonth = useMemo(
    () => parseMonthParam(searchParams.get("month")),
    [searchParams],
  );
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const {
    search,
    setSearch,
    filters,
    setFilter,
    listParams,
    setPage,
    setLimit,
    setSort,
    sortBy,
    sortOrder,
  } = useListingUrlState({ filterKeys: ["status", "priority"] });

  const debouncedSearch = useDebouncedValue(search);
  const statusFilter = filters.status;
  const priorityFilter = filters.priority;
  const tableStatuses = useMemo(() => {
    if (savedView === "billing") return BILLING_STATUSES.join(",");
    return statusesForBucket(statusFilter);
  }, [savedView, statusFilter]);

  const tableQueryParams = useMemo(
    () => ({
      page: listParams.page,
      limit: listParams.limit,
      search: debouncedSearch || undefined,
      sortBy: listParams.sortBy,
      sortOrder: listParams.sortOrder,
      statuses: tableStatuses,
      priority: priorityFilter || undefined,
      overdue: overdueOnly || undefined,
      mine: mineOnly || undefined,
      completedScope,
    }),
    [listParams.page, listParams.limit, listParams.sortBy, listParams.sortOrder, debouncedSearch, tableStatuses, priorityFilter, overdueOnly, mineOnly, completedScope],
  );

  // Create form
  const [form, setForm] = useState({
    customerId: "",
    type: "",
    typeOther: "",
    priority: "",
    description: "",
    additionalFields: [{ label: "", value: "" }] as CustomerAdditionalField[],
  });
  const [selectedEquipIds, setSelectedEquipIds] = useState<string[]>([]);
  const [inspectors, setInspectors] = useState<BackendUser[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<BackendUser | null>(null);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
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

  const canCreate = hasRole(TICKET_CREATE_ROLES);

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
    queryKey: ["service-requests", "status-counts", {
      overdue: overdueOnly,
      mine: mineOnly,
      completedScope,
      priority: priorityFilter || undefined,
      search: debouncedSearch || undefined,
    }],
    queryFn: () =>
      api.getServiceRequestStatusCounts({
        overdue: overdueOnly || undefined,
        mine: mineOnly || undefined,
        completedScope,
        statuses: savedView === "billing"
          ? BILLING_STATUSES.join(",")
          : ALL_KANBAN_STATUSES,
        priority: priorityFilter || undefined,
        search: debouncedSearch || undefined,
      }),
    staleTime: 15_000,
  });

  const tableQuery = usePaginatedQuery({
    queryKey: "service-requests-table",
    params: tableQueryParams,
    queryFn: (params) => api.listServiceRequests(params),
    enabled: viewMode === "table",
  });

  const calendarRange = useMemo(() => ({
    from: format(startOfMonth(calendarMonth), "yyyy-MM-dd"),
    to: format(endOfMonth(calendarMonth), "yyyy-MM-dd"),
  }), [calendarMonth]);

  const calendarQueryParams = useMemo(() => ({
    page: 1,
    limit: CALENDAR_PAGE_SIZE,
    search: debouncedSearch || undefined,
    sortBy: "slaDue",
    sortOrder: "asc" as const,
    statuses: tableStatuses,
    priority: priorityFilter || undefined,
    overdue: overdueOnly || undefined,
    mine: mineOnly || undefined,
    completedScope,
    slaDueFrom: calendarRange.from,
    slaDueTo: calendarRange.to,
  }), [calendarRange.from, calendarRange.to, debouncedSearch, tableStatuses, priorityFilter, overdueOnly, mineOnly, completedScope]);

  const calendarQuery = useQuery({
    queryKey: ["service-requests-calendar", calendarQueryParams],
    queryFn: () => api.listServiceRequests(calendarQueryParams),
    enabled: viewMode === "calendar",
    staleTime: 15_000,
  });

  const customers = (customersQuery.data ?? []).filter((x) => x.status === "active");
  const equipment = equipmentQuery.data ?? [];
  const statusCounts = countsQuery.data ?? {};
  const tableTickets = tableQuery.data?.data ?? [];
  const pagination = tableQuery.data?.meta ?? EMPTY_PAGINATION_META;
  const calendarTickets = calendarQuery.data?.data ?? [];
  const calendarTruncated = Boolean(calendarQuery.data?.meta.hasNextPage);

  const visibleColumns = useMemo(() => {
    if (savedView === "billing") {
      return [{
        key: "billing",
        label: "Billing",
        statuses: BILLING_STATUSES,
      }] as const;
    }
    if (statusFilter && statusFilter !== "all") {
      return columns.filter((col) => col.key === statusFilter);
    }
    return columns;
  }, [savedView, statusFilter]);

  const setViewMode = (next: TicketViewMode) => {
    setSearchParams((prev) => {
      const nextParams = new URLSearchParams(prev);
      if (next === "board") nextParams.delete("view");
      else nextParams.set("view", next);
      if (next === "calendar") {
        nextParams.set("saved", "calendar");
        if (!nextParams.get("month")) {
          nextParams.set("month", format(startOfMonth(new Date()), "yyyy-MM"));
        }
      } else {
        if (nextParams.get("saved") === "calendar") nextParams.delete("saved");
        nextParams.delete("month");
      }
      return nextParams;
    }, { replace: true });
  };

  const setSavedView = (next: SavedViewKey) => {
    setSearchParams((prev) => {
      const nextParams = new URLSearchParams(prev);
      if (next === "all") nextParams.delete("saved");
      else nextParams.set("saved", next);

      nextParams.delete("filter");

      if (next === "calendar") {
        nextParams.set("view", "calendar");
        if (!nextParams.get("month")) {
          nextParams.set("month", format(startOfMonth(new Date()), "yyyy-MM"));
        }
        nextParams.delete("status");
      } else {
        if (nextParams.get("view") === "calendar") {
          nextParams.delete("view");
          nextParams.delete("month");
        }
        if (next === "approval") nextParams.set("status", "approval");
        else if (next === "billing") nextParams.delete("status");
        else nextParams.delete("status");
      }

      nextParams.delete("page");
      return nextParams;
    }, { replace: true });
  };

  const setCalendarMonth = (next: Date) => {
    setSearchParams((prev) => {
      const nextParams = new URLSearchParams(prev);
      nextParams.set("view", "calendar");
      nextParams.set("saved", "calendar");
      nextParams.set("month", format(startOfMonth(next), "yyyy-MM"));
      return nextParams;
    }, { replace: true });
  };

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
        additionalFields: sanitizeCustomerAdditionalFields(form.additionalFields),
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
      await queryClient.invalidateQueries({ queryKey: ["service-requests-table"] });
    } catch (err) {
      if (!applyApiErrors(err, dialogRef.current)) {
        toast.apiError(err, { fallback: "Unable to create request" });
      }
    } finally {
      setSaving(false);
    }
  };

  const resetCreateForm = () => {
    setForm({
      customerId: "",
      type: "",
      typeOther: "",
      priority: "",
      description: "",
      additionalFields: [{ label: "", value: "" }],
    });
    setSelectedEquipIds([]);
    setSelectedStaff(null);
    resetValidation();
  };

  const filteredEquipment = equipment.filter((e) => !form.customerId || e.customerId === form.customerId);

  const tableColumns: Column<BackendServiceRequest>[] = [
    {
      key: "reference",
      header: "Ticket ID",
      render: (r) => <span className="font-mono text-sm font-medium">{r.reference}</span>,
    },
    {
      key: "equipment",
      header: "Equipment / Asset",
      render: (r) => (
        <div>
          <p className="text-sm font-medium leading-snug">{equipmentLabel(r)}</p>
          {r.equipmentItems?.[0]?.assetTag ? (
            <p className="text-xs text-muted-foreground">{r.equipmentItems.map((e) => e.assetTag).filter(Boolean).join(", ")}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "customerName",
      header: "Company",
      render: (r) => <span className="text-sm">{r.customerName || "—"}</span>,
    },
    {
      key: "type",
      header: "Service Type",
      render: (r) => <span className="text-sm text-muted-foreground">{formatServiceType(r.type, r.typeOther)}</span>,
    },
    {
      key: "priority",
      header: "Priority",
      render: (r) => <StatusBadge status={r.priority} />,
    },
    {
      key: "assigned",
      header: "Assigned Technician",
      render: (r) => <span className="text-sm text-muted-foreground">{assignedTechnicianLabel(r)}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusBadge status={r.status} label={statusBucketLabel(r.status)} />,
    },
  ];

  const sortOptions = [
    { value: "createdAt:desc", label: "Newest first" },
    { value: "createdAt:asc", label: "Oldest first" },
    { value: "reference:asc", label: "Ticket ID A–Z" },
    { value: "reference:desc", label: "Ticket ID Z–A" },
    { value: "customerName:asc", label: "Company A–Z" },
    { value: "priority:desc", label: "Priority high→low" },
    { value: "status:asc", label: "Status A–Z" },
  ] as const;

  const currentSortValue = `${sortBy ?? "createdAt"}:${sortOrder ?? "desc"}`;

  const [exporting, setExporting] = useState(false);

  const exportTickets = async () => {
    setExporting(true);
    try {
      const rows: BackendServiceRequest[] = [];
      let page = 1;
      let hasNext = true;
      while (hasNext && page <= 50) {
        const result = await api.listServiceRequests({
          ...tableQueryParams,
          page,
          limit: 100,
        });
        rows.push(...result.data);
        hasNext = result.meta.hasNextPage;
        page += 1;
      }
      downloadSpreadsheet(
        "service-tickets",
        [
          { header: "Reference", value: (r) => r.reference },
          { header: "Equipment", value: (r) => equipmentLabel(r) },
          { header: "Company", value: (r) => r.customerName },
          { header: "Service Type", value: (r) => formatServiceType(r.type, r.typeOther) },
          { header: "Priority", value: (r) => r.priority },
          { header: "Assigned", value: (r) => assignedTechnicianLabel(r) },
          { header: "Status", value: (r) => statusBucketLabel(r.status) },
          { header: "SLA Due", value: (r) => formatDate(r.slaDue) },
          { header: "Created", value: (r) => formatDate(r.createdAt) },
        ],
        rows,
      );
      toast.success("Export ready", { description: `${rows.length} ticket(s) exported for Excel.` });
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to export tickets" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Service Tickets"
        description="End-to-end service tickets from intake through inspection, estimate, job, and billing. Board columns show a few recent cards — use See more for the rest."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={exporting}
              onClick={() => void exportTickets()}
            >
              {exporting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-1 h-4 w-4" />}
              Export Excel
            </Button>
            {canCreate ? (
              <Button
                onClick={() => { resetCreateForm(); setOpen(true); }}
                variant="brand"
              >
                <Plus className="mr-1 h-4 w-4" /> New Ticket
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <SavedViewsSidebar
          value={savedView}
          onChange={setSavedView}
          items={TICKETS_SAVED_VIEWS}
          ariaLabel="Saved ticket views"
        />

        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between shadow-xs">
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(value) => {
                if (value === "board" || value === "table" || value === "calendar") setViewMode(value);
              }}
              variant="outline"
              size="sm"
              className="justify-start shrink-0"
              aria-label="Service tickets view"
            >
              <ToggleGroupItem value="board" aria-label="Kanban board view" className="gap-1.5 px-3">
                <LayoutGrid className="h-3.5 w-3.5" />
                Board
              </ToggleGroupItem>
              <ToggleGroupItem value="table" aria-label="Table grid view" className="gap-1.5 px-3">
                <List className="h-3.5 w-3.5" />
                Table
              </ToggleGroupItem>
              <ToggleGroupItem value="calendar" aria-label="Calendar schedule view" className="gap-1.5 px-3">
                <CalendarDays className="h-3.5 w-3.5" />
                Calendar
              </ToggleGroupItem>
            </ToggleGroup>

            {viewMode === "board" && (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter tickets..."
                  className="h-8 text-xs w-full sm:w-44 lg:w-52"
                />
                <Select
                  value={priorityFilter || "all"}
                  onValueChange={(val) => setFilter("priority", val === "all" ? "" : val)}
                >
                  <SelectTrigger className="h-8 w-32 text-xs">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>

                {(search || priorityFilter || (savedView && savedView !== "all")) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearch("");
                      setFilter("priority", "");
                      setSavedView("all");
                    }}
                    className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <X className="mr-1 h-3.5 w-3.5" /> Reset
                  </Button>
                )}
              </div>
            )}
          </div>

          {viewMode === "table" ? (
            <DataTable
              mode="server"
              data={tableTickets}
              columns={tableColumns}
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search tickets, equipment, company…"
              emptyMessage="No service tickets found."
              emptyHint="Try changing your search or filters."
              filterValues={filters}
              onFilterChange={setFilter}
              filters={[
                {
                  key: "status",
                  label: "Status",
                  options: columns.map((col) => ({ label: col.label, value: col.key })),
                },
                {
                  key: "priority",
                  label: "Priority",
                  options: ["low", "medium", "high", "critical"].map((p) => ({
                    label: p.charAt(0).toUpperCase() + p.slice(1),
                    value: p,
                  })),
                },
              ]}
              pagination={pagination}
              onPageChange={setPage}
              onLimitChange={setLimit}
              loading={tableQuery.isLoading}
              isFetching={tableQuery.isFetching}
              error={tableQuery.error as Error | null}
              onRetry={() => void tableQuery.refetch()}
              onRowClick={(r) => navigate(`/app/service-tickets/${r.id}`)}
              toolbarExtra={
                <Select
                  value={currentSortValue}
                  onValueChange={(value) => {
                    const [field, order] = value.split(":") as [string, "asc" | "desc"];
                    setSort(field, order);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
            />
          ) : viewMode === "calendar" ? (
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tickets, equipment, company…"
                  className="sm:max-w-sm"
                />
                <Select
                  value={statusFilter && statusFilter !== "all" ? statusFilter : "all"}
                  onValueChange={(value) => setFilter("status", value === "all" ? "" : value)}
                >
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {columns.map((col) => (
                      <SelectItem key={col.key} value={col.key}>
                        {col.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {calendarQuery.error ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
                  <p className="text-destructive">{(calendarQuery.error as Error).message || "Failed to load calendar."}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => void calendarQuery.refetch()}
                  >
                    Retry
                  </Button>
                </div>
              ) : (
                <TicketsCalendar
                  month={calendarMonth}
                  onMonthChange={setCalendarMonth}
                  tickets={calendarTickets}
                  loading={calendarQuery.isLoading || calendarQuery.isFetching}
                  truncated={calendarTruncated}
                  statusLabel={statusBucketLabel}
                  equipmentLabel={equipmentLabel}
                  assigneeLabel={assignedTechnicianLabel}
                />
              )}
            </div>
          ) : countsQuery.isLoading && !countsQuery.data ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading service requests…
            </div>
          ) : (
            <div
              className={cn(
                "flex overflow-x-auto gap-4 pb-4 snap-x snap-mandatory scrollbar-thin md:grid md:grid-cols-2",
                visibleColumns.length >= 6
                  ? "xl:grid-cols-3 2xl:grid-cols-6"
                  : visibleColumns.length >= 3
                    ? "xl:grid-cols-3"
                    : "xl:grid-cols-1",
              )}
            >
              {visibleColumns.map((col) => (
                <TicketColumn
                  key={col.key}
                  columnKey={col.key}
                  label={col.label}
                  statuses={col.statuses}
                  overdueOnly={overdueOnly}
                  mineOnly={mineOnly}
                  completedScope={completedScope}
                  priority={priorityFilter}
                  search={debouncedSearch || undefined}
                  count={sumStatusCounts(statusCounts, col.statuses)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

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

            <CustomerAdditionalFieldsEditor
              value={form.additionalFields}
              onChange={(additionalFields) => setForm({ ...form, additionalFields })}
              title="Additional registration fields"
              description="Optional custom fields (site contact, accessories received, PO reference, etc.)."
            />

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
    </div>
  );
}
