import { useEffect, useState } from "react";
import { HardDrive, Loader2, QrCode } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { api, type BackendEquipment } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";

export default function PortalEquipment() {
  const { user } = useAuth();
  const [mine, setMine] = useState<BackendEquipment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    void api.getCustomerPortal()
      .then((portal) => setMine(portal.equipment))
      .catch((error) => toast.apiError(error, { fallback: "Request failed" }))
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <div className="space-y-6">
      <PageHeader title="My Equipment" description="All registered devices and their current status." />
      {loading ? <div className="flex justify-center gap-2 py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading equipment…</div> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {mine.map((e) => (
          <Card key={e.id} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
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
              <p className="flex items-center gap-1.5"><QrCode className="h-3.5 w-3.5" /> {e.assetTag}</p>
              <p>Serial: {e.serialNumber}</p>
              <p>Last service: {formatDate(e.lastServiceDate)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
