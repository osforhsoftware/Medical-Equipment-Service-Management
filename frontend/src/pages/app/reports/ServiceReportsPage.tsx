import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Clock, Repeat, ShieldAlert, Wrench } from "lucide-react";
import { ReportCategoryLayout } from "@/components/reports/ReportCategoryLayout";
import { ReportSection } from "@/components/reports/ReportSection";
import { ReportTable } from "@/components/reports/ReportTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useReportFilters } from "@/hooks/useReportFilters";
import { ApiError, api } from "@/lib/api";
import { getReportCategory } from "@/lib/reportCategories";
import { exportActivityRows, exportReportRows } from "@/lib/reportExport";
import { formatCurrency, formatDate, formatJobStatus } from "@/lib/format";
import {
  CLOSED_TICKET_STATUSES,
  OPEN_JOB_STATUSES,
  daysBetween,
  isInDateRange,
  matchesQuery,
  type ReportActivityRow,
  type ReportExportRow,
} from "@/lib/reportUtils";
import type { WarrantyClaimData } from "@/pages/app/WarrantyClaims";

const category = getReportCategory("service")!;

export default function ServiceReportsPage() {
  const navigate = useNavigate();
  const { dateRange, search, status, setDateRange, setSearch, setStatus } = useReportFilters();

  const jobsQuery = useQuery({
    queryKey: ["reports", "jobs"],
    queryFn: () => api.listJobs({ limit: 100, page: 1, completedScope: "all" }),
  });
  const ticketsQuery = useQuery({
    queryKey: ["reports", "tickets"],
    queryFn: () => api.listServiceRequests({ limit: 100, page: 1, completedScope: "all" }),
  });
  const claimsQuery = useQuery({
    queryKey: ["warranty-claims"],
    queryFn: async () => (await api.get<WarrantyClaimData[]>("/warranty-claims")).data,
  });
  const dashboardQuery = useQuery({
    queryKey: ["dashboard", dateRange.from, dateRange.to],
    queryFn: () => api.getDashboard({ from: dateRange.from, to: dateRange.to }),
  });

  const jobs = jobsQuery.data?.data ?? [];
  const tickets = ticketsQuery.data?.data ?? [];
  const claims = claimsQuery.data ?? [];

  const openJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (!OPEN_JOB_STATUSES.has(job.status)) return false;
      if (status !== "all" && status !== "open" && job.status !== status) return false;
      return matchesQuery(search, job.reference, job.customerName, job.equipmentName, job.engineer, job.status);
    });
  }, [jobs, search, status]);

  const completedInRange = useMemo(() => {
    return jobs.filter((job) => {
      if (job.status !== "completed") return false;
      if (!isInDateRange(job.updatedAt, dateRange.from, dateRange.to)) return false;
      return matchesQuery(search, job.reference, job.customerName, job.equipmentName, job.engineer);
    });
  }, [jobs, dateRange, search]);

  const turnaroundRows = useMemo(
    () =>
      completedInRange.map((job) => ({
        id: job.id,
        reference: job.reference,
        customerName: job.customerName,
        equipmentName: job.equipmentName,
        engineer: job.engineer,
        days: daysBetween(job.createdAt, job.updatedAt),
        completedAt: job.updatedAt,
      })),
    [completedInRange],
  );

  const repeatRepairs = useMemo(() => {
    const scoped = jobs.filter(
      (job) =>
        isInDateRange(job.createdAt, dateRange.from, dateRange.to) &&
        matchesQuery(search, job.reference, job.customerName, job.equipmentName),
    );
    const groups = new Map<string, { id: string; name: string; customerName: string; count: number; lastAt: string }>();
    for (const job of scoped) {
      const key = job.equipmentId || job.equipmentName || job.id;
      const existing = groups.get(key);
      if (existing) {
        existing.count += 1;
        if (job.updatedAt > existing.lastAt) existing.lastAt = job.updatedAt;
      } else {
        groups.set(key, {
          id: key,
          name: job.equipmentName || "Unknown equipment",
          customerName: job.customerName,
          count: 1,
          lastAt: job.updatedAt,
        });
      }
    }
    return [...groups.values()].filter((row) => row.count > 1).sort((a, b) => b.count - a.count);
  }, [jobs, dateRange, search]);

  const warrantyRows = useMemo(() => {
    return claims.filter((claim) => {
      if (!isInDateRange(claim.createdAt, dateRange.from, dateRange.to)) return false;
      if (status === "open" && (claim.status === "approved" || claim.status === "rejected")) return false;
      return matchesQuery(search, claim.reference, claim.customerName, claim.equipmentName, claim.status);
    });
  }, [claims, dateRange, search, status]);

  const activity = useMemo<ReportActivityRow[]>(() => {
    const fromJobs: ReportActivityRow[] = jobs
      .filter((job) => isInDateRange(job.updatedAt, dateRange.from, dateRange.to))
      .filter((job) => matchesQuery(search, job.reference, job.customerName, job.engineer, job.status))
      .map((job) => ({
        id: `job-${job.id}`,
        at: job.updatedAt,
        actor: job.engineer || "System",
        action: `Job ${formatJobStatus(job.status)}`,
        reference: job.reference,
      }));
    const fromTickets: ReportActivityRow[] = tickets
      .filter((ticket) => isInDateRange(ticket.updatedAt, dateRange.from, dateRange.to))
      .filter((ticket) => matchesQuery(search, ticket.reference, ticket.customerName, ticket.status))
      .map((ticket) => ({
        id: `ticket-${ticket.id}`,
        at: ticket.updatedAt,
        actor: ticket.assignedName || ticket.createdBy,
        action: `Ticket ${ticket.status.replace(/_/g, " ")}`,
        reference: ticket.reference,
      }));
    const fromDashboard = (dashboardQuery.data?.recentActivity ?? []).map((row) => ({
      id: row.id,
      at: row.at,
      actor: row.actor,
      action: row.action,
      reference: "Dashboard",
    }));
    return [...fromJobs, ...fromTickets, ...fromDashboard]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 80);
  }, [jobs, tickets, dashboardQuery.data, dateRange, search]);

  const avgTurnaround =
    turnaroundRows.length === 0
      ? 0
      : Math.round(turnaroundRows.reduce((sum, row) => sum + row.days, 0) / turnaroundRows.length);

  const exportRows = useMemo<ReportExportRow[]>(() => {
    return [
      ...openJobs.map((job) => ({
        section: "Open jobs",
        name: `${job.reference} · ${job.equipmentName}`,
        quantity: formatJobStatus(job.status),
        amount: job.progress,
        extra: job.engineer,
      })),
      ...turnaroundRows.map((row) => ({
        section: "Turnaround time",
        name: `${row.reference} · ${row.equipmentName}`,
        quantity: row.days,
        amount: 0,
        extra: row.engineer,
      })),
      ...completedInRange.map((job) => ({
        section: "Repair history",
        name: `${job.reference} · ${job.equipmentName}`,
        quantity: 1,
        amount: 0,
        extra: job.engineer,
      })),
      ...repeatRepairs.map((row) => ({
        section: "Repeat repairs",
        name: row.name,
        quantity: row.count,
        amount: 0,
        extra: row.customerName,
      })),
      ...warrantyRows.map((claim) => ({
        section: "Warranty cases",
        name: `${claim.reference} · ${claim.equipmentName}`,
        quantity: claim.status,
        amount: 0,
        extra: claim.customerName,
      })),
    ];
  }, [openJobs, turnaroundRows, completedInRange, repeatRepairs, warrantyRows]);

  const loading = jobsQuery.isLoading || ticketsQuery.isLoading || claimsQuery.isLoading;
  const error =
    jobsQuery.error || ticketsQuery.error || claimsQuery.error
      ? jobsQuery.error instanceof ApiError
        ? jobsQuery.error.message
        : "Unable to load service reports"
      : null;

  return (
    <ReportCategoryLayout
      category={category}
      dateRange={dateRange}
      onDateRangeChange={setDateRange}
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search job, ticket, customer, equipment…"
      extraFilters={
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-full sm:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="open">Open only</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="inProgress">In progress</SelectItem>
            <SelectItem value="partsPending">Parts pending</SelectItem>
            <SelectItem value="review">QA review</SelectItem>
          </SelectContent>
        </Select>
      }
      kpis={[
        { label: "Open jobs", value: String(openJobs.length), icon: Wrench },
        { label: "Avg turnaround", value: `${avgTurnaround} days`, icon: Clock },
        { label: "Repeat repairs", value: String(repeatRepairs.length), icon: Repeat, accent: "warning" },
        { label: "Warranty cases", value: String(warrantyRows.length), icon: ShieldAlert },
      ]}
      loading={loading}
      error={error}
      onExportAll={() => exportReportRows("service-reports-all", exportRows)}
      onExportActivity={() => exportActivityRows("service-reports-activity", activity)}
    >
      <div className="space-y-6">
        <ReportSection
          id="open-jobs"
          title="Open jobs"
          description="Live open jobs. Status filter applies here; date range does not hide currently open work."
          count={openJobs.length}
          onExport={() =>
            exportReportRows(
              "service-open-jobs",
              openJobs.map((job) => ({
                section: "Open jobs",
                name: `${job.reference} · ${job.equipmentName}`,
                quantity: formatJobStatus(job.status),
                amount: job.progress,
                extra: job.engineer,
              })),
            )
          }
        >
          <ReportTable
            rows={openJobs}
            onRowClick={(job) => navigate(`/app/jobs/${job.id}`)}
            columns={[
              { key: "reference", header: "Job", render: (job) => job.reference },
              { key: "customer", header: "Customer", render: (job) => job.customerName },
              { key: "equipment", header: "Equipment", render: (job) => job.equipmentName },
              { key: "engineer", header: "Engineer", render: (job) => job.engineer || "—" },
              {
                key: "status",
                header: "Status",
                render: (job) => <StatusBadge status={formatJobStatus(job.status)} />,
              },
              { key: "scheduled", header: "Scheduled", render: (job) => formatDate(job.scheduledFor) },
            ]}
          />
        </ReportSection>

        <ReportSection
          id="turnaround-time"
          title="Turnaround time"
          description="Completed jobs in the selected period, from create date to last update."
          count={turnaroundRows.length}
          onExport={() =>
            exportReportRows(
              "service-turnaround",
              turnaroundRows.map((row) => ({
                section: "Turnaround time",
                name: `${row.reference} · ${row.equipmentName}`,
                quantity: row.days,
                amount: 0,
                extra: `${row.days} days`,
              })),
            )
          }
        >
          <ReportTable
            rows={turnaroundRows}
            onRowClick={(row) => navigate(`/app/jobs/${row.id}`)}
            columns={[
              { key: "reference", header: "Job", render: (row) => row.reference },
              { key: "customer", header: "Customer", render: (row) => row.customerName },
              { key: "equipment", header: "Equipment", render: (row) => row.equipmentName },
              { key: "days", header: "Days", className: "text-right", render: (row) => `${row.days} days` },
              { key: "completed", header: "Completed", render: (row) => formatDate(row.completedAt) },
            ]}
          />
        </ReportSection>

        <ReportSection
          id="repair-history"
          title="Repair history"
          description="Completed jobs in the selected period."
          count={completedInRange.length}
          onExport={() =>
            exportReportRows(
              "service-repair-history",
              completedInRange.map((job) => ({
                section: "Repair history",
                name: `${job.reference} · ${job.equipmentName}`,
                quantity: 1,
                amount: 0,
                extra: job.engineer,
              })),
            )
          }
        >
          <ReportTable
            rows={completedInRange}
            onRowClick={(job) => navigate(`/app/jobs/${job.id}`)}
            columns={[
              { key: "reference", header: "Job", render: (job) => job.reference },
              { key: "customer", header: "Customer", render: (job) => job.customerName },
              { key: "equipment", header: "Equipment", render: (job) => job.equipmentName },
              { key: "engineer", header: "Engineer", render: (job) => job.engineer || "—" },
              { key: "completed", header: "Completed", render: (job) => formatDate(job.updatedAt) },
            ]}
          />
        </ReportSection>

        <ReportSection
          id="repeat-repairs"
          title="Repeat repairs"
          description="Equipment with more than one job created in the selected period."
          count={repeatRepairs.length}
          onExport={() =>
            exportReportRows(
              "service-repeat-repairs",
              repeatRepairs.map((row) => ({
                section: "Repeat repairs",
                name: row.name,
                quantity: row.count,
                amount: 0,
                extra: row.customerName,
              })),
            )
          }
        >
          <ReportTable
            rows={repeatRepairs}
            columns={[
              { key: "name", header: "Equipment", render: (row) => row.name },
              { key: "customer", header: "Customer", render: (row) => row.customerName },
              { key: "count", header: "Jobs", className: "text-right", render: (row) => row.count },
              { key: "last", header: "Last activity", render: (row) => formatDate(row.lastAt) },
            ]}
          />
        </ReportSection>

        <ReportSection
          id="warranty-cases"
          title="Warranty cases"
          description="Warranty claims created in the selected period."
          count={warrantyRows.length}
          onExport={() =>
            exportReportRows(
              "service-warranty-cases",
              warrantyRows.map((claim) => ({
                section: "Warranty cases",
                name: `${claim.reference} · ${claim.equipmentName}`,
                quantity: claim.status,
                amount: 0,
                extra: claim.customerName,
              })),
            )
          }
        >
          <ReportTable
            rows={warrantyRows}
            onRowClick={() => navigate("/app/warranty-claims")}
            columns={[
              { key: "reference", header: "Claim", render: (row) => row.reference },
              { key: "customer", header: "Customer", render: (row) => row.customerName },
              { key: "equipment", header: "Equipment", render: (row) => row.equipmentName },
              { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
              { key: "created", header: "Created", render: (row) => formatDate(row.createdAt) },
            ]}
          />
        </ReportSection>

        <ReportSection
          id="activity"
          title="Activity"
          description="Job and ticket updates that match the current filters."
          count={activity.length}
          onExport={() => exportActivityRows("service-reports-activity", activity)}
        >
          <ReportTable
            rows={activity}
            columns={[
              { key: "at", header: "Time", render: (row) => formatDate(row.at) },
              { key: "actor", header: "Actor", render: (row) => row.actor },
              { key: "action", header: "Action", render: (row) => row.action },
              { key: "reference", header: "Reference", render: (row) => row.reference },
            ]}
          />
        </ReportSection>

        <p className="text-xs text-muted-foreground">
          Open tickets in range: {tickets.filter((ticket) => !CLOSED_TICKET_STATUSES.has(ticket.status)).length}.
          Completed jobs shown are limited to the latest 100 jobs returned by the jobs API.
        </p>
      </div>
    </ReportCategoryLayout>
  );
}
