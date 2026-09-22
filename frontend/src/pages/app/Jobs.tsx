import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Plus, ChevronDown, CalendarDays, LayoutGrid, List, Loader2 } from "lucide-react";
import { endOfMonth, format, parse, startOfMonth } from "date-fns";
import { FormFieldError } from "@/components/shared/FormFieldError";
import { RequiredMark } from "@/components/shared/RequiredMark";
import { CustomerAdditionalFieldsEditor } from "@/components/customers/CustomerAdditionalFieldsEditor";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { JobsCalendar } from "@/components/jobs/JobsCalendar";
import {
  JobsSavedViewsSidebar,
  parseJobsSavedView,
  type JobsSavedView,
} from "@/components/jobs/JobsSavedViewsSidebar";
import { useFormValidation } from "@/hooks/useFormValidation";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useListingUrlState } from "@/hooks/useListingUrlState";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { fieldAria, fieldErrorClass, fieldRules } from "@/lib/formValidation";
import { EMPTY_PAGINATION_META } from "@/lib/listing";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { useAuth } from "@/context/AuthContext";
import { JOB_CREATE_ROLES } from "@/config/roles";
import { api, type BackendServiceJob, type BackendUser } from "@/lib/api";
import {
  sanitizeCustomerAdditionalFields,
  type CustomerAdditionalField,
} from "@/lib/customerFields";
import { formatFixedOption, SERVICE_TYPE_OPTIONS } from "@/lib/fixedOptions";
import { formatDate, formatJobStatus, todayInputValue, toApiJobStatus } from "@/lib/format";
import { roleLabels } from "@/data/mock";
import type { Role } from "@/data/types";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const columns = [
  { status: "scheduled", label: "Scheduled" },
  { status: "in-progress", label: "In Progress" },
  { status: "parts-pending", label: "Parts Pending" },
  { status: "review", label: "QA" },
  { status: "delivery", label: "Delivery" },
  { status: "completed", label: "Completed" },
] as const;

const KANBAN_PAGE_SIZE = 5;
const CALENDAR_PAGE_SIZE = 100;
type JobViewMode = "board" | "table" | "calendar";

