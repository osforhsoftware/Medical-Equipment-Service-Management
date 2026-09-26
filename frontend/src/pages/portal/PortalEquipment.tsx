import { useEffect, useState } from "react";
import { HardDrive, Loader2, Plus } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PortalRequestDialog } from "@/components/portal/PortalRequestDialog";
import { useAuth } from "@/context/AuthContext";
import { api, type BackendEquipment } from "@/lib/api";
import { formatDate } from "@/lib/format";
import {
  formatEquipmentCurrentStatus,
  formatMachineWarrantyLabel,
  formatServiceWarrantyLabel,
} from "@/lib/equipmentWarranty";
import { toast } from "@/lib/toast";

export default function PortalEquipment() {
  const { user } = useAuth();
  const [mine, setMine] = useState<BackendEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestOpen, setRequestOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>();

  const load = () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void api.getCustomerPortal()
      .then((portal) => setMine(portal.equipment))
      .catch((error) => toast.apiError(error, { fallback: "Request failed" }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [user]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Equipment"
        description="Service equipment registered to your account only."
        actions={
          <Button size="sm" onClick={() => { setSelectedId(undefined); setRequestOpen(true); }} disabled={mine.length === 0}>
            <Plus className="mr-1 h-4 w-4" /> Request service
          </Button>
        }
      />
      {loading ? <div className="flex justify-center gap-2 py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading equipment…</div> : null}
      {!loading && mine.length === 0 ? (
        <EmptyState title="No equipment on file" description="When we register your devices for service, they will appear here." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {mine.map((e) => (
            <Card key={e.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-light text-primary">
                      <HardDrive className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{e.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">{e.manufacturer} · {e.model}</p>
                    </div>
                  </div>
                  <StatusBadge status={e.condition} />
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>Asset: {e.assetTag}</p>
                <p>Serial: {e.serialNumber}</p>
                <p>Status: {formatEquipmentCurrentStatus(e.currentStatus)}</p>
                <p>Location: {e.location || "—"}</p>
                <p>Machine warranty: {formatMachineWarrantyLabel(e)}</p>
                <p>Service warranty: {formatServiceWarrantyLabel(e)}</p>
                <p>Last service: {formatDate(e.lastServiceDate)}</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => {
                    setSelectedId(e.id);
                    setRequestOpen(true);
                  }}
                >
                  Request service
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <PortalRequestDialog
        open={requestOpen}
        onOpenChange={setRequestOpen}
        equipment={mine}
        defaultEquipmentId={selectedId}
        onCreated={load}
      />
    </div>
  );
}
