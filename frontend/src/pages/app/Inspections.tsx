import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { InspectionCard } from "@/components/inspections/InspectionCard";
import { InspectionReportPanel } from "@/components/inspections/InspectionReportPanel";
import { useInspectionReportEditor } from "@/components/inspections/useInspectionReportEditor";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { useIsMobile } from "@/hooks/use-mobile";
import { api, type BackendServiceRequest } from "@/lib/api";
import { formatServiceStatus } from "@/lib/format";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "new" | "inspection" | "estimate";
type SeverityFilter = "all" | "low" | "medium" | "high" | "critical";
type SummaryKey = "awaiting" | "inInspection" | "reportsFiled" | "critical";

function equipmentLabel(task: BackendServiceRequest) {
  if (task.equipmentItems?.length) {
    return task.equipmentItems.map((e) => e.equipmentName).join(", ");
  }
  return task.equipmentName ?? "";
}

export default function Inspections() {
  const isMobile = useIsMobile();
  const [requests, setRequests] = useState<BackendServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [summaryFilter, setSummaryFilter] = useState<SummaryKey | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const result = await api.listServiceRequests({
        statuses: "new,inspection,estimate",
        limit: 100,
        page: 1,
      });
      setRequests(result.data);
    } catch (err) {
      setLoadError(true);
      toast.apiError(err, { fallback: "Failed to load inspections" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const assignees = useMemo(() => {
    const names = new Set<string>();
    for (const r of requests) {
      if (r.assignedName?.trim()) names.add(r.assignedName.trim());
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [requests]);

  const stats = useMemo(() => {
    const awaiting = requests.filter((r) => formatServiceStatus(r.status) === "new").length;
    const inInspection = requests.filter((r) => formatServiceStatus(r.status) === "inspection").length;
    const reportsFiled = requests.filter((r) => Boolean(r.inspectionReport)).length;
    const critical = requests.filter((r) => r.inspectionReport?.severity === "critical" || r.priority === "critical").length;
    return { awaiting, inInspection, reportsFiled, critical };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((r) => {
      const status = formatServiceStatus(r.status);

      if (summaryFilter === "awaiting" && status !== "new") return false;
      if (summaryFilter === "inInspection" && status !== "inspection") return false;
      if (summaryFilter === "reportsFiled" && !r.inspectionReport) return false;
      if (summaryFilter === "critical" && !(r.inspectionReport?.severity === "critical" || r.priority === "critical")) {
        return false;
      }

      if (statusFilter !== "all" && status !== statusFilter) return false;

      if (severityFilter !== "all") {
        const sev = r.inspectionReport?.severity;
        if (sev !== severityFilter) return false;
      }

      if (assigneeFilter !== "all") {
        if ((r.assignedName ?? "").trim() !== assigneeFilter) return false;
      }

      if (!q) return true;
      const haystack = [
        r.reference,
        r.customerName,
        r.description,
        r.assignedName ?? "",
        equipmentLabel(r),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [requests, search, statusFilter, severityFilter, assigneeFilter, summaryFilter]);

  const awaitingCount = stats.awaiting + stats.inInspection;
  const editor = useInspectionReportEditor(loadRequests);

  const toggleSummary = (key: SummaryKey) => {
    setSummaryFilter((prev) => (prev === key ? null : key));
  };

  const summaryItems: { key: SummaryKey; label: string; value: number }[] = [
    { key: "awaiting", label: "Awaiting", value: stats.awaiting },
    { key: "inInspection", label: "In Inspection", value: stats.inInspection },
    { key: "reportsFiled", label: "Reports Filed", value: stats.reportsFiled },
    { key: "critical", label: "Critical", value: stats.critical },
  ];

  return (
    <RoleGuard roles={["admin", "coordinator", "inspector"]}>
      <div className={cn("space-y-5", isMobile && "mobile-page space-y-4")}>
        {!isMobile ? (
          <PageHeader
            title="Inspections"
            description="Findings, severity, and inspection reports."
            actions={
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {awaitingCount} awaiting inspection
                </p>
                <p className="text-xs text-muted-foreground">Queue · new & in inspection</p>
              </div>
            }
          />
        ) : (
          <div className="pt-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="page-title">Inspections</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Capture findings and assess severity.
                </p>
              </div>
              {!loading ? (
                <span className="shrink-0 rounded-full border border-border/60 bg-card px-2.5 py-1 text-xs font-semibold tabular-nums text-foreground">
                  {awaitingCount}
                </span>
              ) : null}
            </div>
          </div>
        )}

        {!loading && !loadError ? (
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
            {summaryItems.map((item) => {
              const activeSummary = summaryFilter === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => toggleSummary(item.key)}
                  className={cn(
                    "rounded-md border px-2.5 py-1.5 text-left transition-colors duration-150",
                    activeSummary
                      ? "border-primary/25 bg-primary-light"
                      : "border-border bg-card hover:bg-muted/50",
                  )}
                >
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-0.5 text-base font-semibold tabular-nums text-foreground sm:text-lg">{item.value}</p>
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search equipment, customer, reference…"
              className={cn("pl-9", isMobile && "h-12 rounded-xl")}
              aria-label="Search inspections"
            />
          </div>

          {isMobile ? (
            <Button
              type="button"
              variant="outline"
              className="h-12 rounded-xl"
              onClick={() => setFiltersOpen((o) => !o)}
            >
              Filters
            </Button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger className="w-[140px]" aria-label="Filter by status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="inspection">Inspection</SelectItem>
                  <SelectItem value="estimate">Estimate</SelectItem>
                </SelectContent>
              </Select>
              <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as SeverityFilter)}>
                <SelectTrigger className="w-[140px]" aria-label="Filter by severity">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All severity</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
              <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                <SelectTrigger className="w-[160px]" aria-label="Filter by assignee">
                  <SelectValue placeholder="Assigned to" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All assignees</SelectItem>
                  {assignees.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {isMobile && filtersOpen ? (
          <div className="grid gap-2 rounded-xl border border-border/60 bg-card/70 p-3">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="h-11 rounded-xl" aria-label="Filter by status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="inspection">Inspection</SelectItem>
                <SelectItem value="estimate">Estimate</SelectItem>
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as SeverityFilter)}>
              <SelectTrigger className="h-11 rounded-xl" aria-label="Filter by severity">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All severity</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="h-11 rounded-xl" aria-label="Filter by assignee">
                <SelectValue placeholder="Assigned to" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All assignees</SelectItem>
                {assignees.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {loading ? (
          <div className={cn("grid gap-3", !isMobile && "md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4")}>
            {Array.from({ length: isMobile ? 3 : 6 }).map((_, i) => (
              <div key={i} className="space-y-2 rounded-lg border border-border/60 bg-card p-3">
                <div className="flex justify-between gap-3">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-14 rounded-full" />
                </div>
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div className="rounded-xl border border-border/60 bg-card px-6 py-12 text-center">
            <p className="text-sm font-medium text-foreground">Unable to load inspections</p>
            <p className="mt-1 text-sm text-muted-foreground">Check your connection and try again.</p>
            <Button type="button" variant="outline" className="mt-4" onClick={() => void loadRequests()}>
              <RefreshCw className="mr-1.5 h-4 w-4" />
              Retry
            </Button>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-card px-6 py-12 text-center">
            <p className="text-sm font-medium text-foreground">
              {requests.length === 0
                ? "No requests awaiting inspection"
                : "No inspections match your filters"}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              {requests.length === 0
                ? "All inspection requests have been handled. New requests will appear here when they are ready."
                : "Try adjusting search or filters to see more results."}
            </p>
            <Button type="button" variant="outline" className="mt-4" onClick={() => void loadRequests()}>
              <RefreshCw className="mr-1.5 h-4 w-4" />
              Refresh
            </Button>
          </div>
        ) : (
          <div className={cn("grid gap-3", !isMobile && "md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4")}>
            {filteredRequests.map((task) => (
              <InspectionCard
                key={task.id}
                task={task}
                mobile={isMobile}
                onInspect={(t) => void editor.startInspection(t)}
              />
            ))}
          </div>
        )}
      </div>

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
        machineImages={editor.machineImages}
        setMachineImages={editor.setMachineImages}
        setMachineImage={editor.setMachineImage}
        imageCaptions={editor.imageCaptions}
        setImageCaptions={editor.setImageCaptions}
        newImagePreviews={editor.newImagePreviews}
      />
    </RoleGuard>
  );
}
