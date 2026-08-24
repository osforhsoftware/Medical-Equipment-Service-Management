import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "destructive" | "info" | "muted" | "accent";

const toneClasses: Record<Tone, string> = {
  success: "bg-[hsl(var(--success-light))] text-success border-success/15",
  warning: "bg-[hsl(var(--warning-light))] text-warning-foreground border-warning/20",
  destructive: "bg-destructive/10 text-destructive border-destructive/15",
  info: "bg-[hsl(var(--info-light))] text-info border-info/15",
  accent: "bg-primary-light text-primary border-primary/15",
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
  needsService: "warning",
  "needs-service": "warning",
  down: "destructive",
  // estimates / invoices / po
  draft: "muted",
  pendingApproval: "warning",
  pendingAdminApproval: "warning",
  pending_admin_approval: "warning",
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

export function StatusBadge({ status, label, className }: { status: string; label?: string; className?: string }) {
  const normalized = status === "needsService" ? "needs-service" : status;
  const tone = statusMap[normalized] ?? statusMap[status] ?? "muted";
  const text = label ?? humanizeStatus(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium capitalize",
        toneClasses[tone],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {text}
    </span>
  );
}

function humanizeStatus(status: string) {
  return status
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
