import { useState } from "react";
import { AlertCircle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, Receipt, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type SavedViewKey = "all" | "my" | "overdue" | "approval" | "billing" | "calendar";

type SavedViewItem = {
  key: SavedViewKey;
  label: string;
  hint: string;
  icon: LucideIcon;
};

type SavedViewsSidebarProps = {
  value: SavedViewKey;
  onChange: (next: SavedViewKey) => void;
  items: SavedViewItem[];
  ariaLabel?: string;
  className?: string;
  defaultOpen?: boolean;
};

export function parseSavedView(value: string | null): SavedViewKey {
  if (
    value === "overdue"
    || value === "approval"
    || value === "billing"
    || value === "calendar"
  ) {
    return value;
  }
  return "all";
}

export function SavedViewsSidebar({
  value,
  onChange,
  items,
  ariaLabel = "Saved views",
  className,
  defaultOpen = true,
}: SavedViewsSidebarProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const activeItem = items.find((item) => item.key === value);

  return (
    <aside
      className={cn(
        "shrink-0 rounded-xl border border-border bg-card shadow-xs transition-all",
        isOpen ? "w-full p-2.5 sm:p-3 lg:w-56 xl:w-60" : "w-auto p-1.5 sm:p-2",
        className,
      )}
    >
      <div className={cn("flex items-center px-1.5", isOpen ? "justify-between gap-2 mb-2 lg:mb-2.5" : "justify-center")}>
        {isOpen && (
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="flex items-center gap-1.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors group focus-visible:outline-none whitespace-nowrap"
            title="Hide views section"
          >
            <span>Views</span>
            {activeItem && activeItem.key !== "all" && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary normal-case">
                {activeItem.label}
              </span>
            )}
          </button>
        )}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={cn(
            "inline-flex h-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            isOpen ? "w-6" : "w-full"
          )}
          title={isOpen ? "Hide views section" : "Show views section"}
          aria-label={isOpen ? "Hide views section" : "Show views section"}
        >
          {isOpen ? (
            <ChevronLeft className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {isOpen && (
        <nav
          className="flex flex-row gap-1.5 overflow-x-auto pb-1.5 pt-0.5 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0"
          aria-label={ariaLabel}
        >
          {items.map((view) => {
            const Icon = view.icon;
            const active = value === view.key;
            return (
              <button
                key={view.key}
                type="button"
                onClick={() => onChange(view.key)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-left transition-colors text-xs sm:text-sm lg:w-full lg:items-start lg:px-2.5 lg:py-2",
                  active
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs lg:bg-primary/10 lg:text-primary lg:shadow-none"
                    : "bg-muted/40 text-foreground hover:bg-muted lg:bg-transparent lg:hover:bg-muted/70",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 lg:mt-0.5",
                    active
                      ? "text-primary-foreground lg:text-primary"
                      : "text-muted-foreground",
                  )}
                />
                <span className="min-w-0">
                  <span className="block font-medium leading-tight whitespace-nowrap lg:whitespace-normal">
                    {view.label}
                  </span>
                  <span className="mt-0.5 hidden text-[11px] leading-snug text-muted-foreground lg:block">
                    {view.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>
      )}
    </aside>
  );
}

export const JOBS_SAVED_VIEWS: SavedViewItem[] = [
  { key: "all", label: "All jobs", hint: "Full job board", icon: CheckCircle2 },
  { key: "overdue", label: "Overdue", hint: "Past scheduled date", icon: AlertCircle },
  { key: "approval", label: "Approval", hint: "Waiting QA review", icon: ClipboardCheck },
  { key: "billing", label: "Billing", hint: "Ready for delivery / billing", icon: Receipt },
  { key: "calendar", label: "Calendar", hint: "Month by schedule date", icon: CalendarDays },
];

export const TICKETS_SAVED_VIEWS: SavedViewItem[] = [
  { key: "all", label: "All tickets", hint: "Full ticket board", icon: CheckCircle2 },
  { key: "overdue", label: "Overdue", hint: "Past SLA due date", icon: AlertCircle },
  { key: "approval", label: "Approval", hint: "Waiting estimate approval", icon: ClipboardCheck },
  { key: "billing", label: "Billing", hint: "Pending invoice / invoiced", icon: Receipt },
  { key: "calendar", label: "Calendar", hint: "Month by SLA due date", icon: CalendarDays },
];
