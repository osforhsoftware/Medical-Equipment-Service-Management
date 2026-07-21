import { HardDrive, QrCode } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { equipment } from "@/data/mock";

export default function PortalEquipment() {
  const { user } = useAuth();
  const mine = equipment.filter((e) => e.customerId === user?.customerId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">My Equipment</h1>
        <p className="mt-1 text-sm text-muted-foreground">All registered devices and their current status.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {mine.map((e) => (
          <Card key={e.id} className="shadow-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
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
                <span className="font-medium">{e.lastServiceDate}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
