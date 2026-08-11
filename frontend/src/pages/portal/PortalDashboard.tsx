import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HardDrive, FileClock, ShieldCheck, ArrowRight, Loader2 } from "lucide-react";
import { StatCard } from "@/components/shared/StatCard";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { api, type BackendEquipment, type BackendEstimate, type BackendServiceRequest } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { formatCurrency } from "@/lib/format";
import { toast } from "@/lib/toast";

export default function PortalDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [myEquipment, setMyEquipment] = useState<BackendEquipment[]>([]);
  const [myRequests, setMyRequests] = useState<BackendServiceRequest[]>([]);
  const [pendingEstimates, setPendingEstimates] = useState<BackendEstimate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    void api.getCustomerPortal()
      .then((portal) => {
        setMyEquipment(portal.equipment);
        setMyRequests(portal.requests);
        setPendingEstimates(
          portal.estimates.filter((estimate) =>
            ["sent", "revision", "pendingAdminApproval"].includes(estimate.status),
          ),
        );
      })
      .catch((error) => toast.apiError(error, { fallback: "Request failed" }))
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${user?.name}`}
        description="Your equipment, service requests and estimates at a glance."
      />
      {loading ? <div className="flex justify-center gap-2 py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading overview…</div> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="My Equipment" value={String(myEquipment.length)} icon={HardDrive} accent="primary" />
        <StatCard label="Active Requests" value={String(myRequests.filter((r) => !["completed", "invoiced", "finished"].includes(r.status)).length)} icon={FileClock} accent="accent" />
        <StatCard label="Estimates to Review" value={String(pendingEstimates.length)} icon={ShieldCheck} accent="warning" />
      </div>

      {pendingEstimates.length > 0 && (
        <Card className="border-warning/30 bg-gradient-to-br from-warning/10 via-card to-card shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Estimates awaiting your approval</CardTitle>
            <Button size="sm" variant="outline" onClick={() => navigate("/portal/estimates")}>
              Review <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingEstimates.map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-xl border border-warning/15 bg-card/80 p-3 text-sm shadow-sm">
                <div>
                  <p className="font-medium">{e.equipmentName}</p>
                  <p className="text-xs text-muted-foreground">{e.reference} · valid until {formatDate(e.validUntil)}</p>
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
            <div key={r.id} className="flex items-center justify-between rounded-xl border border-border/80 bg-gradient-to-r from-secondary/30 to-transparent p-3 transition-colors hover:border-primary/20">
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
