import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

/** Working list: open items stay. A converted, lost, or rejected record stays for 2 days, then drops off activity. */
export function isInActivity(status: string, updatedAt: string | null | undefined, finishedStatuses: string[]) {
  if (!finishedStatuses.includes(status)) return true;
  const at = updatedAt ? new Date(updatedAt).getTime() : 0;
  if (!Number.isFinite(at) || at <= 0) return true;
  return Date.now() - at < TWO_DAYS_MS;
}

export function SalesPipelineTabs({ current }: { current: "enquiry" | "quotation" }) {
  const tabs = [
    { key: "enquiry" as const, label: "Enquiry", to: "/app/sales-enquiries" },
    { key: "quotation" as const, label: "Quotation", to: "/app/sales/quotations" },
  ];
  return (
    <div className="inline-flex rounded-lg border bg-muted/40 p-1">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          to={tab.to}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            current === tab.key
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

export function ActivityHistoryTabs({
  value,
  onChange,
  activityLabel,
}: {
  value: "activity" | "history";
  onChange: (next: "activity" | "history") => void;
  activityLabel: string;
}) {
  const tabs = [
    { key: "activity" as const, label: activityLabel },
    { key: "history" as const, label: "History" },
  ];
  return (
    <div className="inline-flex rounded-lg border bg-muted/40 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            value === tab.key
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
