import { useEffect, useState } from "react";
import { HardDrive, Loader2, QrCode } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { ApiError, api, type BackendEquipment } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { toast } from "@/hooks/use-toast";

export default function PortalEquipment() {
  const { user } = useAuth();
  const [mine, setMine] = useState<BackendEquipment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.customerId) { setLoading(false); return; }
    void api.listEquipment({ customerId: user.customerId })
      .then(setMine)
      .catch((error) => toast({ title: "Unable to load equipment", description: error instanceof ApiError ? error.message : "Request failed", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [user?.customerId]);

  return (
    <div className="space-y-6">
      <PageHeader title="My Equipment" description="All registered devices and their current status." />
      {loading ? <div className="flex justify-center gap-2 py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading equipment…</div> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {mine.map((e) => (
          <Card key={e.id} className="group overflow-hidden shadow-card hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-elevated">
            <div className="h-1 bg-gradient-primary opacity-80" />
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/18 to-accent/12 text-primary transition-transform group-hover:scale-105">
                    <HardDrive className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{e.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">{e.manufacturer} · {e.model}</p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 font-mono text-xs">
                <QrCode className="h-3 w-3" /> {e.assetTag}
              </span>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Location</span>
                <span className="font-medium">{e.location}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Condition</span>
                <StatusBadge status={e.condition} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">AMC</span>
                <StatusBadge status={e.amcStatus} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Last service</span>
                <span className="font-medium">{e.lastServiceDate ? formatDate(e.lastServiceDate) : "Not recorded"}</span>
              </div>
            </CardContent>
          </Card>
        ))}
        {!loading && mine.length === 0 ? <p className="text-sm text-muted-foreground">No equipment is linked to this customer account.</p> : null}
      </div>
    </div>
  );
}
