import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "destructive" | "info" | "muted" | "accent";

const toneClasses: Record<Tone, string> = {
  success: "bg-success/12 text-success border-success/20",
  warning: "bg-warning/15 text-warning-foreground border-warning/30",
  destructive: "bg-destructive/12 text-destructive border-destructive/20",
  info: "bg-info/12 text-info border-info/20",
  accent: "bg-accent/12 text-accent border-accent/20",
  muted: "bg-muted text-muted-foreground border-border",
};

const statusMap: Record<string, Tone> = {
  // service
  new: "muted",
  inspection: "info",
  estimate: "accent",
  approval: "warning",
  "in-progress": "info",
  completed: "success",
  invoiced: "success",
  // priority
  low: "muted",
  medium: "info",
  high: "warning",
  critical: "destructive",
  // generic
  active: "success",
  inactive: "muted",
  expiring: "warning",
  expired: "destructive",
  none: "muted",
  operational: "success",
  "needs-service": "warning",
  down: "destructive",
  // estimates / invoices / po
  draft: "muted",
  pendingApproval: "warning",
  approved: "success",
  sent: "info",
  rejected: "destructive",
  revision: "warning",
  paid: "success",
  overdue: "destructive",
  closed: "muted",
  received: "success",
  partial: "warning",
  cancelled: "muted",
  pending: "warning",
  "in-transit": "info",
  scheduled: "info",
  "parts-pending": "warning",
  review: "accent",
  verified: "success",
  passed: "info",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = statusMap[status] ?? "muted";
  const label = status.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
        toneClasses[tone],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
  );
}