function parseViewMode(value: string | null): JobViewMode {
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

function jobStatusLabel(status: string) {
  const ui = formatJobStatus(status);
  return columns.find((col) => col.status === ui)?.label
    ?? ui.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatServiceType(type?: string | null, typeOther?: string | null) {
  if (!type) return "—";
  return formatFixedOption(SERVICE_TYPE_OPTIONS, type, typeOther);
}

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
  additionalFields: [{ label: "", value: "" }] as CustomerAdditionalField[],
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

function JobColumn({
  status,
  label,
  search,
  assignee,
  overdue,
  completedScope,
}: {
  status: string;
  label: string;
  search?: string;
  assignee?: string;
  overdue?: boolean;
  completedScope?: "recent" | "archive" | "all";
}) {
  const apiStatus = toApiJobStatus(status);
  const query = useInfiniteQuery({
    queryKey: ["jobs", {
      status: apiStatus,
      limit: KANBAN_PAGE_SIZE,
      search: search || undefined,
      assignee,
      overdue,
      completedScope: completedScope ?? "all",
    }],
    queryFn: ({ pageParam }) => api.listJobs({
      status: apiStatus,
      page: pageParam,
      limit: KANBAN_PAGE_SIZE,
      search: search || undefined,
      assignee,
      overdue: overdue || undefined,
      completedScope: completedScope ?? "all",
    }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.hasNextPage ? last.meta.page + 1 : undefined),
  });
  const items = query.data?.pages.flatMap((page) => page.data) ?? [];
  const total = query.data?.pages[0]?.meta.total ?? items.length;
  const remaining = Math.max(0, total - items.length);

  return (
    <div className="flex max-h-[calc(100vh-14rem)] min-h-0 min-w-[280px] sm:min-w-0 flex-1 shrink-0 snap-center flex-col rounded-xl border border-border bg-muted/30 p-3 shadow-2xs">
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
            <Card key={j.id} className="space-y-2 p-3 hover:bg-muted/40">
              <Link to={`/app/jobs/${j.id}`} className="block space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{j.reference}</span>
                  <StatusBadge status={formatJobStatus(j.status)} label={jobStatusLabel(j.status)} />
                </div>
                <p className="text-sm font-medium leading-snug">{j.equipmentName}</p>
                <p className="text-xs text-muted-foreground">{j.customerName} · {formatServiceType(j.type, j.typeOther)}</p>
                <Progress value={j.progress} className="h-1.5" />
              </Link>
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

export default function Jobs() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewMode = parseViewMode(searchParams.get("view"));
  const savedView = (() => {
    const fromUrl = parseJobsSavedView(searchParams.get("saved"));
    if (fromUrl !== "all") return fromUrl;
    return viewMode === "calendar" ? "calendar" : "all";
  })();
  const calendarMonth = useMemo(
    () => parseMonthParam(searchParams.get("month")),
    [searchParams],
  );
  const [assignableStaff, setAssignableStaff] = useState<BackendUser[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const dialogRef = useRef<HTMLDivElement>(null);

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
  } = useListingUrlState({ filterKeys: ["status"] });

  const debouncedSearch = useDebouncedValue(search);
  const statusFilter = filters.status;
  const savedAssignee = savedView === "my" && user?.id ? user.id : undefined;
  const savedOverdue = savedView === "overdue" || undefined;
  const completedScope = "all" as const;

  const tableQueryParams = useMemo(() => {
    const apiStatus = statusFilter && statusFilter !== "all"
      ? toApiJobStatus(statusFilter)
      : undefined;
    return {
      page: listParams.page,
      limit: listParams.limit,
      search: debouncedSearch || undefined,
      sortBy: listParams.sortBy,
      sortOrder: listParams.sortOrder,
      status: apiStatus,
      assignee: savedAssignee,
      overdue: savedOverdue,
      completedScope,
    };
  }, [
    listParams.page,
    listParams.limit,
    listParams.sortBy,
    listParams.sortOrder,
    debouncedSearch,
    statusFilter,
    savedAssignee,
    savedOverdue,
    completedScope,
  ]);

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

  const tableQuery = usePaginatedQuery({
    queryKey: "jobs-table",
    params: tableQueryParams,
    queryFn: (params) => api.listJobs(params),
    enabled: viewMode === "table",
  });

  const calendarRange = useMemo(() => {
    const from = format(startOfMonth(calendarMonth), "yyyy-MM-dd");
    const to = format(endOfMonth(calendarMonth), "yyyy-MM-dd");
    return { from, to };
  }, [calendarMonth]);

  const calendarQueryParams = useMemo(() => {
    const apiStatus = statusFilter && statusFilter !== "all"
      ? toApiJobStatus(statusFilter)
      : undefined;
    return {
      page: 1,
      limit: CALENDAR_PAGE_SIZE,
      search: debouncedSearch || undefined,
      sortBy: "scheduledFor",
      sortOrder: "asc" as const,
      status: apiStatus,
      scheduledFrom: calendarRange.from,
      scheduledTo: calendarRange.to,
      assignee: savedAssignee,
      overdue: savedOverdue,
      completedScope,
    };
  }, [calendarRange.from, calendarRange.to, debouncedSearch, statusFilter, savedAssignee, savedOverdue, completedScope]);

  const calendarQuery = useQuery({
    queryKey: ["jobs-calendar", calendarQueryParams],
    queryFn: () => api.listJobs(calendarQueryParams),
    enabled: viewMode === "calendar",
    staleTime: 15_000,
  });

  const tableJobs = tableQuery.data?.data ?? [];
  const pagination = tableQuery.data?.meta ?? EMPTY_PAGINATION_META;
  const calendarJobs = calendarQuery.data?.data ?? [];
  const calendarTruncated = Boolean(calendarQuery.data?.meta.hasNextPage);

  const visibleColumns = useMemo(() => {
    if (statusFilter && statusFilter !== "all") return columns.filter((col) => col.status === statusFilter);
    return columns;
  }, [statusFilter]);

  const setViewMode = (next: JobViewMode) => {
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

  const setSavedView = (next: JobsSavedView) => {
    setSearchParams((prev) => {
      const nextParams = new URLSearchParams(prev);
      if (next === "all") nextParams.delete("saved");
      else nextParams.set("saved", next);

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
        if (next === "approval") nextParams.set("status", "review");
        else if (next === "billing") nextParams.set("status", "delivery");
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
      nextParams.set("month", format(startOfMonth(next), "yyyy-MM"));
      return nextParams;
    }, { replace: true });
  };

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
    setForm({
      ...emptyForm,
      engineerId: defaultEngineerId,
      scheduledFor: todayInputValue(),
      additionalFields: [{ label: "", value: "" }],
    });
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
        additionalFields: sanitizeCustomerAdditionalFields(form.additionalFields),
      });
      toast({ title: "Job scheduled", description: "Service job created successfully." });
      setDialogOpen(false);
      setForm(emptyForm);
      scheduleValidation.reset();
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      await queryClient.invalidateQueries({ queryKey: ["jobs-table"] });
      await queryClient.invalidateQueries({ queryKey: ["service-requests"] });
    } catch (err) {
      if (!scheduleValidation.applyApiErrors(err, dialogRef.current)) {
        toast.apiError(err, { fallback: "Unable to create job" });
      }
    } finally {
      setSaving(false);
    }
  };

  const tableColumns: Column<BackendServiceJob>[] = [
    {
      key: "reference",
      header: "Job ID",
      render: (j) => (
        <div>
          <p className="font-mono text-sm font-medium">{j.reference}</p>
          {j.requestRef ? <p className="text-xs text-muted-foreground">{j.requestRef}</p> : null}
        </div>
      ),
    },
    {
      key: "equipmentName",
      header: "Equipment / Asset",
      render: (j) => <span className="text-sm font-medium">{j.equipmentName || "—"}</span>,
    },
    {
      key: "customerName",
      header: "Company",
      render: (j) => <span className="text-sm">{j.customerName || "—"}</span>,
    },
    {
      key: "type",
      header: "Service Type",
      render: (j) => <span className="text-sm text-muted-foreground">{formatServiceType(j.type, j.typeOther)}</span>,
    },
    {
      key: "engineer",
      header: "Assigned Technician",
      render: (j) => <span className="text-sm text-muted-foreground">{j.engineer || "Unassigned"}</span>,
    },
    {
      key: "scheduledFor",
      header: "Scheduled",
      render: (j) => <span className="text-sm text-muted-foreground">{formatDate(j.scheduledFor)}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (j) => <StatusBadge status={formatJobStatus(j.status)} label={jobStatusLabel(j.status)} />,
    },
  ];

  const sortOptions = [
    { value: "scheduledFor:desc", label: "Scheduled newest" },
    { value: "scheduledFor:asc", label: "Scheduled oldest" },
    { value: "createdAt:desc", label: "Newest first" },
    { value: "reference:asc", label: "Job ID A–Z" },
    { value: "customerName:asc", label: "Company A–Z" },
    { value: "status:asc", label: "Status A–Z" },
    { value: "progress:desc", label: "Progress high→low" },
  ] as const;

  const currentSortValue = `${sortBy ?? "scheduledFor"}:${sortOrder ?? "desc"}`;

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

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <JobsSavedViewsSidebar value={savedView} onChange={setSavedView} />

          <div className="min-w-0 flex-1 space-y-4">
            <div className="rounded-lg border border-border bg-card px-3 py-2.5">
              <ToggleGroup
                type="single"
                value={viewMode}
                onValueChange={(value) => {
                  if (value === "board" || value === "table" || value === "calendar") setViewMode(value);
                }}
                variant="outline"
                size="sm"
                className="justify-start"
                aria-label="Service jobs view"
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
            </div>

            {viewMode === "table" ? (
              <DataTable
                mode="server"
                data={tableJobs}
                columns={tableColumns}
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search jobs, equipment, company…"
                emptyMessage="No service jobs found."
                emptyHint="Try changing your search or filters."
                filterValues={filters}
                onFilterChange={setFilter}
                filters={[
                  {
                    key: "status",
                    label: "Status",
                    options: columns.map((col) => ({ label: col.label, value: col.status })),
                  },
                ]}
                pagination={pagination}
                onPageChange={setPage}
                onLimitChange={setLimit}
                loading={tableQuery.isLoading}
                isFetching={tableQuery.isFetching}
                error={tableQuery.error as Error | null}
                onRetry={() => void tableQuery.refetch()}
                onRowClick={(j) => navigate(`/app/jobs/${j.id}`)}
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
                    placeholder="Search jobs, equipment, company…"
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
                        <SelectItem key={col.status} value={col.status}>
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
                  <JobsCalendar
                    month={calendarMonth}
                    onMonthChange={setCalendarMonth}
                    jobs={calendarJobs}
                    loading={calendarQuery.isLoading || calendarQuery.isFetching}
                    truncated={calendarTruncated}
                    statusLabel={jobStatusLabel}
                  />
                )}
              </div>
            ) : (
              <div
                className={cn(
                  "grid grid-cols-1 gap-4 sm:grid-cols-2",
                  visibleColumns.length >= 6
                    ? "xl:grid-cols-3 2xl:grid-cols-6"
                    : visibleColumns.length >= 3
                      ? "xl:grid-cols-3"
                      : "xl:grid-cols-1",
                )}
              >
                {visibleColumns.map((col) => (
                  <JobColumn
                    key={col.status}
                    status={col.status}
                    label={col.label}
                    search={debouncedSearch || undefined}
                    assignee={savedAssignee}
                    overdue={savedOverdue}
                    completedScope={completedScope}
                  />
                ))}
              </div>
            )}
          </div>
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
              <CustomerAdditionalFieldsEditor
                value={form.additionalFields}
                onChange={(additionalFields) => setForm({ ...form, additionalFields })}
                title="Additional registration fields"
                description="Optional custom fields (site contact, accessories, PO reference, etc.)."
              />
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
