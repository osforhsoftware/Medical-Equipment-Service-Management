import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/context/AuthContext";
import { api, type BackendServiceRequest } from "@/lib/api";
import { formatServiceStatus } from "@/lib/format";

const ELIGIBLE_STATUSES = "inspection,estimate";

function ticketLabel(ticket: BackendServiceRequest) {
  const equipment =
    ticket.equipmentItems?.map((item) => item.equipmentName).join(", ")
    || ticket.equipmentName
    || "Equipment";
  return `${ticket.reference} · ${ticket.customerName} · ${equipment}`;
}

export function EstimateNewSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const { hasRole, user } = useAuth();
  const isEstimator = hasRole(["estimator"]) && !hasRole(["admin", "coordinator"]);
  const [ticketId, setTicketId] = useState("");

  const eligibleQuery = useQuery({
    queryKey: ["service-requests", "estimate-eligible", user?.id],
    queryFn: () =>
      api.listServiceRequests({
        statuses: ELIGIBLE_STATUSES,
        limit: 100,
        page: 1,
      }),
    enabled: open,
    staleTime: 15_000,
  });

  const tickets = useMemo(() => {
    const rows = eligibleQuery.data?.data ?? [];
    // Prefer estimate-stage tickets (assigned work) before inspection prep.
    return [...rows].sort((a, b) => {
      const rank = (status: string) => (status === "estimate" ? 0 : 1);
      const byStatus = rank(a.status) - rank(b.status);
      if (byStatus !== 0) return byStatus;
      return a.reference.localeCompare(b.reference);
    });
  }, [eligibleQuery.data?.data]);

  const openBuilder = () => {
    if (!ticketId) return;
    onOpenChange(false);
    setTicketId("");
    navigate(`/app/estimates/${ticketId}/build`);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) setTicketId("");
        onOpenChange(next);
      }}
    >
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>New service estimate</SheetTitle>
          <SheetDescription>
            {isEstimator
              ? "Pick a ticket assigned to you, build the quotation, then send it for approval."
              : "Link a quotation to a service ticket in Inspection or Estimate stage, then send it for approval."}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="ticket-select">Service ticket</Label>
            {eligibleQuery.isLoading ? (
              <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading tickets…
              </div>
            ) : (
              <Select value={ticketId} onValueChange={setTicketId}>
                <SelectTrigger id="ticket-select">
                  <SelectValue
                    placeholder={tickets.length ? "Choose ticket" : "No assigned tickets ready for estimate"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {tickets.map((ticket) => (
                    <SelectItem key={ticket.id} value={ticket.id}>
                      {ticketLabel(ticket)}
                      {" · "}
                      {formatServiceStatus(ticket.status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {!eligibleQuery.isLoading && tickets.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {isEstimator
                  ? "When a coordinator assigns you a ticket at Estimate stage, it will appear here."
                  : "Move a ticket to Inspection or Estimate, then assign Estimate Staff."}
              </p>
            ) : null}
          </div>
          <Button className="w-full" disabled={!ticketId} onClick={openBuilder}>
            Open Estimate Builder
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
