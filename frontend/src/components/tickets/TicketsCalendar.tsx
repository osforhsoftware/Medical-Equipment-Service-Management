import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BackendServiceRequest } from "@/lib/api";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const MAX_VISIBLE_PER_DAY = 3;

const STATUS_BAR: Record<string, string> = {
  new: "bg-sky-500/90 text-white",
  inspection: "bg-amber-500/90 text-white",
  estimate: "bg-violet-600/90 text-white",
  approval: "bg-primary/90 text-primary-foreground",
  pending_approval: "bg-primary/90 text-primary-foreground",
  inProgress: "bg-emerald-600/90 text-white",
  assigned_engineer: "bg-emerald-600/90 text-white",
  change_pending_approval: "bg-amber-500/90 text-white",
  pending_final_approval: "bg-indigo-600/90 text-white",
  pending_invoice: "bg-indigo-600/90 text-white",
  invoiced: "bg-slate-500/90 text-white",
  completed: "bg-slate-500/90 text-white",
  closed: "bg-muted text-muted-foreground",
  finished: "bg-slate-500/90 text-white",
};

const STATUS_DOT: Record<string, string> = {
  new: "bg-sky-500",
  inspection: "bg-amber-500",
  estimate: "bg-violet-600",
  approval: "bg-primary",
  "in-progress": "bg-emerald-600",
  billing: "bg-indigo-600",
  completed: "bg-slate-500",
};

type TicketsCalendarProps = {
  month: Date;
  onMonthChange: (next: Date) => void;
  tickets: BackendServiceRequest[];
  loading?: boolean;
  truncated?: boolean;
  statusLabel: (status: string) => string;
  equipmentLabel: (ticket: BackendServiceRequest) => string;
  assigneeLabel: (ticket: BackendServiceRequest) => string;
};

function ticketDayKey(ticket: BackendServiceRequest) {
  const raw = ticket.slaDue || ticket.createdAt;
  try {
    return format(parseISO(raw), "yyyy-MM-dd");
  } catch {
    return format(new Date(raw), "yyyy-MM-dd");
  }
}

export function TicketsCalendar({
  month,
  onMonthChange,
  tickets,
  loading,
  truncated,
  statusLabel,
  equipmentLabel,
  assigneeLabel,
}: TicketsCalendarProps) {
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const monthStart = startOfMonth(month);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const ticketsByDay = useMemo(() => {
    const map = new Map<string, BackendServiceRequest[]>();
    for (const ticket of tickets) {
      if (!ticket.slaDue && !ticket.createdAt) continue;
      const key = ticketDayKey(ticket);
      const list = map.get(key) ?? [];
      list.push(ticket);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.reference.localeCompare(b.reference));
    }
    return map;
  }, [tickets]);

  const expandedTickets = expandedDay ? ticketsByDay.get(expandedDay) ?? [] : [];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            aria-label="Previous month"
            onClick={() => onMonthChange(subMonths(month, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="min-w-[10rem] text-center text-base font-semibold tracking-tight">
            {format(month, "MMMM yyyy")}
          </h2>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            aria-label="Next month"
            onClick={() => onMonthChange(addMonths(month, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => onMonthChange(startOfMonth(new Date()))}
          >
            Today
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {[
            ["new", "New"],
            ["inspection", "Inspection"],
            ["estimate", "Estimate"],
            ["approval", "Approval"],
            ["in-progress", "In Progress"],
            ["billing", "Billing"],
            ["completed", "Done"],
          ].map(([key, label]) => (
            <span key={key} className="inline-flex items-center gap-1.5">
              <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[key])} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {truncated ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
          Showing the first 100 tickets in this month. Narrow with search or status filter if needed.
        </p>
      ) : null}

      <div className="relative overflow-hidden rounded-lg border border-border bg-card">
        {loading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : null}

        <div className="grid grid-cols-7 border-b border-border bg-muted/40">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 auto-rows-[minmax(7.5rem,1fr)]">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayTickets = ticketsByDay.get(key) ?? [];
            const inMonth = isSameMonth(day, month);
            const visible = dayTickets.slice(0, MAX_VISIBLE_PER_DAY);
            const overflow = dayTickets.length - visible.length;

            return (
              <div
                key={key}
                className={cn(
                  "flex min-h-[7.5rem] flex-col border-b border-r border-border p-1.5",
                  !inMonth && "bg-muted/20",
                  isToday(day) && "bg-primary/[0.04]",
                )}
              >
                <div className="mb-1 flex items-center justify-between px-0.5">
                  <span
                    className={cn(
                      "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                      !inMonth && "text-muted-foreground/50",
                      isToday(day) && "bg-primary text-primary-foreground",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  {dayTickets.length > 0 ? (
                    <span className="text-[10px] text-muted-foreground">{dayTickets.length}</span>
                  ) : null}
                </div>

                <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                  {visible.map((ticket) => (
                    <Link
                      key={ticket.id}
                      to={`/app/service-tickets/${ticket.id}`}
                      title={`${ticket.reference} · ${equipmentLabel(ticket)} · ${statusLabel(ticket.status)}`}
                      className={cn(
                        "block truncate rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight transition hover:opacity-90",
                        STATUS_BAR[ticket.status] ?? "bg-muted text-foreground",
                      )}
                    >
                      {equipmentLabel(ticket)}
                    </Link>
                  ))}
                  {overflow > 0 ? (
                    <button
                      type="button"
                      className="rounded px-1 py-0.5 text-left text-[10px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={() => setExpandedDay(key)}
                    >
                      +{overflow} more
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {expandedDay ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Tickets on day"
          onClick={() => setExpandedDay(null)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-border bg-card p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">
                  {format(parseISO(expandedDay), "EEEE, MMM d")}
                </p>
                <p className="text-xs text-muted-foreground">{expandedTickets.length} ticket(s)</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setExpandedDay(null)}>
                Close
              </Button>
            </div>
            <div className="max-h-[60vh] space-y-2 overflow-y-auto">
              {expandedTickets.map((ticket) => (
                <Link
                  key={ticket.id}
                  to={`/app/service-tickets/${ticket.id}`}
                  className="block rounded-md border border-border p-3 hover:bg-muted/40"
                  onClick={() => setExpandedDay(null)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-muted-foreground">{ticket.reference}</p>
                      <p className="truncate text-sm font-medium">{equipmentLabel(ticket)}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {ticket.customerName} · {assigneeLabel(ticket)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
                        STATUS_BAR[ticket.status] ?? "bg-muted",
                      )}
                    >
                      {statusLabel(ticket.status)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {!loading && tickets.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">No tickets with SLA due this month.</p>
      ) : null}
    </div>
  );
}
