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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [customerId, setCustomerId] = useState("");
  const [equipmentId, setEquipmentId] = useState("");

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

  const customersQuery = useQuery({
    queryKey: ["customers", "estimate-new"],
    queryFn: () => api.listCustomersOptions(),
    enabled: open,
    staleTime: 60_000,
  });

  const equipmentQuery = useQuery({
    queryKey: ["equipment", "estimate-new", customerId],
    queryFn: () => api.listEquipment({ customerId, limit: 100, page: 1 }).then((r) => r.data),
    enabled: open && Boolean(customerId),
    staleTime: 30_000,
  });

  const tickets = eligibleQuery.data?.data ?? [];
  const customers = customersQuery.data ?? [];
  const equipment = equipmentQuery.data ?? [];

  const startSalesQuote = () => {
    if (!customerId) return;
    onOpenChange(false);
    const params = new URLSearchParams({ customerId });
    if (equipmentId) params.set("equipmentId", equipmentId);
    navigate(`/app/estimates/new?${params.toString()}`);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>New quotation</SheetTitle>
          <SheetDescription>
            Sales quotes start from a customer. Service estimates stay linked to a ticket.
          </SheetDescription>
        </SheetHeader>
        <Tabs defaultValue="sales" className="mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="sales">Sales quote</TabsTrigger>
            <TabsTrigger value="service">From ticket</TabsTrigger>
          </TabsList>
          <TabsContent value="sales" className="space-y-4 pt-4">
            <div className="grid gap-2">
              <Label htmlFor="party-select">Customer / party</Label>
              <Select
                value={customerId}
                onValueChange={(value) => {
                  setCustomerId(value);
                  setEquipmentId("");
                }}
              >
                <SelectTrigger id="party-select">
                  <SelectValue placeholder={customers.length ? "Choose customer" : "No customers"} />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="equipment-select">Equipment (optional)</Label>
              <Select value={equipmentId} onValueChange={setEquipmentId} disabled={!customerId}>
                <SelectTrigger id="equipment-select">
                  <SelectValue placeholder={customerId ? "None — general sales quote" : "Select a customer first"} />
                </SelectTrigger>
                <SelectContent>
                  {equipment.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} · {item.assetTag}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" disabled={!customerId} onClick={startSalesQuote}>
              Open quotation builder
            </Button>
          </TabsContent>
          <TabsContent value="service" className="space-y-4 pt-4">
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
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
