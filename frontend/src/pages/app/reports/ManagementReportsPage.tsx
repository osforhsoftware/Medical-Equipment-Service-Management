import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, FileCheck, UserCheck } from "lucide-react";
import { ReportCategoryLayout } from "@/components/reports/ReportCategoryLayout";
import { ReportSection } from "@/components/reports/ReportSection";
import { ReportTable } from "@/components/reports/ReportTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useReportFilters } from "@/hooks/useReportFilters";
import { ApiError, api, type BackendEstimate } from "@/lib/api";
import { getReportCategory } from "@/lib/reportCategories";
import { exportActivityRows, exportReportRows } from "@/lib/reportExport";
import { formatCurrency, formatCurrencyShort, formatDate, formatJobStatus } from "@/lib/format";
import {
  CLOSED_TICKET_STATUSES,
  OPEN_JOB_STATUSES,
  isInDateRange,
  matchesQuery,
  type ReportActivityRow,
  type ReportExportRow,
} from "@/lib/reportUtils";

const category = getReportCategory("management")!;

export default function ManagementReportsPage() {
  const navigate = useNavigate();
  const { dateRange, search, setDateRange, setSearch } = useReportFilters();

  const jobsQuery = useQuery({
    queryKey: ["reports", "jobs"],
    queryFn: () => api.listJobs({ limit: 100, page: 1, completedScope: "all" }),
  });
  const ticketsQuery = useQuery({
    queryKey: ["reports", "tickets"],
    queryFn: () => api.listServiceRequests({ limit: 100, page: 1, completedScope: "all" }),
  });
  const estimatesQuery = useQuery({
    queryKey: ["reports", "estimates"],
    queryFn: async () => {
      try {
        return await api.listEstimates({ limit: 100, page: 1 });
      } catch {
        return { data: [] as BackendEstimate[] };
      }
    },
  });
  const dashboardQuery = useQuery({
    queryKey: ["dashboard", dateRange.from, dateRange.to],
    queryFn: () => api.getDashboard({ from: dateRange.from, to: dateRange.to }),
  });

  const jobs = jobsQuery.data?.data ?? [];
  const tickets = ticketsQuery.data?.data ?? [];
  const estimates = estimatesQuery.data?.data ?? [];
  const dashboard = dashboardQuery.data;

  const jobsInRange = useMemo(
    () =>
      jobs.filter(
        (job) =>
          isInDateRange(job.createdAt, dateRange.from, dateRange.to) &&
          matchesQuery(search, job.reference, job.engineer, job.customerName, job.status),
      ),
    [jobs, dateRange, search],
  );

  const technicianRows = useMemo(() => {
    const groups = new Map<
      string,
      { id: string; name: string; open: number; completed: number; minutes: number }
    >();
    for (const job of jobsInRange) {
      const name = job.engineer?.trim() || "Unassigned";
      const current = groups.get(name) ?? { id: name, name, open: 0, completed: 0, minutes: 0 };
      if (job.status === "completed") current.completed += 1;
      if (OPEN_JOB_STATUSES.has(job.status)) current.open += 1;
      current.minutes += (job.workLogs ?? []).reduce((sum, log) => sum + (log.minutes || 0), 0);
      groups.set(name, current);
    }
    return [...groups.values()].sort((a, b) => b.completed - a.completed || b.open - a.open);
  }, [jobsInRange]);

  const slaRows = useMemo(() => {
    return tickets
      .filter((ticket) => isInDateRange(ticket.createdAt, dateRange.from, dateRange.to))
      .filter((ticket) => matchesQuery(search, ticket.reference, ticket.customerName, ticket.status))
      .map((ticket) => {
        const due = new Date(ticket.slaDue).getTime();
        const done = ticket.completedAt ? new Date(ticket.completedAt).getTime() : Date.now();
        const closed = CLOSED_TICKET_STATUSES.has(ticket.status);
        const onTime = !Number.isFinite(due) || done <= due;
        const overdue = !closed && Number.isFinite(due) && Date.now() > due;
        return {
          id: ticket.id,
          reference: ticket.reference,
          customerName: ticket.customerName,
          status: ticket.status,
          slaDue: ticket.slaDue,
          result: overdue ? "Overdue" : closed ? (onTime ? "On time" : "Late") : onTime ? "On track" : "At risk",
        };
      });
  }, [tickets, dateRange, search]);

  const slaOnTime = slaRows.filter((row) => row.result === "On time" || row.result === "On track").length;
  const slaRate = slaRows.length ? Math.round((slaOnTime / slaRows.length) * 100) : 0;

  const approvalRows = useMemo(() => {
    return estimates
      .filter((estimate) => isInDateRange(estimate.createdAt, dateRange.from, dateRange.to))
      .filter((estimate) => matchesQuery(search, estimate.reference, estimate.customerName, estimate.status))
      .map((estimate) => ({
        id: estimate.id,
        reference: estimate.reference,
        customerName: estimate.customerName,
        status: estimate.status,
        total: Number(estimate.total) || 0,
        decided: Boolean(estimate.approvedAt) || ["approved", "rejected"].includes(estimate.status),
        approved: estimate.status === "approved" || Boolean(estimate.approvedAt),
      }));
  }, [estimates, dateRange, search]);

  const approvalRate = approvalRows.length
    ? Math.round((approvalRows.filter((row) => row.approved).length / approvalRows.length) * 100)
    : 0;

  const qaRows = useMemo(() => {
    return jobs
      .filter((job) => isInDateRange(job.updatedAt, dateRange.from, dateRange.to))
      .filter((job) => matchesQuery(search, job.reference, job.engineer, job.customerName))
      .map((job) => {
        const result = job.stageDetails?.qa?.result;
        return {
          id: job.id,
          reference: job.reference,
          engineer: job.engineer || "—",
          equipmentName: job.equipmentName,
          status: job.status,
          result: result === "pass" ? "Pass" : result === "fail" ? "Fail" : "Pending",
        };
      });
  }, [jobs, dateRange, search]);

  const qaReviewed = qaRows.filter((row) => row.result !== "Pending");
  const successRate = qaReviewed.length
    ? Math.round((qaReviewed.filter((row) => row.result === "Pass").length / qaReviewed.length) * 100)
    : 0;

  const kpiRows = [
    { id: "open-jobs", name: "Open jobs", quantity: dashboard?.stats.activeJobs ?? jobs.filter((job) => OPEN_JOB_STATUSES.has(job.status)).length, amount: 0 },
    { id: "open-tickets", name: "Open tickets", quantity: dashboard?.stats.openRequests ?? 0, amount: 0 },
    { id: "pending-estimates", name: "Pending estimates", quantity: dashboard?.stats.pendingEstimates ?? 0, amount: 0 },
    { id: "pending-invoices", name: "Pending invoices", quantity: dashboard?.stats.pendingInvoices ?? 0, amount: 0 },
    { id: "overdue-invoices", name: "Overdue invoices", quantity: dashboard?.stats.overdueInvoices ?? 0, amount: 0 },
    { id: "revenue", name: "Collected in range", quantity: 1, amount: dashboard?.period?.totals.revenue ?? 0 },
    { id: "jobs-range", name: "Jobs in range", quantity: dashboard?.period?.totals.jobs ?? jobsInRange.length, amount: 0 },
    { id: "sla", name: "SLA on track", quantity: `${slaRate}%`, amount: 0 },
    { id: "approval", name: "Approval conversion", quantity: `${approvalRate}%`, amount: 0 },
    { id: "qa", name: "Repair success", quantity: `${successRate}%`, amount: 0 },
  ];

  const activity = useMemo<ReportActivityRow[]>(() => {
    const fromJobs = jobsInRange.map((job) => ({
      id: `job-${job.id}`,
      at: job.updatedAt,
      actor: job.engineer || "System",
      action: `Job ${formatJobStatus(job.status)}`,
      reference: job.reference,
    }));
    const fromEstimates = approvalRows.map((row) => ({
      id: `est-${row.id}`,
      at: estimates.find((estimate) => estimate.id === row.id)?.updatedAt ?? dateRange.to,
      actor: row.customerName,
      action: `Estimate ${row.status}`,
      reference: row.reference,
    }));
    const fromDashboard = (dashboard?.recentActivity ?? []).map((row) => ({
      id: row.id,
      at: row.at,
      actor: row.actor,
      action: row.action,
      reference: "Dashboard",
    }));
    return [...fromJobs, ...fromEstimates, ...fromDashboard].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 80);
  }, [jobsInRange, approvalRows, estimates, dashboard, dateRange.to]);

  const exportRows = useMemo<ReportExportRow[]>(() => {
    return [
      ...technicianRows.map((row) => ({
        section: "Technician productivity",
        name: row.name,
        quantity: row.completed,
        amount: row.minutes,
        extra: `${row.open} open`,
      })),
      ...slaRows.map((row) => ({
        section: "SLA compliance",
        name: `${row.reference} · ${row.customerName}`,
        quantity: row.result,
        amount: 0,
        extra: row.status,
      })),
      ...approvalRows.map((row) => ({
        section: "Approval conversion",
        name: `${row.reference} · ${row.customerName}`,
        quantity: row.status,
        amount: row.total,
      })),
      ...qaRows.map((row) => ({
        section: "Repair success rate",
        name: `${row.reference} · ${row.equipmentName}`,
        quantity: row.result,
        amount: 0,
        extra: row.engineer,
      })),
      ...kpiRows.map((row) => ({
        section: "Business KPIs",
        name: row.name,
        quantity: row.quantity,
        amount: row.amount,
      })),
    ];
  }, [technicianRows, slaRows, approvalRows, qaRows, kpiRows]);

  const loading = jobsQuery.isLoading || ticketsQuery.isLoading || estimatesQuery.isLoading || dashboardQuery.isLoading;
  const firstError = jobsQuery.error || ticketsQuery.error || dashboardQuery.error;
  const error = firstError
    ? firstError instanceof ApiError
      ? firstError.message
      : "Unable to load management reports"
    : null;

  return (
    <ReportCategoryLayout
      category={category}
      dateRange={dateRange}
      onDateRangeChange={setDateRange}
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search technician, ticket, estimate, customer…"
      kpis={[
        { label: "SLA on track", value: `${slaRate}%`, icon: Clock, accent: slaRate >= 80 ? "success" : "warning" },
        { label: "Approval conversion", value: `${approvalRate}%`, icon: FileCheck },
        { label: "Repair success", value: `${successRate}%`, icon: CheckCircle2, accent: "success" },
        { label: "Technicians", value: String(technicianRows.length), icon: UserCheck },
      ]}
      loading={loading}
      error={error}
      onExportAll={() => exportReportRows("management-reports-all", exportRows)}
      onExportActivity={() => exportActivityRows("management-reports-activity", activity)}
    >
      <div className="space-y-6">
        <ReportSection
          id="technician-productivity"
          title="Technician productivity"
          description="Jobs created in the selected period, grouped by assigned engineer."
          count={technicianRows.length}
          onExport={() =>
            exportReportRows(
              "management-technician-productivity",
              technicianRows.map((row) => ({
                section: "Technician productivity",
                name: row.name,
                quantity: row.completed,
                amount: row.minutes,
                extra: `${row.open} open`,
              })),
            )
          }
        >
          <ReportTable
            rows={technicianRows}
            columns={[
              { key: "name", header: "Technician", render: (row) => row.name },
              { key: "open", header: "Open", className: "text-right", render: (row) => row.open },
              { key: "completed", header: "Completed", className: "text-right", render: (row) => row.completed },
              { key: "hours", header: "Logged hours", className: "text-right", render: (row) => (row.minutes / 60).toFixed(1) },
            ]}
          />
        </ReportSection>

        <ReportSection
          id="sla-compliance"
          title="SLA compliance"
          description="Tickets created in the selected period, measured against SLA due date."
          count={slaRows.length}
          onExport={() =>
            exportReportRows(
              "management-sla-compliance",
              slaRows.map((row) => ({
                section: "SLA compliance",
                name: `${row.reference} · ${row.customerName}`,
                quantity: row.result,
                amount: 0,
                extra: row.status,
              })),
            )
          }
        >
          <ReportTable
            rows={slaRows}
            onRowClick={(row) => navigate(`/app/service-tickets/${row.id}`)}
            columns={[
              { key: "reference", header: "Ticket", render: (row) => row.reference },
              { key: "customer", header: "Customer", render: (row) => row.customerName },
              { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
              { key: "due", header: "SLA due", render: (row) => formatDate(row.slaDue) },
              { key: "result", header: "Result", render: (row) => row.result },
            ]}
          />
        </ReportSection>

        <ReportSection
          id="approval-conversion"
          title="Approval conversion"
          description="Estimates created in the selected period and whether they were approved."
          count={approvalRows.length}
          onExport={() =>
            exportReportRows(
              "management-approval-conversion",
              approvalRows.map((row) => ({
                section: "Approval conversion",
                name: `${row.reference} · ${row.customerName}`,
                quantity: row.status,
                amount: row.total,
              })),
            )
          }
        >
          <ReportTable
            rows={approvalRows}
            onRowClick={(row) => navigate(`/app/estimates/${row.id}`)}
            columns={[
              { key: "reference", header: "Estimate", render: (row) => row.reference },
              { key: "customer", header: "Customer", render: (row) => row.customerName },
              { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
              { key: "total", header: "Total", className: "text-right", render: (row) => formatCurrency(row.total) },
              { key: "approved", header: "Approved", render: (row) => (row.approved ? "Yes" : "No") },
            ]}
          />
        </ReportSection>

        <ReportSection
          id="repair-success-rate"
          title="Repair success rate"
          description="QA result on jobs updated in the selected period."
          count={qaRows.length}
          onExport={() =>
            exportReportRows(
              "management-repair-success",
              qaRows.map((row) => ({
                section: "Repair success rate",
                name: `${row.reference} · ${row.equipmentName}`,
                quantity: row.result,
                amount: 0,
                extra: row.engineer,
              })),
            )
          }
        >
          <ReportTable
            rows={qaRows}
            onRowClick={(row) => navigate(`/app/jobs/${row.id}`)}
            columns={[
              { key: "reference", header: "Job", render: (row) => row.reference },
              { key: "equipment", header: "Equipment", render: (row) => row.equipmentName },
              { key: "engineer", header: "Engineer", render: (row) => row.engineer },
              { key: "result", header: "QA", render: (row) => row.result },
              { key: "status", header: "Status", render: (row) => <StatusBadge status={formatJobStatus(row.status)} /> },
            ]}
          />
        </ReportSection>

        <ReportSection
          id="business-kpis"
          title="Business KPIs"
          description="Headline operations and finance totals for the selected period."
          count={kpiRows.length}
          onExport={() =>
            exportReportRows(
              "management-business-kpis",
              kpiRows.map((row) => ({
                section: "Business KPIs",
                name: row.name,
                quantity: row.quantity,
                amount: row.amount,
              })),
            )
          }
        >
          <ReportTable
            rows={kpiRows}
            columns={[
              { key: "name", header: "KPI", render: (row) => row.name },
              { key: "quantity", header: "Value", className: "text-right", render: (row) => String(row.quantity) },
              {
                key: "amount",
                header: "Amount",
                className: "text-right",
                render: (row) => (row.amount ? formatCurrencyShort(Number(row.amount)) : "—"),
              },
            ]}
          />
        </ReportSection>

        <ReportSection
          id="activity"
          title="Activity"
          description="Job, estimate, and dashboard activity for the current filters."
          count={activity.length}
          onExport={() => exportActivityRows("management-reports-activity", activity)}
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
      </div>
    </ReportCategoryLayout>
  );
}
