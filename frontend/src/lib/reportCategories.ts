export type ReportCategoryId = "service" | "financial" | "inventory" | "management";

export interface ReportDefinition {
  id: string;
  label: string;
}

export interface ReportCategory {
  id: ReportCategoryId;
  title: string;
  shortTitle: string;
  description: string;
  path: string;
  accentClass: string;
  barClass: string;
  reports: ReportDefinition[];
}

export const REPORT_PAGE_ROLES = ["admin", "billing", "coordinator"] as const;

export const REPORT_CATEGORIES: ReportCategory[] = [
  {
    id: "service",
    title: "Service Reports",
    shortTitle: "Service",
    description: "Open jobs, turnaround, repair history, repeats, and warranty cases.",
    path: "/app/reports/service",
    accentClass: "text-sky-700 dark:text-sky-300",
    barClass: "bg-sky-600",
    reports: [
      { id: "open-jobs", label: "Open jobs" },
      { id: "turnaround-time", label: "Turnaround time" },
      { id: "repair-history", label: "Repair history" },
      { id: "repeat-repairs", label: "Repeat repairs" },
      { id: "warranty-cases", label: "Warranty cases" },
    ],
  },
  {
    id: "financial",
    title: "Financial",
    shortTitle: "Financial",
    description: "Monthly revenue, service vs sales, margin, aging, VAT, and customer profitability.",
    path: "/app/reports/financial",
    accentClass: "text-emerald-700 dark:text-emerald-300",
    barClass: "bg-emerald-600",
    reports: [
      { id: "revenue-by-month", label: "Revenue by month" },
      { id: "service-vs-sales", label: "Service vs sales" },
      { id: "gross-margin", label: "Gross margin" },
      { id: "receivables-aging", label: "Receivables aging" },
      { id: "customer-profitability", label: "Customer profitability" },
      { id: "vat-output", label: "VAT / tax output" },
    ],
  },
  {
    id: "inventory",
    title: "Inventory",
    shortTitle: "Inventory",
    description: "Stock value, job consumption, movers, purchases, and reorder alerts.",
    path: "/app/reports/inventory",
    accentClass: "text-amber-700 dark:text-amber-300",
    barClass: "bg-amber-500",
    reports: [
      { id: "stock-valuation", label: "Stock valuation" },
      { id: "consumption-by-job", label: "Consumption by job" },
      { id: "fast-slow-movers", label: "Fast / slow movers" },
      { id: "purchase-history", label: "Purchase history" },
      { id: "reorder-report", label: "Reorder report" },
    ],
  },
  {
    id: "management",
    title: "Management",
    shortTitle: "Management",
    description: "Technician output, SLA, approvals, repair success, and business KPIs.",
    path: "/app/reports/management",
    accentClass: "text-teal-700 dark:text-teal-300",
    barClass: "bg-teal-600",
    reports: [
      { id: "technician-productivity", label: "Technician productivity" },
      { id: "sla-compliance", label: "SLA compliance" },
      { id: "approval-conversion", label: "Approval conversion" },
      { id: "repair-success-rate", label: "Repair success rate" },
      { id: "business-kpis", label: "Business KPIs" },
    ],
  },
];

export function getReportCategory(id: string): ReportCategory | undefined {
  return REPORT_CATEGORIES.find((category) => category.id === id);
}

export function reportHref(categoryPath: string, reportId: string) {
  return `${categoryPath}#${reportId}`;
}
