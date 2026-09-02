import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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
import { api } from "@/lib/api";

export function EstimateNewSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [ticketId, setTicketId] = useState("");

  const eligibleQuery = useQuery({
    queryKey: ["service-requests", "estimate-eligible"],
    queryFn: () =>
      api.listServiceRequests({
        statuses: "inspection,estimate,approval,pending_approval,new",
        limit: 100,
        page: 1,
      }),
    enabled: open,
    staleTime: 30_000,
  });

  const tickets = eligibleQuery.data?.data ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>New service estimate</SheetTitle>
          <SheetDescription>
            Estimates are linked to a service ticket. Product sales are recorded on the Sales floor.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="ticket-select">Service ticket</Label>
            <Select value={ticketId} onValueChange={setTicketId}>
              <SelectTrigger id="ticket-select">
                <SelectValue placeholder={tickets.length ? "Choose ticket" : "No eligible tickets"} />
              </SelectTrigger>
              <SelectContent>
                {tickets.map((ticket) => (
                  <SelectItem key={ticket.id} value={ticket.id}>
                    {ticket.reference} · {ticket.customerName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-full"
            disabled={!ticketId}
            onClick={() => {
              onOpenChange(false);
              navigate(`/app/estimates/${ticketId}/build`);
            }}
          >
            Open Estimate Builder
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
