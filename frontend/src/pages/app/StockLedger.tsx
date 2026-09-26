import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Loader2, PackageMinus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { InventoryStageNav } from "@/components/inventory/InventoryStageNav";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InventoryProductSelect } from "@/components/shared/InventoryProductSelect";
import { api, type BackendJobPartsRequest, type BackendStockMovement } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";

export default function StockLedger() {
  const queryClient = useQueryClient();
  const rowsQuery = useQuery({
    queryKey: ["stock-movements"],
    queryFn: () => api.listStockMovements(),
  });
  const requestsQuery = useQuery({
    queryKey: ["parts-requests", "queue"],
    queryFn: () => api.listPartsRequests(),
  });
  const inventoryQuery = useQuery({
    queryKey: ["inventory", "options"],
    queryFn: () => api.listInventory({ limit: 100, page: 1, status: "active" }).then((r) => r.data),
    staleTime: 60_000,
  });
  const rows = rowsQuery.data ?? [];
  const inventory = inventoryQuery.data ?? [];

  const [issueOpen, setIssueOpen] = useState(false);
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const requests = requestsQuery.data ?? [];

  const refreshQueue = async () => {
    await queryClient.invalidateQueries({ queryKey: ["parts-requests"] });
    await queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
    await queryClient.invalidateQueries({ queryKey: ["inventory"] });
  };

  const actOnRequest = async (request: BackendJobPartsRequest, action: "approve" | "reject" | "issue") => {
    setActingId(request.id);
    try {
      if (action === "approve") await api.approvePartsRequest(request.id);
      else if (action === "reject") await api.rejectPartsRequest(request.id);
      else await api.issuePartsRequest(request.id);
      toast({
        title: action === "approve" ? "Request approved" : action === "reject" ? "Request rejected" : "Parts issued",
        description: request.job?.reference ? `Job ${request.job.reference}` : request.notes,
      });
      await refreshQueue();
    } catch (error) {
      toast.apiError(error, { fallback: "Unable to update parts request" });
    } finally {
      setActingId(null);
    }
  };

  const columns: Column<BackendStockMovement>[] = useMemo(() => [
    { key: "createdAt", header: "When", render: (row) => <span>{formatDate(row.createdAt)}</span> },
    { key: "item", header: "Item", render: (row) => <div className="flex items-center gap-2"><History className="h-4 w-4 text-primary" /><span>{row.inventoryItem ? `${row.inventoryItem.sku} · ${row.inventoryItem.name}` : row.inventoryItemId}</span></div> },
    { key: "type", header: "Type", render: (row) => <span className="capitalize">{row.type.replace(/_/g, " ")}</span> },
    { key: "quantity", header: "Qty", render: (row) => <span className={row.quantity < 0 ? "text-destructive font-medium" : "font-medium"}>{row.quantity}</span> },
    { key: "balanceAfter", header: "Balance", render: (row) => <span>{row.balanceAfter}</span> },
    { key: "reference", header: "Reference", render: (row) => <span className="text-sm text-muted-foreground">{row.referenceType ? row.referenceType.replace(/_/g, " ") : "—"}</span> },
    { key: "reason", header: "Reason", render: (row) => <span className="text-sm text-muted-foreground">{row.reason ?? "—"}</span> },
  ], []);

  const issueStock = async () => {
    const qty = Number(quantity);
    if (!itemId) {
      toast.error("Select a part to issue");
      return;
    }
    if (!(qty > 0)) {
      toast.error("Quantity must be greater than 0");
      return;
    }
    if (!reason.trim()) {
      toast.error("Enter a reason for the issue");
      return;
    }
    setSaving(true);
    try {
      await api.adjustInventoryStock(itemId, -qty, reason.trim());
      toast({ title: "Stock issued", description: `${qty} unit(s) deducted from inventory.` });
      setIssueOpen(false);
      setItemId("");
      setQuantity("1");
      setReason("");
      await queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
    } catch (error) {
      toast.apiError(error, { fallback: "Unable to issue stock" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <RoleGuard roles={["admin", "inventory"]}>
      <div className="space-y-6">
        <PageHeader
          title="Stock issue"
          description="Issue parts out of stock and review movements from jobs, receipts, returns, and adjustments."
          actions={
            <Button variant="brand" onClick={() => setIssueOpen(true)}>
              <PackageMinus className="mr-1 h-4 w-4" /> Issue stock
            </Button>
          }
        />
        <InventoryStageNav stage="issue" />
        <div className="rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold">Job parts queue</h2>
          <p className="mb-3 text-xs text-muted-foreground">Approve, then issue. Issue reduces warehouse stock and holds it as issued until the job uses, returns, or scraps it.</p>
          {requestsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading requests…</p>
          ) : requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending or approved parts requests.</p>
          ) : (
            <div className="space-y-3">
              {requests.map((request) => (
                <div key={request.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{request.job?.reference ?? "Job"} · {request.job?.customerName ?? "Customer"}</p>
                      <p className="text-xs text-muted-foreground capitalize">{request.status} · {request.requestedBy} · {request.job?.engineer}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {request.status === "pending" ? (
                        <>
                          <Button size="sm" disabled={actingId === request.id} onClick={() => void actOnRequest(request, "approve")}>Approve</Button>
                          <Button size="sm" variant="outline" disabled={actingId === request.id} onClick={() => void actOnRequest(request, "reject")}>Reject</Button>
                        </>
                      ) : null}
                      {request.status === "approved" ? (
                        <Button size="sm" disabled={actingId === request.id} onClick={() => void actOnRequest(request, "issue")}>Issue stock</Button>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{request.notes}</p>
                  {(request.lines ?? []).map((line) => (
                    <p key={line.id} className="mt-1 text-xs">
                      {line.sku} · {line.itemName} — req {line.qtyRequested} / appr {line.qtyApproved} / issued {line.qtyIssued} / used {line.qtyConsumed}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
        <DataTable
          data={rows}
          columns={columns}
          searchKeys={["type", "reason"]}
          emptyMessage="No stock movements yet."
          emptyHint="Issue stock here, or deduct parts from a service job."
          loading={rowsQuery.isLoading}
          error={rowsQuery.error as Error | null}
          onRetry={() => void rowsQuery.refetch()}
        />

        <Dialog open={issueOpen} onOpenChange={(open) => { if (!open) setIssueOpen(false); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Issue stock</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="grid gap-2">
                <Label>Part</Label>
                <InventoryProductSelect
                  items={inventory}
                  value={itemId}
                  onValueChange={(id) => setItemId(id)}
                  placeholder="Select inventory item"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="issue-qty">Quantity to issue</Label>
                <Input id="issue-qty" type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="issue-reason">Reason</Label>
                <Textarea
                  id="issue-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Issued to job JOB-… / workshop use"
                />
              </div>
              <div className="grid gap-2">
                <Label>Or pick a quick reason</Label>
                <Select onValueChange={setReason}>
                  <SelectTrigger><SelectValue placeholder="Optional preset" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Issued to service job">Issued to service job</SelectItem>
                    <SelectItem value="Workshop consumption">Workshop consumption</SelectItem>
                    <SelectItem value="Damaged / write-off">Damaged / write-off</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIssueOpen(false)}>Cancel</Button>
              <Button type="button" disabled={saving} onClick={() => void issueStock()}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Issue
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RoleGuard>
  );
}
