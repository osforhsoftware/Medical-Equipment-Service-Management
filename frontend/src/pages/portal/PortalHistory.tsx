import { Download, History } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { serviceRequests } from "@/data/mock";
import { toast } from "@/hooks/use-toast";

export default function PortalHistory() {
  const { user } = useAuth();
  const history = serviceRequests.filter((r) => r.customerId === user?.customerId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Service History</h1>
        <p className="mt-1 text-sm text-muted-foreground">Complete lifetime record of services on your equipment.</p>
      </div>

      <Card className="divide-y divide-border shadow-card">
        {history.map((r) => (
          <div key={r.id} className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <History className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{r.equipmentName}</p>
                <StatusBadge status={r.status} />
              </div>
              <p className="text-xs text-muted-foreground">{r.reference} · {r.type} · {r.createdAt}</p>
            </div>
            {["completed", "invoiced"].includes(r.status) && (
              <Button variant="ghost" size="sm" onClick={() => toast({ title: "Service report", description: `${r.reference}-report.pdf` })}>
                <Download className="mr-1 h-4 w-4" /> Report
              </Button>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}
