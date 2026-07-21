import { useNavigate } from "react-router-dom";
import { HardDrive, FileClock, ShieldCheck, ArrowRight } from "lucide-react";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { equipment, estimates, serviceRequests } from "@/data/mock";
import { formatCurrency } from "@/lib/format";

export default function PortalDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const myEquipment = equipment.filter((e) => e.customerId === user?.customerId);
  const myRequests = serviceRequests.filter((r) => r.customerId === user?.customerId);
  const pendingEstimates = estimates.filter((e) => e.customerName === user?.name && (e.status === "sent" || e.status === "revision"));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Welcome, {user?.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your equipment, service requests and estimates at a glance.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="My Equipment" value={String(myEquipment.length)} icon={HardDrive} accent="primary" />
        <StatCard label="Active Requests" value={String(myRequests.filter((r) => !["completed", "invoiced"].includes(r.status)).length)} icon={FileClock} accent="accent" />
        <StatCard label="Estimates to Review" value={String(pendingEstimates.length)} icon={ShieldCheck} accent="warning" />
      </div>

      {pendingEstimates.length > 0 && (
        <Card className="border-warning/30 bg-warning/5 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Estimates awaiting your approval</CardTitle>
            <Button size="sm" variant="outline" onClick={() => navigate("/portal/estimates")}>
              Review <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingEstimates.map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-lg bg-card p-3 text-sm">
                <div>
                  <p className="font-medium">{e.equipmentName}</p>
                  <p className="text-xs text-muted-foreground">{e.reference} · valid until {e.validUntil}</p>
                </div>
                <span className="font-semibold">{formatCurrency(e.total)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="shadow-card">
        <CardHeader><CardTitle className="text-base">Recent Service Requests</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {myRequests.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">{r.equipmentName}</p>
                <p className="text-xs text-muted-foreground">{r.reference} · {r.type}</p>
              </div>
              <StatusBadge status={r.status} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
