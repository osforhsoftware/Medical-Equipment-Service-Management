import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { InventoryStageNav } from "@/components/inventory/InventoryStageNav";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";

export default function StockLocations() {
  const queryClient = useQueryClient();
  const inventoryQuery = useQuery({
    queryKey: ["inventory", "locations"],
    queryFn: () => api.listInventory({ page: 1, limit: 200, status: "active" }),
  });
  const branchesQuery = useQuery({
    queryKey: ["branches"],
    queryFn: () => api.listBranches(),
  });
  const transfersQuery = useQuery({
    queryKey: ["stock-transfers"],
    queryFn: () => api.listStockTransfers().catch(() => api.listDomainStockTransfers()),
  });

  const items = inventoryQuery.data?.data ?? [];
  const branches = branchesQuery.data ?? [];
  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? id;

  const locations = useMemo(() => {
    const groups = new Map<string, { key: string; branchId: string; bin: string; count: number; qty: number }>();
    for (const item of items) {
      const bin = item.binLocation?.trim() || "Unassigned bin";
      const key = `${item.branchId}::${bin}`;
      const current = groups.get(key) ?? { key, branchId: item.branchId, bin, count: 0, qty: 0 };
      current.count += 1;
      current.qty += Number(item.inStock ?? 0);
      groups.set(key, current);
    }
    return [...groups.values()].sort((a, b) => a.bin.localeCompare(b.bin));
  }, [items]);

  const refreshTransfers = () => {
    void queryClient.invalidateQueries({ queryKey: ["stock-transfers"] });
    void queryClient.invalidateQueries({ queryKey: ["inventory"] });
  };

  return (
    <RoleGuard roles={["admin", "inventory"]}>
      <div className="space-y-6">
        <PageHeader
          title="Locations"
          description="Warehouse bins and branch stock."
        />
        <InventoryStageNav stage="locations" />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4" /> Locations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {locations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No stock locations yet.</p>
            ) : (
              locations.map((loc) => (
                <div key={loc.key} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                  <div>
                    <p className="font-medium">{branchName(loc.branchId)}</p>
                    <p className="text-xs text-muted-foreground">{loc.bin}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{loc.count} SKUs · {loc.qty} on hand</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Transfers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(transfersQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No transfers yet.</p>
            ) : (
              (transfersQuery.data ?? []).map((transfer) => (
                <div key={transfer.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                  <div>
                    <p className="font-mono font-medium">{transfer.reference}</p>
                    <p className="text-xs text-muted-foreground">{transfer.fromBranch} → {transfer.toBranch}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={transfer.status} />
                    {transfer.status === "pending" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          void api.dispatchStockTransfer(transfer.id)
                            .then(() => {
                              toast.success("Transfer dispatched");
                              refreshTransfers();
                            })
                            .catch((error) => toast.apiError(error, { fallback: "Unable to dispatch" }));
                        }}
                      >
                        Dispatch
                      </Button>
                    ) : null}
                    {transfer.status === "inTransit" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          void api.receiveStockTransfer(transfer.id)
                            .then(() => {
                              toast.success("Transfer received");
                              refreshTransfers();
                            })
                            .catch((error) => toast.apiError(error, { fallback: "Unable to receive" }));
                        }}
                      >
                        Receive
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </RoleGuard>
  );
}
